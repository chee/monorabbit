import {eventHandler} from "vinxi/http"
import {
	NetworkAdapter,
	Repo,
	type PeerId,
	type PeerMetadata,
} from "@automerge/automerge-repo"
import {NodeFSStorageAdapter} from "@automerge/automerge-repo-storage-nodefs"
import type {
	FromClientMessage,
	FromServerMessage,
} from "@automerge/automerge-repo-network-websocket"
import {decode, encode} from "@automerge/automerge-repo/helpers/cbor.js"
import {type Peer} from "crossws"

class VinxiNetworkAdapter extends NetworkAdapter {
	peersByAutomerge: Map<PeerId, Peer> = new Map()
	peersByVinxi: Map<string, Peer> = new Map()
	peerIdByVinxi: Map<string, PeerId> = new Map()

	#ready = false
	#readyResolver?: () => void
	#readyPromise: Promise<void> = new Promise<void>(resolve => {
		this.#readyResolver = resolve
	})

	isReady() {
		return this.#ready
	}

	whenReady() {
		return this.#readyPromise
	}

	#forceReady() {
		if (!this.#ready) {
			this.#ready = true
			this.#readyResolver?.()
		}
	}

	connect(peerId: PeerId, peerMetadata: PeerMetadata) {
		this.peerId = peerId
		this.peerMetadata = peerMetadata
		this.#forceReady()
		console.log("hello", peerId, peerMetadata)
	}

	disconnect() {
		for (const peerId of this.peersByAutomerge.keys()) {
			this.removePeer(peerId)
		}
	}

	receiveMessage(peer: Peer, bytes: Uint8Array) {
		let message: FromClientMessage
		try {
			message = decode(bytes)
		} catch (e) {
			console.error("decode error", e)
			return
		}

		if (isJoinMessage(message)) {
			// Let the repo know that we have a new connection.
			network.emit("peer-candidate", {
				peerId: message.senderId,
				peerMetadata: message.peerMetadata,
			})

			if (message.supportedProtocolVersions.includes("1")) {
				this.meetPeer(message.senderId, peer)
				this.send({
					type: "peer",
					senderId: network.peerId!,
					peerMetadata: network.peerMetadata!,
					selectedProtocolVersion: "1",
					targetId: message.senderId,
				})
			} else {
				this.send({
					type: "error",
					senderId: network.peerId!,
					message: "unsupported protocol version",
					targetId: message.senderId,
				})
				this.removePeer(message.senderId)
			}
		} else {
			network.emit("message", message)
		}
	}

	send(message: FromServerMessage) {
		const targetId = message.targetId
		const peer = this.peersByAutomerge.get(targetId)
		const bytes = encode(message)
		const {buffer, byteOffset, byteLength} = bytes
		const arraybuffer = buffer.slice(byteOffset, byteOffset + byteLength)

		if (peer) {
			// @ts-expect-error i am pretty sure {binary: true} is real
			peer.send(arraybuffer, {binary: true})
		} else {
			console.error("peer not found", targetId)
		}
	}

	registerPeer(peer: Peer) {
		this.peersByVinxi.set(peer.id, peer)
	}

	meetPeer(peerId: PeerId, peer: Peer) {
		this.peersByAutomerge.set(peerId, peer)
		this.peerIdByVinxi.set(peer.id, peerId)
	}

	removePeer(peerId: PeerId) {
		const peer = this.peersByAutomerge.get(peerId)
		this.peersByAutomerge.delete(peerId)
		peer && this.peersByVinxi.delete(peer.id)
		peer && this.peerIdByVinxi.delete(peer.id)
	}

	removePeerByVinxi(id: string) {
		const peerId = this.peerIdByVinxi.get(id)
		peerId && this.removePeer(peerId)
	}
}
const network = new VinxiNetworkAdapter()

import os from "node:os"
import {isJoinMessage} from "@automerge/automerge-repo-network-websocket/dist/messages.js"

const repo = new Repo({
	storage: new NodeFSStorageAdapter("./.automerge"),
	network: [network],
	peerId: `${os.hostname()}` as PeerId,
})

export {repo}

export default eventHandler({
	handler() {},
	websocket: {
		async open(peer) {
			peer.ctx.node.ws.binaryType = "arraybuffer"
			network.registerPeer(peer)
		},
		async message(peer, msg) {
			const incoming = msg.rawData
			const bytes = new Uint8Array(incoming)
			network.receiveMessage(peer, bytes)
		},
		async close(peer) {
			network.removePeerByVinxi(peer.id)
		},
		async error(peer, error) {
			network.removePeerByVinxi(peer.id)
		},
	},
})

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

class ManagedNetwork extends NetworkAdapter {
	peersByAutomerge: Map<PeerId, Peer> = new Map()
	peersByVinxi: Map<string, Peer> = new Map()

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
		// todo destroy
		// this.peers.delete(peerId)
	}
	send(message: FromServerMessage) {
		const targetId = message.targetId
		const peer = this.peersByAutomerge.get(targetId)
		const bytes = encode(message)
		const {buffer, byteOffset, byteLength} = bytes
		const arraybuffer = buffer.slice(byteOffset, byteOffset + byteLength)

		if (peer) {
			// todo {binary: true}?
			peer.send(arraybuffer, {binary: true})
		} else {
			console.error("peer not found", targetId)
		}
	}

	addPeer(peer: Peer) {
		this.peersByVinxi.set(peer.id, peer)
	}

	knowPeer(peerId: PeerId, peer: Peer) {
		this.peersByAutomerge.set(peerId, peer)
	}
}
const network = new ManagedNetwork()

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
			network.addPeer(peer)
		},
		async message(peer, msg) {
			const incoming = msg.rawData
			const bytes = new Uint8Array(incoming)
			let message: FromClientMessage
			try {
				message = decode(bytes)
			} catch (e) {
				// socket.close()
				console.error("decode error", e)
				return
			}
			const {type, senderId} = message
			const myPeerId = network.peerId

			const documentId = "documentId" in message ? "@" + message.documentId : ""
			const {byteLength} = bytes
			console.info(
				`[${senderId}->${myPeerId}${documentId}] ${type} | ${byteLength} bytes`
			)

			if (isJoinMessage(message)) {
				const {peerMetadata, supportedProtocolVersions} = message
				const existingSocket = network.peersByAutomerge.get(message.senderId)
				if (existingSocket) {
					// if (existingSocket.readyState === WebSocket.OPEN) {
					// existingSocket.close()
					// }
					// todo remove peer
					network.emit("peer-disconnected", {peerId: senderId})
				}
				// Let the repo know that we have a new connection.
				network.emit("peer-candidate", {peerId: senderId, peerMetadata})

				network.knowPeer(senderId, peer)
				// const selectedProtocolVersion = selectProtocol(
				// 	supportedProtocolVersions
				// )
				if (message.supportedProtocolVersions.includes("1")) {
					// todo add a wrapper for this that includes the sender,
					// metadata and protocol
					network.send({
						type: "peer",
						senderId: network.peerId!,
						peerMetadata: network.peerMetadata!,
						selectedProtocolVersion: "1",
						targetId: senderId,
					})
				} else {
					/* network.send({
						type: "error",
						senderId: network.peerId!,
						message: "unsupported protocol version",
						targetId: senderId,
					}) */
					// todo removePeer
					// this.sockets[senderId].close()
					// delete this.sockets[senderId]
				}
			} else {
				network.emit("message", message)
			}
		},
		async close(peer, details) {
			// todo network.removePeer(peer.id)
		},
		async error(peer, error) {
			// todo error
		},
	},
})
function selectProtocol(supportedProtocolVersions: "1"[]) {}

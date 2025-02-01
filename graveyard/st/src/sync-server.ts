// @ts-check
import {
	Repo,
	NetworkAdapter,
	type PeerId,
	type PeerMetadata,
} from "@automerge/automerge-repo"
import {type ProtocolVersion} from "@automerge/automerge-repo-network-websocket"
import {NodeFSStorageAdapter} from "@automerge/automerge-repo-storage-nodefs"
import {existsSync, mkdirSync} from "node:fs"
import {eventHandler as createEventHandler, type EventHandler} from "vinxi/http"
import type {Peer as VPeer} from "crossws"
import {encode} from "@automerge/automerge-repo/helpers/cbor.js"
import {type FromServerMessage} from "@automerge/automerge-repo-network-websocket/dist/messages.js"
import {hostname} from "node:os"
import {partyHandler} from "vinxi/party"
import {PartyServerAdapter} from "./party-adapter/party-adapter.js"
import {WebSocketClientAdapter} from "./party-adapter/websocket-adapter.js"

const dir =
	process.env.AUTOMERGE_DATA_DIR !== undefined
		? process.env.AUTOMERGE_DATA_DIR
		: ".automerge"
if (!existsSync(dir)) {
	mkdirSync(dir)
}

const repo = new Repo({
	storage: new NodeFSStorageAdapter(dir),
	/** @ts-ignore @type {(import("@automerge/automerge-repo").PeerId)}  */
	peerId: `sync-${hostname()}`,
	// Since this is a server, we don't share generously — meaning we only sync documents they already
	// know about and can ask for by ID.
	sharePolicy: async () => false,
	enableRemoteHeadsGossiping: true,
})

export default partyHandler({
	onConnect(party, peer) {
		repo.networkSubsystem.addNetworkAdapter(
			new WebSocketClientAdapter(peer.ctx.node.ws)
		)
	},
	onMessage(party, message, peer) {
		const cons = party.getConnections()
		for (const con of cons) {
			if (con != peer)
				con.send(encode(message), {compress: false, binary: true})
		}
	},
})

export {repo}

/**
 * This incantation deals with websocket sending the whole underlying buffer even if we just have a
 * uint8array view on it
 */
export const toArrayBuffer = (bytes: Uint8Array) => {
	const {buffer, byteOffset, byteLength} = bytes
	return buffer.slice(byteOffset, byteOffset + byteLength)
}

const selectProtocol = (versions?: ProtocolVersion[]) => {
	if (versions === undefined) return undefined
	if (versions.includes("1")) return "1"
	return null
}

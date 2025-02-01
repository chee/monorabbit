import "@unocss/reset/tailwind.css"
import "uno.css"

// @refresh reload
import {mount, StartClient} from "@solidjs/start/client"
import {Repo, type PeerId} from "@automerge/automerge-repo"
import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket"
import {IndexedDBStorageAdapter} from "@automerge/automerge-repo-storage-indexeddb"

const agent = navigator.userAgent.split(" ")
const peerId = agent[agent.length - 1] as PeerId

const repo = new Repo({
	network: [new BrowserWebSocketClientAdapter("/sync")],
	storage: new IndexedDBStorageAdapter(),
	enableRemoteHeadsGossiping: true,
	peerId,
})

repo.networkSubsystem.on("ready", () => {
	console.log("network ready?")
})

repo.networkSubsystem.on("peer", peer => {
	console.log("guess who's here?", peer)
})

repo.networkSubsystem.on("message", message => {
	console.log("message recieved:", message)
})

await repo.networkSubsystem.whenReady()

// console.log(repo.create({document: "yes"}).url)
// ran ^ gave me automerge:2v9vC4GEshBdCbuvjnqiDYHZ4ZHQ
const handle = repo.find("automerge:2v9vC4GEshBdCbuvjnqiDYHZ4ZHQ")
await handle.whenReady()
handle.change(doc => (doc.value = "four"))
repo
	.find("automerge:2v9vC4GEshBdCbuvjnqiDYHZ4ZHQ")
	.doc()
	.then(doc => {
		console.info(doc)
	})

mount(() => <StartClient />, document.getElementById("app")!)

import create from "../lib/main.ts"
import {AutomergeUrl, Repo} from "@automerge/automerge-repo"
import {StandardSchemaV1} from "@standard-schema/spec"
import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket"
import {IndexedDBStorageAdapter} from "@automerge/automerge-repo-storage-indexeddb"
import * as v from "valibot"

const repo = new Repo({
	storage: new IndexedDBStorageAdapter(),
	network: [new BrowserWebSocketClientAdapter("wss://galaxy.observer")],
})

// const url = repo.create({
// 	title: "My first document",
// 	items: [
// 		repo.create({title: "First item"}).url,
// 		repo.create({title: "Second item", complete: new Date()}).url,
// 	],
// }).url

const project = create(
	"automerge:22e64horM7JNUxzwRLj6ATpwP3UQ" as AutomergeUrl,
	{
		signals: {
			create() {
				return {
					track() {
						console.log("sub")
					},
					notify() {
						console.log("pub")
					},
				}
			},
			cleanup(fn) {
				console.log("cleaning up")
				fn()
			},
		},
		repo,
		schema(s) {
			return v.object({
				title: v.string(),
				items: v.array(
					s.link(
						v.object({
							title: v.string(),
							complete: v.optional(v.date()),
						})
					)
				),
			})
		},
	}
)

console.log(await project)

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    ok
  </div>
`

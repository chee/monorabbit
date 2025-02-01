import create, {link} from "../lib/main.ts"
import {AutomergeUrl, Repo} from "@automerge/automerge-repo"
import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket"
import {IndexedDBStorageAdapter} from "@automerge/automerge-repo-storage-indexeddb"
import {z} from "zod"
import {render} from "solid-js/web"
import {
	createEffect,
	createResource,
	For,
	getOwner,
	runWithOwner,
	Suspense,
} from "solid-js"

const repo = new Repo({
	storage: new IndexedDBStorageAdapter(),
	network: [new BrowserWebSocketClientAdapter("wss://galaxy.observer")],
})

const projectURL = "automerge:22e64horM7JNUxzwRLj6ATpwP3UQ" as AutomergeUrl
const projectHandle = repo.find(projectURL)

function App() {
	const owner = getOwner()
	const [project] = createResource(() => {
		return create(projectURL, {
			repo,
			schema: z.object({
				title: z.string(),
				items: z.array(
					link(
						repo,
						owner
					)(
						z.object({
							title: z.string(),
							complete: z.date().optional().nullable(),
						})
					)
				)!,
			}),
		})
	})

	createEffect(() => {
		console.log(project()?.items?.[0]?.complete)
	})
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<article>
				<h1>{project()?.title}</h1>
				<ul>
					<For each={project()?.items}>
						{(item, index) => (
							<li
								onclick={() => {
									const url = projectHandle.docSync()?.items?.[index()]
									if (url) {
										const item = repo.find(url)
										item.change(doc => {
											if (doc.complete) {
												doc.complete = null
											} else {
												doc.complete = new Date()
											}
										})
									}
								}}>
								{item.title}
								{item.complete && (
									<span>
										{" "}
										✅ {"complete" in item && item.complete.toISOString()}
									</span>
								)}
							</li>
						)}
					</For>
				</ul>
			</article>
			<button
				onclick={() => {
					projectHandle.change(doc => {
						doc.items.push(t())
					})
				}}>
				add random item
			</button>
		</Suspense>
	)
}

function shuf1<T>(list: T[]): T {
	return list[Math.floor(Math.random() * list.length)]
}

render(() => <App />, document.querySelector("#app")!)

function t() {
	return repo.create({
		title:
			"grab a " +
			shuf1(["sausage", "dog", "monkey", "remote", "friend"]) +
			" for the " +
			shuf1(["start", "end", "middle", "edge", "sight", "movement"]) +
			" of the " +
			shuf1([
				"day",
				"night",
				"week",
				"month",
				"year",
				"decade",
				"century",
				"millennium",
				"clown",
				"circus",
				"show",
				"party",
				"event",
				"celebration",
				"holiday",
				"vacation",
				"meaning",

				"universe",
				"world",
				"planet",
				"country",
				"state",
				"city",
				"town",
				"village",
			]),
		complete: Math.random() > 0.5 ? new Date(Math.random() * 5e12) : null,
	}).url
}

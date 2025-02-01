import {
	isValidAutomergeUrl,
	type AutomergeUrl,
	type DocHandleChangePayload,
	type Repo,
} from "@automerge/automerge-repo"
import type {StandardSchemaV1} from "@standard-schema/spec"
import z from "zod"
import {createStore, reconcile} from "solid-js/store"
import {getOwner, onCleanup, runWithOwner, type Owner} from "solid-js"

export interface SignalsAdapter {
	create(): {
		track(): void
		notify(): void
	}
	cleanup(fn: () => void): void
	scoped?(): boolean
}

export default async function createView<Schema extends StandardSchemaV1>(
	url: AutomergeUrl,
	options: {
		repo: Repo
		schema: Schema
	}
): Promise<StandardSchemaV1.InferOutput<Schema>> {
	type Shape = StandardSchemaV1.InferOutput<Schema>
	const handle = options.repo.find<Shape>(url)
	await handle.whenReady()
	const result = await options.schema["~standard"].validate(await handle.doc())
	if (result.issues) {
		console.error(result.issues)
		throw new Error(result.issues.join("\n"))
	}
	const [view, setView] = createStore(result.value!)
	function watch(payload: DocHandleChangePayload<any>) {
		setView(reconcile(payload.patchInfo.after))
	}
	handle.on("change", watch)
	onCleanup(() => {
		handle.off("change", watch)
	})

	return view as StandardSchemaV1.InferOutput<Schema>
}

export function link(repo: Repo) {
	return <LinkSchema extends StandardSchemaV1>(schema: LinkSchema) =>
		z
			.string()
			.refine(isValidAutomergeUrl)
			.transform(async url => createView<LinkSchema>(url, {repo, schema}))
}

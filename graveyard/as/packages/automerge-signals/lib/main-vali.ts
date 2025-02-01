import {type AutomergeUrl, type Repo} from "@automerge/automerge-repo"
import type {StandardSchemaV1} from "@standard-schema/spec"
import * as v from "valibot"

export interface SignalsAdapter {
	create(): {
		track(): void
		notify(): void
	}
	cleanup(fn: () => void): void
	scoped?(): boolean
}

interface SchemaContext {
	link(
		LinkSchema: StandardSchemaV1
	): StandardSchemaV1.InferOutput<typeof LinkSchema>
}

interface AutomergeLinkSchema<T> extends StandardSchemaV1<AutomergeUrl, T> {
	type: "automerge-link"
	message: string
}

export default async function create<Schema extends StandardSchemaV1>(
	url: AutomergeUrl,
	options: {
		repo: Repo
		schema: (s: SchemaContext) => Schema
		adapter: SignalsAdapter
	}
): Promise<StandardSchemaV1.InferOutput<Schema>> {
	type Shape = StandardSchemaV1.InferOutput<Schema>
	const signal = options.adapter.create()
	signal.track()
	const handle = options.repo.find<Shape>(url)
	const schema = options.schema({
		link<LinkSchema extends StandardSchemaV1>(
			schema: LinkSchema
		): StandardSchemaV1 {
			return v.pipeAsync(
				v.string()
				// v.check(
				// 	input => isValidAutomergeUrl(input),
				// 	"not a valid automerge url 😳"
				// ),
				// v.transformAsync(value =>
				// 	create<LinkSchema>(value as AutomergeUrl, {
				// 		...options,
				// 		schema: () => schema,
				// 	})
				// )
			)
		},
	})
	const doc = await schema["~standard"].validate(await handle.doc())
	if (doc.issues) {
		throw new Error(doc.issues.join("\n"))
	}
	return doc.value
}

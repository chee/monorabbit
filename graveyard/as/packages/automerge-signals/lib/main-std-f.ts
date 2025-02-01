import {
	isValidAutomergeUrl,
	type AutomergeUrl,
	type Repo,
} from "@automerge/automerge-repo"
import type {StandardSchemaV1} from "@standard-schema/spec"

interface SignalsAdapter {
	create(): {
		sub(): void
		pub(): void
	}
	cleanup(fn: () => void): void
	scoped?(): boolean
}

interface SchemaContext {
	link(
		LinkSchema: StandardSchemaV1
	): Promise<
		AutomergeLinkSchema<StandardSchemaV1.InferOutput<typeof LinkSchema>>
	>
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
		signals: SignalsAdapter
	}
): Promise<StandardSchemaV1.InferOutput<Schema>> {
	type Shape = StandardSchemaV1.InferOutput<Schema>
	const handle = options.repo.find<Shape>(url)
	const schema = options.schema({
		async link<LinkSchema extends StandardSchemaV1>(
			schema: LinkSchema
		): Promise<AutomergeLinkSchema<StandardSchemaV1.InferOutput<LinkSchema>>> {
			console.log({schema}, "in link")
			return {
				type: "automerge-link",
				message: "invalid🙊",
				"~standard": {
					version: 1,
					vendor: "automerge-signals",
					async validate(value) {
						console.log("validating", value)
						if (isValidAutomergeUrl(value)) {
							return {
								value: create<LinkSchema>(value, {
									...options,
									schema: () => schema,
								}),
							}
						} else {
							return {issues: [{message: "did not ⛈️"}]}
						}
					},
				},
			}
		},
	})
	const doc = await schema["~standard"].validate(await handle.doc())
	return doc
}

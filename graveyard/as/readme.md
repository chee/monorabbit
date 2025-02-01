# automerge-signals

```sh
pnpm add automerge-signals
```

```ts
import {Repo} from "@automerge/automerge-repo"
import setup from "automerge-signals"
import solid from "automerge-signals/adapter-solid"
import z from "zod"
const {deep, signal} = setup({adapter: solid})
const repo = new Repo()
const handle = repo.create({
	title: "my project",
	items: [
		repo.create({
			title: "eat cheese",
			complete: new Date(),
		}).url,
		repo.create({
			title: "pet dogs",
		}).url,
	],
})

const view = deep(handle, {
	schema: s => {
		z.object({
			title: z.string(),
			items: z.array(s.link(
                title: z.string(),
                complete: z.date().optional()
            )),
		})
	},
})

view // <- you know it's good, baby, type-checked &c
```

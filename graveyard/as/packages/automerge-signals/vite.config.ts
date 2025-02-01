import {defineConfig} from "vitest/config"
import wasm from "vite-plugin-wasm"
import solid from "vite-plugin-solid"

export default defineConfig({
	plugins: [wasm(), solid()],
	build: {
		target: ["safari18"],
		lib: {
			entry: "./lib/main.ts",
			name: "Automerge Signals",
			fileName: "automerge-signals",
		},
	},
})

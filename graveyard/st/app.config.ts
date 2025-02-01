import {defineConfig} from "@solidjs/start/config"
import unocss from "unocss/vite"
import wasm from "vite-plugin-wasm"

export default defineConfig({
	server: {
		preset: "netlify",
		experimental: {websocket: true},
	},
	vite: {
		plugins: [unocss(), wasm()],
		build: {
			target: "firefox122",
		},
		ssr: {external: ["@prisma/client"]},
	},
}).addRouter({
	name: "ws",
	type: "http",
	handler: "./src/sync-server.ts",
	target: "server",
	base: "/sync",
})

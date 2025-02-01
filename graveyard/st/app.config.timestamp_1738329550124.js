// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import unocss from "unocss/vite";
var app_config_default = defineConfig({
  server: {
    preset: "netlify",
    experimental: { websocket: true }
  },
  vite: {
    plugins: [unocss()],
    ssr: { external: ["@prisma/client"] }
  }
}).addRouter();
export {
  app_config_default as default
};

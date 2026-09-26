import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    ...(process.env["CLOUDFLARE"]
      ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
      : [nitro({ preset: process.env["NETLIFY"] ? "netlify" : "node-server" })]),
    viteReact(),
    tailwindcss(),
  ],
});

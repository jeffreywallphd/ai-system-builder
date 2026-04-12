import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createBrowserRendererAliases } from "./dev/vite/resolveViteAliases";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const browserRendererAliases = createBrowserRendererAliases(REPOSITORY_ROOT);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: browserRendererAliases,
  },
  build: {
    outDir: "dist",
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});


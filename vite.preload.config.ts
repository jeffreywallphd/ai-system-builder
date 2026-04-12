import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import { createSrcAliases } from "./dev/vite/resolveViteAliases";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const srcAliases = createSrcAliases(REPOSITORY_ROOT);

export default defineConfig({
  resolve: {
    alias: srcAliases,
  },
  build: {
    outDir: ".vite/build",
    lib: {
      entry: "electron/preload.ts",
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    rollupOptions: {
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((module) => `node:${module}`),
      ],
    },
  },
});

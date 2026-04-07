import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const srcAliases = [
  { find: "@src", replacement: path.resolve(REPOSITORY_ROOT, "src") },
  { find: "@application", replacement: path.resolve(REPOSITORY_ROOT, "src/application") },
  { find: "@domain", replacement: path.resolve(REPOSITORY_ROOT, "src/domain") },
  { find: "@hosts", replacement: path.resolve(REPOSITORY_ROOT, "src/hosts") },
  { find: "@infrastructure", replacement: path.resolve(REPOSITORY_ROOT, "src/infrastructure") },
  { find: "@shared", replacement: path.resolve(REPOSITORY_ROOT, "src/shared") },
  { find: "@ui", replacement: path.resolve(REPOSITORY_ROOT, "src/ui") },
];

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

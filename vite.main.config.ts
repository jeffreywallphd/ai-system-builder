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
const staticExternalModules = new Set([
  "electron",
  "better-sqlite3",
  "electron-squirrel-startup",
  "sharp",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
]);

function isSharpRuntimeModule(id: string): boolean {
  return (
    id === "sharp" ||
    id.startsWith("sharp/") ||
    id.startsWith("@img/sharp-") ||
    id.startsWith("@img/sharp-libvips-")
  );
}

export default defineConfig({
  resolve: {
    alias: srcAliases,
  },
  build: {
    outDir: ".vite/build",
    lib: {
      entry: "electron/main/main.ts",
      formats: ["es"],
      fileName: () => "main.mjs",
    },
    rollupOptions: {
      external: (id) => staticExternalModules.has(id) || isSharpRuntimeModule(id),
    },
  },
});

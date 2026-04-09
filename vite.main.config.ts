import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import { createSrcAliases } from "./dev/vite/resolveViteAliases";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const srcAliases = createSrcAliases(REPOSITORY_ROOT);
const staticExternalModules = new Set([
  "electron",
  "better-sqlite3",
  "electron-squirrel-startup",
  "sharp",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
]);

function isSharpRuntimeModule(id: string): boolean {
  const normalizedId = id.replace(/\\/g, "/");
  const sanitizedId = normalizedId.split("?")[0];

  return (
    sanitizedId === "sharp" ||
    sanitizedId.startsWith("sharp/") ||
    sanitizedId.includes("/node_modules/sharp/") ||
    sanitizedId.startsWith("@img/sharp-") ||
    sanitizedId.startsWith("@img/sharp-libvips-") ||
    sanitizedId.includes("/node_modules/@img/sharp-") ||
    sanitizedId.includes("/node_modules/@img/sharp-libvips-")
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

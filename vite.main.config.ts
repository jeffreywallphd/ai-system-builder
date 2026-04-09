import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import { createSrcAliases } from "./dev/vite/resolveViteAliases";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const srcAliases = createSrcAliases(REPOSITORY_ROOT);
const staticExternalModules = new Set([
  "electron",
  "electron-squirrel-startup",
  "sharp",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
]);

function isSharpRuntimeModule(id: string): boolean {
  const normalizedId = id.replace(/\\/g, "/");
  const withoutQuery = normalizedId.split("?")[0];
  const sanitizedId = withoutQuery
    .replace(/^\0+/, "")
    .replace(/^commonjs-external:/, "")
    .replace(/^\/@id\//, "");

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

function isBetterSqlite3RuntimeModule(id: string): boolean {
  const normalizedId = id.replace(/\\/g, "/");
  const withoutQuery = normalizedId.split("?")[0];
  const sanitizedId = withoutQuery
    .replace(/^\0+/, "")
    .replace(/^commonjs-external:/, "")
    .replace(/^\/@id\//, "");

  return (
    sanitizedId === "better-sqlite3" ||
    sanitizedId.startsWith("better-sqlite3/") ||
    sanitizedId.includes("/node_modules/better-sqlite3/")
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
      external: (id) =>
        staticExternalModules.has(id) ||
        isSharpRuntimeModule(id) ||
        isBetterSqlite3RuntimeModule(id),
    },
  },
});

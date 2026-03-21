import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      entry: "electron/main/main.ts",
      formats: ["es"],
      fileName: () => "main.mjs",
    },
    rollupOptions: {
      external: [
        "electron",
        "better-sqlite3",
        "electron-squirrel-startup",
        ...builtinModules,
        ...builtinModules.map((module) => `node:${module}`),
      ],
    },
  },
});

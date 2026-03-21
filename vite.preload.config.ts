import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      entry: "electron/preload.ts",
      formats: ["es"],
      fileName: () => "preload.mjs",
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

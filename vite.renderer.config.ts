import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "./modelManagementDependencies",
        replacement: path.resolve(
          REPOSITORY_ROOT,
          "ui/composition/modelManagementDependencies.browser.ts",
        ),
      },
      {
        find: "../../infrastructure/execution/createExecutionInfrastructure",
        replacement: path.resolve(
          REPOSITORY_ROOT,
          "infrastructure/execution/createExecutionInfrastructure.browser.ts",
        ),
      },
      {
        find: "csv-parse/sync",
        replacement: "csv-parse/browser/esm/sync",
      },
    ],
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

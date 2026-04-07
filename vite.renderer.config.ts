import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react()],
  resolve: {
    alias: [
      ...srcAliases,
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

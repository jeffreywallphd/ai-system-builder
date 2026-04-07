import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { AppDistributionTargets, getAppRuntimeProfile } from "./domain/runtime/AppRuntimeProfile";

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

export default defineConfig(async ({ mode }) => {
  const runtimeProfile = getAppRuntimeProfile(mode === "browser" ? "browser-development" : "desktop-development");
  const plugins = [react()];

  if (runtimeProfile.distributionTarget === AppDistributionTargets.viteBrowser) {
    const { createBrowserDevelopmentVitePlugin } = await import(
      "./infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin"
    );
    plugins.push(createBrowserDevelopmentVitePlugin());
  }

  return {
    plugins,
    resolve: {
      alias: runtimeProfile.hostKind === "browser"
        ? [
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
          ]
        : srcAliases,
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
    },
  };
});

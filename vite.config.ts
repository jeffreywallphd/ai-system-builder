import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createBrowserDevelopmentVitePlugin } from "./infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin";
import { AppDistributionTargets, getAppRuntimeProfile } from "./domain/runtime/AppRuntimeProfile";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const runtimeProfile = getAppRuntimeProfile(mode === "browser" ? "browser-development" : "desktop-development");

  return {
    plugins: runtimeProfile.distributionTarget === AppDistributionTargets.viteBrowser
      ? [react(), createBrowserDevelopmentVitePlugin()]
      : [react()],
    resolve: {
      alias: runtimeProfile.hostKind === "browser"
        ? [
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
        : [],
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
    },
  };
});

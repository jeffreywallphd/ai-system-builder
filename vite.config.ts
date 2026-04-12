import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { AppDistributionTargets, getAppRuntimeProfile } from "./src/domain/runtime/AppRuntimeProfile";
import { createBrowserRendererAliases, createSrcAliases } from "./dev/vite/resolveViteAliases";

const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const srcAliases = createSrcAliases(REPOSITORY_ROOT);
const browserRendererAliases = createBrowserRendererAliases(REPOSITORY_ROOT);

export default defineConfig(async ({ mode }) => {
  const runtimeProfile = getAppRuntimeProfile(mode === "browser" ? "browser-development" : "desktop-development");
  const plugins = [react()];

  if (runtimeProfile.distributionTarget === AppDistributionTargets.viteBrowser) {
    const { createBrowserDevelopmentVitePlugin } = await import(
      "./src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin"
    );
    plugins.push(createBrowserDevelopmentVitePlugin());
  }

  return {
    plugins,
    resolve: {
      alias: runtimeProfile.hostKind === "browser" ? browserRendererAliases : srcAliases,
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
    },
  };
});


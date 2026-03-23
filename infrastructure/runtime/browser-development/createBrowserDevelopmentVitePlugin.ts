import process from "node:process";
import type { Plugin } from "vite";
import {
  resolveBrowserDevelopmentManagedRuntimeFromEnvironment,
} from "./BrowserDevelopmentManagedRuntime";

export function createBrowserDevelopmentVitePlugin(): Plugin {
  const managedRuntime = resolveBrowserDevelopmentManagedRuntimeFromEnvironment();
  let cleanupRegistered = false;

  const registerCleanup = (stop: () => void, closeServer?: { once(event: "close", listener: () => void): void }) => {
    if (cleanupRegistered) {
      return;
    }

    cleanupRegistered = true;
    closeServer?.once("close", stop);
    process.once("exit", stop);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  };

  return {
    name: "ai-loom-browser-development-runtime",
    apply: "serve",
    async configureServer(server) {
      await managedRuntime.ensureStarted(server.config.logger);
      registerCleanup(() => managedRuntime.stop(), server.httpServer);
    },
  };
}

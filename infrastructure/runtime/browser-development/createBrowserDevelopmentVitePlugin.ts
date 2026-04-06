import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../config/HostSecureTransportConfig";
import {
  startIdentityServerHost,
  type IdentityServerHost,
} from "../../../hosts/server/IdentityServerHost";
import {
  resolveBrowserDevelopmentManagedRuntimeFromEnvironment,
} from "./BrowserDevelopmentManagedRuntime";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BROWSER_IDENTITY_DATABASE_PATH = path.resolve(
  REPOSITORY_ROOT,
  "dev",
  "identity",
  "identity.sqlite",
);

export function createBrowserDevelopmentVitePlugin(): Plugin {
  const managedRuntime = resolveBrowserDevelopmentManagedRuntimeFromEnvironment();
  const identityHostAddress = process.env.AI_LOOM_BROWSER_IDENTITY_HOST || "127.0.0.1";
  const requestedIdentityHostPort = parseOptionalPort(process.env.AI_LOOM_BROWSER_IDENTITY_PORT);
  const identitySecureTransport = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.worker,
    hostAddress: identityHostAddress,
  });
  let identityApiBaseUrl: string | undefined;
  let identityServerHost: IdentityServerHost | undefined;
  let cleanupRegistered = false;

  const stopAll = () => {
    if (identityServerHost) {
      void identityServerHost.close().catch(() => {});
      identityServerHost = undefined;
    }
    managedRuntime.stop();
  };

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
      if (!identityServerHost) {
        identityServerHost = await startIdentityServerHost({
          databasePath: BROWSER_IDENTITY_DATABASE_PATH,
          host: identityHostAddress,
          port: requestedIdentityHostPort,
        });
        identityApiBaseUrl = assertSecureTransportEndpoint(
          `http://${identityHostAddress}:${identityServerHost.port}`,
          identitySecureTransport,
        );
      }
      registerCleanup(stopAll, server.httpServer);
    },
    transformIndexHtml(html) {
      if (!identityApiBaseUrl) {
        return html;
      }

      const bootstrapScript = `<script>window.aiLoomBrowserDevelopment=Object.assign({},window.aiLoomBrowserDevelopment,{env:Object.assign({},window.aiLoomBrowserDevelopment?.env,${JSON.stringify({
        VITE_IDENTITY_API_BASE_URL: identityApiBaseUrl,
      })})});</script>`;

      if (html.includes("</head>")) {
        return html.replace("</head>", `${bootstrapScript}</head>`);
      }

      return `${bootstrapScript}${html}`;
    },
  };
}

function parseOptionalPort(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid AI_LOOM_BROWSER_IDENTITY_PORT value '${value}'.`);
  }
  return parsed;
}

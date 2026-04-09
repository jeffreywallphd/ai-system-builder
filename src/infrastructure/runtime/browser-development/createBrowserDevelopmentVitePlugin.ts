import process from "node:process";
import path from "node:path";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import type { Plugin } from "vite";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../config/HostSecureTransportConfig";
import {
  resolveBrowserDevelopmentManagedRuntimeFromEnvironment,
} from "./BrowserDevelopmentManagedRuntime";
import { BROWSER_DEVELOPMENT_REPOSITORY_ROOT } from "./BrowserDevelopmentPaths";

const REPOSITORY_ROOT = BROWSER_DEVELOPMENT_REPOSITORY_ROOT;
const BROWSER_IDENTITY_DATABASE_PATH = path.resolve(
  REPOSITORY_ROOT,
  "dev",
  "identity",
  "identity.sqlite",
);
const BrowserDevelopmentAuthoritativeStartupReason = "browser-development-vite-authoritative-host-startup";
const AUTHORITATIVE_SERVER_READY_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;

export interface BrowserDevelopmentAuthoritativeServerHostEntrypointOptions {
  readonly hostOptions: {
    readonly databasePath: string;
    readonly host: string;
    readonly port?: number;
    readonly cors?: {
      readonly allowLoopbackOrigins?: boolean;
    };
    readonly env?: Readonly<Record<string, string | undefined>>;
  };
  readonly boot?: {
    readonly startupReason?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
  };
}

export interface BrowserDevelopmentAuthoritativeServerOptionsInput {
  readonly databasePath: string;
  readonly host: string;
  readonly port?: number;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

export function createBrowserDevelopmentAuthoritativeServerHostOptions(
  input: BrowserDevelopmentAuthoritativeServerOptionsInput,
): BrowserDevelopmentAuthoritativeServerHostEntrypointOptions {
  const environment = input.environment ?? process.env;
  return Object.freeze({
    hostOptions: Object.freeze({
      databasePath: input.databasePath,
      host: input.host,
      port: input.port,
      cors: {
        allowLoopbackOrigins: true,
      },
      env: environment,
    }),
    boot: Object.freeze({
      startupReason: BrowserDevelopmentAuthoritativeStartupReason,
      environment,
    }),
  });
}

export function createBrowserDevelopmentVitePlugin(): Plugin {
  const managedRuntime = resolveBrowserDevelopmentManagedRuntimeFromEnvironment();
  const identityHostAddress = process.env.AI_LOOM_BROWSER_IDENTITY_HOST || "127.0.0.1";
  const requestedIdentityHostPort = parseOptionalPort(process.env.AI_LOOM_BROWSER_IDENTITY_PORT) ?? 8788;
  const authoritativeHostOptions = createBrowserDevelopmentAuthoritativeServerHostOptions({
    databasePath: BROWSER_IDENTITY_DATABASE_PATH,
    host: identityHostAddress,
    port: requestedIdentityHostPort,
    environment: process.env,
  });
  const identitySecureTransport = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.worker,
    hostAddress: identityHostAddress,
  });
  let identityApiBaseUrl: string | undefined;
  let authoritativeServerProcess: ChildProcess | undefined;
  let cleanupRegistered = false;

  const stopAll = () => {
    if (authoritativeServerProcess && !authoritativeServerProcess.killed) {
      authoritativeServerProcess.kill("SIGTERM");
      authoritativeServerProcess = undefined;
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

      const serverAlreadyRunning = await canConnectToPort(requestedIdentityHostPort, identityHostAddress);
      if (!serverAlreadyRunning) {
        authoritativeServerProcess = startBrowserDevelopmentAuthoritativeServerHost(authoritativeHostOptions);
        await waitForPort(
          requestedIdentityHostPort,
          identityHostAddress,
          AUTHORITATIVE_SERVER_READY_TIMEOUT_MS,
          () => assertProcessAlive(authoritativeServerProcess),
        );
      }

      identityApiBaseUrl = assertSecureTransportEndpoint(
        `http://${identityHostAddress}:${requestedIdentityHostPort}`,
        identitySecureTransport,
      );
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

function startBrowserDevelopmentAuthoritativeServerHost(
  options: BrowserDevelopmentAuthoritativeServerHostEntrypointOptions,
): ChildProcess {
  const env = normalizeChildProcessEnvironment({
    ...process.env,
    ...options.hostOptions.env,
    ...options.boot?.environment,
    AI_LOOM_SERVER_DATABASE_PATH: options.hostOptions.databasePath,
    AI_LOOM_SERVER_HOST: options.hostOptions.host,
    AI_LOOM_SERVER_PORT: String(options.hostOptions.port ?? 8788),
  });

  const command = resolveNpmCommand();

  return spawn(command.executable, command.args, {
    cwd: REPOSITORY_ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
}

interface NpmCommand {
  readonly executable: string;
  readonly args: readonly string[];
}

function resolveNpmCommand(): NpmCommand {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) {
    return {
      executable: process.execPath,
      args: [npmExecPath, "run", "start:authoritative-server"],
    };
  }

  return {
    executable: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "start:authoritative-server"],
  };
}

function normalizeChildProcessEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => {
      if (value === undefined || value === null) {
        return [];
      }
      return [[key, String(value)]];
    }),
  );
}

function assertProcessAlive(processHandle: ChildProcess | undefined): void {
  if (!processHandle) {
    throw new Error("Authoritative browser-development host process did not start.");
  }

  if (processHandle.exitCode !== null || processHandle.signalCode !== null) {
    throw new Error(
      `Authoritative browser-development host exited before becoming ready (exitCode=${processHandle.exitCode}, signal=${processHandle.signalCode ?? "none"}).`,
    );
  }
}

async function waitForPort(
  port: number,
  host: string,
  timeoutMs: number,
  onPoll?: () => void,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    onPoll?.();
    if (await canConnectToPort(port, host)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for browser-development authoritative host on ${host}:${port} after ${timeoutMs}ms.`);
}

async function canConnectToPort(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

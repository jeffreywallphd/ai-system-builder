import process from "node:process";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
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
const AUTHORITATIVE_BUN_MISSING_WARNING =
  "[ai-loom] bun is not available on PATH; starting browser-development authoritative host in-process.";

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
  let authoritativeServerStopInProcess: (() => void) | undefined;
  let cleanupRegistered = false;

  const stopAll = () => {
    if (authoritativeServerStopInProcess) {
      authoritativeServerStopInProcess();
      authoritativeServerStopInProcess = undefined;
    }
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
        const authoritativeServerHandle = await startBrowserDevelopmentAuthoritativeServerHost(
          authoritativeHostOptions,
          (message) => server.config.logger.warn(message),
        );
        authoritativeServerProcess = authoritativeServerHandle.process;
        authoritativeServerStopInProcess = authoritativeServerHandle.stopInProcess;
        await waitForPort(
          requestedIdentityHostPort,
          identityHostAddress,
          AUTHORITATIVE_SERVER_READY_TIMEOUT_MS,
          authoritativeServerHandle.assertAlive,
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
  logWarning?: (message: string) => void,
): Promise<BrowserDevelopmentAuthoritativeServerHostHandle> {
  if (!canExecuteBun()) {
    logWarning?.(AUTHORITATIVE_BUN_MISSING_WARNING);
    return startBrowserDevelopmentAuthoritativeServerHostInProcess(options);
  }

  const env = normalizeChildProcessEnvironment({
    ...process.env,
    ...options.hostOptions.env,
    ...options.boot?.environment,
    AI_LOOM_SERVER_DATABASE_PATH: options.hostOptions.databasePath,
    AI_LOOM_SERVER_HOST: options.hostOptions.host,
    AI_LOOM_SERVER_PORT: String(options.hostOptions.port ?? 8788),
  });

  const command = resolveNpmCommand();
  const processHandle = spawn(command.executable, command.args, {
    cwd: REPOSITORY_ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
  });

  return Promise.resolve({
    process: processHandle,
    assertAlive: () => assertProcessAlive(processHandle),
    stopInProcess: undefined,
  });
}

interface BrowserDevelopmentAuthoritativeServerHostHandle {
  readonly process: ChildProcess | undefined;
  readonly assertAlive: () => void;
  readonly stopInProcess: (() => void) | undefined;
}

interface BrowserDevelopmentAuthoritativeServerEntrypointModule {
  startAuthoritativeServerHostAssembly(
    options: BrowserDevelopmentAuthoritativeServerHostEntrypointOptions,
  ): Promise<unknown>;
}

async function startBrowserDevelopmentAuthoritativeServerHostInProcess(
  options: BrowserDevelopmentAuthoritativeServerHostEntrypointOptions,
): Promise<BrowserDevelopmentAuthoritativeServerHostHandle> {
  let runtimeHandle: unknown;
  let startupError: Error | undefined;
  let stopping = false;

  void import("../../../hosts/server/AuthoritativeServerHostEntrypoint")
    .then((module) => {
      const entrypoint = module as BrowserDevelopmentAuthoritativeServerEntrypointModule;
      return entrypoint.startAuthoritativeServerHostAssembly(options);
    })
    .then((runtime) => {
      runtimeHandle = runtime;
    })
    .catch((error: unknown) => {
      startupError = error instanceof Error ? error : new Error(String(error));
    });

  return {
    process: undefined,
    assertAlive: () => {
      if (startupError) {
        throw new Error(
          `Authoritative browser-development host failed to start in-process: ${startupError.message}`,
        );
      }
    },
    stopInProcess: () => {
      if (stopping) {
        return;
      }
      stopping = true;
      const runtime = runtimeHandle;
      runtimeHandle = undefined;
      if (runtime && typeof runtime === "object" && "stop" in runtime && typeof runtime.stop === "function") {
        const stopResult = runtime.stop();
        if (stopResult && typeof stopResult === "object" && "then" in stopResult && typeof stopResult.then === "function") {
          void stopResult;
        }
      }
    },
  };
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

function canExecuteBun(): boolean {
  const candidates = process.platform === "win32" ? ["bun.exe", "bun.cmd", "bun"] : ["bun"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], {
      cwd: REPOSITORY_ROOT,
      stdio: "ignore",
      windowsHide: true,
    });
    if (probe.status === 0) {
      return true;
    }
  }
  return false;
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

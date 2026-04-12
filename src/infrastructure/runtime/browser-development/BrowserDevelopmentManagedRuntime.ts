import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../config/HostSecureTransportConfig";
import { BROWSER_DEVELOPMENT_REPOSITORY_ROOT } from "./BrowserDevelopmentPaths";

const REPOSITORY_ROOT = BROWSER_DEVELOPMENT_REPOSITORY_ROOT;
const SUPERVISOR_ENTRYPOINT = path.resolve(REPOSITORY_ROOT, "src/infrastructure/runtime/service-supervisor.js");
const PYTHON_RUNTIME_WORKDIR = path.resolve(REPOSITORY_ROOT, "python-runtime");
const MCP_WORKSPACE_ROOT = path.resolve(REPOSITORY_ROOT, "user", "workflow-data", "mcp");
const SUPERVISOR_DEFINITIONS_PATH = path.resolve(REPOSITORY_ROOT, ".ai-loom-studio", "browser-dev-managed-services.json");
const SUPERVISOR_READY_TIMEOUT_MS = 10_000;
const PYTHON_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

export interface BrowserDevelopmentManagedRuntimeOptions {
  readonly supervisorPort: number;
  readonly supervisorHost: string;
  readonly pythonRuntimePort: number;
  readonly autostartEnabled: boolean;
}

export interface BrowserDevelopmentManagedRuntimeLogger {
  info(message: string): void;
  warn(message: string): void;
}

interface ManagedServiceLogEntry {
  readonly timestamp?: string;
  readonly level?: string;
  readonly message?: string;
}

interface ManagedServiceSnapshot {
  readonly serviceId?: string;
  readonly name?: string;
  readonly state?: string;
  readonly detail?: string;
  readonly diagnostics?: {
    readonly provisioning?: {
      readonly state?: string;
      readonly environmentPath?: string | null;
      readonly requestedVersion?: string | null;
      readonly resolvedVersion?: string | null;
      readonly lastError?: {
        readonly message?: string;
        readonly code?: string | null;
      } | null;
    };
  };
  readonly recentLogs?: ReadonlyArray<ManagedServiceLogEntry>;
}

export class BrowserDevelopmentManagedRuntime {
  private supervisorProcess: ChildProcess | undefined;

  constructor(private readonly options: BrowserDevelopmentManagedRuntimeOptions) {}

  public async ensureStarted(logger: BrowserDevelopmentManagedRuntimeLogger): Promise<void> {
    if (!this.options.autostartEnabled) {
      return;
    }

    if (await this.canConnectToPort(this.options.supervisorPort, this.options.supervisorHost)) {
      logger.info(
        `[ai-loom] managed service supervisor already available on http://${this.options.supervisorHost}:${this.options.supervisorPort}; ensuring python runtime.`,
      );
    } else {
      this.supervisorProcess = spawn(process.execPath, [SUPERVISOR_ENTRYPOINT], {
        cwd: REPOSITORY_ROOT,
        env: this.buildSupervisorEnvironment(),
        stdio: "inherit",
      });

      this.supervisorProcess.once("exit", () => {
        this.supervisorProcess = undefined;
      });

      logger.info(
        `[ai-loom] auto-started managed service supervisor on http://${this.options.supervisorHost}:${this.options.supervisorPort}.`,
      );
    }

    try {
      await this.ensureManagedPythonRuntime(logger);
    } catch (error) {
      logger.warn(
        `[ai-loom] browser dev runtime bootstrap warning: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public stop(): void {
    if (!this.supervisorProcess || this.supervisorProcess.killed) {
      return;
    }

    this.supervisorProcess.kill("SIGTERM");
    this.supervisorProcess = undefined;
  }

  private resolvePythonExecutable(): string {
    const explicit = process.env.PYTHON_RUNTIME_EXECUTABLE?.trim();
    if (explicit) {
      return explicit;
    }

    const candidates = process.platform === "win32"
      ? [
          path.join(PYTHON_RUNTIME_WORKDIR, ".venv", "Scripts", "python.exe"),
          path.join(PYTHON_RUNTIME_WORKDIR, "venv", "Scripts", "python.exe"),
        ]
      : [
          path.join(PYTHON_RUNTIME_WORKDIR, ".venv", "bin", "python"),
          path.join(PYTHON_RUNTIME_WORKDIR, "venv", "bin", "python"),
        ];

    if (process.platform === "win32") {
      return candidates.find((candidate) => existsSync(candidate)) ?? "py";
    }

    return candidates.find((candidate) => existsSync(candidate)) ?? "python";
  }

  private buildSupervisorEnvironment(): NodeJS.ProcessEnv {
    const pythonExecutable = this.resolvePythonExecutable();

    return {
      ...process.env,
      SERVICE_SUPERVISOR_HOST: this.options.supervisorHost,
      SERVICE_SUPERVISOR_PORT: String(this.options.supervisorPort),
      SERVICE_SUPERVISOR_DEFINITIONS_PATH: process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH || SUPERVISOR_DEFINITIONS_PATH,
      SERVICE_SUPERVISOR_ALLOWED_PATHS: process.env.SERVICE_SUPERVISOR_ALLOWED_PATHS || JSON.stringify([
        REPOSITORY_ROOT,
        PYTHON_RUNTIME_WORKDIR,
        MCP_WORKSPACE_ROOT,
        path.dirname(SUPERVISOR_DEFINITIONS_PATH),
      ]),
      PYTHON_RUNTIME_MODE: process.env.PYTHON_RUNTIME_MODE || "managed-local",
      PYTHON_RUNTIME_BASE_URL: process.env.PYTHON_RUNTIME_BASE_URL || `http://${this.options.supervisorHost}:${this.options.pythonRuntimePort}`,
      PYTHON_RUNTIME_WORKDIR: process.env.PYTHON_RUNTIME_WORKDIR || PYTHON_RUNTIME_WORKDIR,
      PYTHON_RUNTIME_EXECUTABLE: pythonExecutable,
      PYTHON_RUNTIME_AUTO_START: process.env.PYTHON_RUNTIME_AUTO_START || "true",
      PYTHON_RUNTIME_ENV_JSON: process.env.PYTHON_RUNTIME_ENV_JSON || JSON.stringify({
        MCP_RUNTIME_ENABLED: "true",
        MCP_RUNTIME_CONNECT_ON_STARTUP: "true",
        MCP_RUNTIME_WORKSPACE_ROOT: MCP_WORKSPACE_ROOT,
        MCP_RUNTIME_PYTHON_EXECUTABLE: pythonExecutable,
        MCP_RUNTIME_BOOTSTRAP_DEFAULT_SERVER: "true",
      }),
    };
  }

  private async ensureManagedPythonRuntime(logger: BrowserDevelopmentManagedRuntimeLogger): Promise<void> {
    try {
      await this.waitForPort(this.options.supervisorPort, this.options.supervisorHost, SUPERVISOR_READY_TIMEOUT_MS);
      logger.info("[ai-loom] provisioning browser dev Python runtime environment.");
      await this.requestSupervisorAction("provision");
      logger.info("[ai-loom] ensuring browser dev Python runtime is running.");
      const ensureRunning = await this.requestSupervisorAction("ensure-running");
      this.assertManagedRuntimeStarted(ensureRunning);
      await this.waitForPort(
        this.options.pythonRuntimePort,
        this.options.supervisorHost,
        PYTHON_READY_TIMEOUT_MS,
        async () => this.assertRuntimeNotFailed(await this.fetchPythonRuntimeSnapshot()),
      );
      logger.info(
        `[ai-loom] python runtime ready on http://${this.options.supervisorHost}:${this.options.pythonRuntimePort} with MCP runtime auto-connect enabled.`,
      );
    } catch (error) {
      await this.logPythonRuntimeDiagnostics(logger, error);
      throw error;
    }
  }

  private async requestSupervisorAction(action: "provision" | "ensure-running"): Promise<ManagedServiceSnapshot | undefined> {
    const supervisorBaseUrl = `http://${this.options.supervisorHost}:${this.options.supervisorPort}`;
    const response = await fetch(`${supervisorBaseUrl}/services/python-runtime/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({})) as { service?: ManagedServiceSnapshot };
    if (!response.ok) {
      const body = JSON.stringify(payload);
      throw new Error(
        `Managed service supervisor could not ${action} the python-runtime service (${response.status})${body ? `: ${body}` : "."}`,
      );
    }

    return payload.service;
  }

  private assertManagedRuntimeStarted(snapshot: ManagedServiceSnapshot | undefined): void {
    if (!snapshot) {
      return;
    }

    if (snapshot.state === "healthy" || snapshot.state === "starting") {
      return;
    }

    const provisioningState = snapshot.diagnostics?.provisioning?.state;
    const provisioningError = snapshot.diagnostics?.provisioning?.lastError;
    const rootCause = provisioningError?.message ?? snapshot.detail ?? "Runtime startup failed before health endpoint became available.";
    const detail = provisioningState
      ? `supervisorState=${snapshot.state ?? "unknown"}, provisioningState=${provisioningState}`
      : `supervisorState=${snapshot.state ?? "unknown"}`;
    throw new Error(`Python runtime did not enter a startable state (${detail}): ${rootCause}`);
  }

  private async fetchPythonRuntimeSnapshot(): Promise<ManagedServiceSnapshot | undefined> {
    const supervisorBaseUrl = `http://${this.options.supervisorHost}:${this.options.supervisorPort}`;
    const response = await fetch(`${supervisorBaseUrl}/services/python-runtime`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
    });
    if (!response.ok) {
      return undefined;
    }
    const payload = await response.json() as { service?: ManagedServiceSnapshot };
    return payload.service;
  }

  private assertRuntimeNotFailed(snapshot: ManagedServiceSnapshot | undefined): void {
    if (!snapshot) {
      return;
    }

    if (snapshot.state === "failed" || snapshot.state === "stopped" || snapshot.state === "unavailable") {
      const provisioningState = snapshot.diagnostics?.provisioning?.state;
      const provisioningError = snapshot.diagnostics?.provisioning?.lastError;
      const detail = snapshot.detail ?? provisioningError?.message ?? "Python runtime startup failed before becoming healthy.";
      throw new Error(
        `Python runtime startup failed (supervisorState=${snapshot.state}${provisioningState ? `, provisioningState=${provisioningState}` : ""}): ${detail}`,
      );
    }
  }

  private async logPythonRuntimeDiagnostics(logger: BrowserDevelopmentManagedRuntimeLogger, cause: unknown): Promise<void> {
    logger.warn(
      `[ai-loom] python runtime bootstrap failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );

    try {
      const snapshot = await this.fetchPythonRuntimeSnapshot();
      if (!snapshot) {
        logger.warn("[ai-loom] python runtime diagnostics unavailable: supervisor returned no service snapshot.");
        return;
      }

      const provisioning = snapshot.diagnostics?.provisioning;
      const provisioningStatus = [
        `state=${provisioning?.state ?? "unknown"}`,
        `requested=${provisioning?.requestedVersion ?? "unknown"}`,
        `resolved=${provisioning?.resolvedVersion ?? "unknown"}`,
      ].join(", ");
      logger.warn(`[ai-loom] python runtime status: state=${snapshot.state ?? "unknown"}; detail=${snapshot.detail ?? "n/a"}.`);
      logger.warn(`[ai-loom] python runtime provisioning: ${provisioningStatus}.`);

      if (provisioning?.environmentPath) {
        logger.warn(`[ai-loom] python runtime environment path: ${provisioning.environmentPath}`);
      }

      const provisioningError = provisioning?.lastError;
      if (provisioningError?.message) {
        logger.warn(
          `[ai-loom] python runtime provisioning error${provisioningError.code ? ` (${provisioningError.code})` : ""}: ${provisioningError.message}`,
        );
      }

      const logTail = snapshot.recentLogs?.slice(-12) ?? [];
      if (logTail.length > 0) {
        logger.warn("[ai-loom] python runtime recent logs (tail):");
        for (const entry of logTail) {
          const timestamp = entry.timestamp ?? "unknown-time";
          const level = entry.level ?? "info";
          const message = entry.message ?? "(empty)";
          logger.warn(`[ai-loom] [python-runtime:${level}] ${timestamp} ${message}`);
        }
      } else {
        logger.warn("[ai-loom] python runtime recent logs are empty.");
      }
    } catch (diagnosticError) {
      logger.warn(
        `[ai-loom] python runtime diagnostics collection failed: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`,
      );
    }
  }

  private async waitForPort(
    port: number,
    host: string,
    timeoutMs: number,
    onPoll?: () => Promise<void>,
  ): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (onPoll) {
        await onPoll();
      }
      if (await this.canConnectToPort(port, host)) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`Timed out waiting for ${host}:${port} after ${timeoutMs}ms.`);
  }

  private async canConnectToPort(port: number, host = "127.0.0.1"): Promise<boolean> {
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
}

export function resolveBrowserDevelopmentManagedRuntimeFromEnvironment(): BrowserDevelopmentManagedRuntime {
  const supervisorHost = process.env.SERVICE_SUPERVISOR_HOST || "127.0.0.1";
  const supervisorPort = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
  const secureTransportConfig = resolveHostSecureTransportConfig({
    hostKind: HostSecureTransportKinds.worker,
    hostAddress: supervisorHost,
  });
  assertSecureTransportEndpoint(`http://${supervisorHost}:${supervisorPort}`, secureTransportConfig);

  return new BrowserDevelopmentManagedRuntime({
    supervisorPort,
    supervisorHost,
    pythonRuntimePort: Number(process.env.PYTHON_RUNTIME_PORT || 8100),
    autostartEnabled: process.env.AI_LOOM_SERVICE_SUPERVISOR_AUTOSTART !== "false",
  });
}


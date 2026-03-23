import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SUPERVISOR_ENTRYPOINT = path.resolve(REPOSITORY_ROOT, "infrastructure/runtime/service-supervisor.js");
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
    await this.waitForPort(this.options.supervisorPort, this.options.supervisorHost, SUPERVISOR_READY_TIMEOUT_MS);
    logger.info("[ai-loom] provisioning browser dev Python runtime environment.");
    await this.requestSupervisorAction("provision");
    logger.info("[ai-loom] ensuring browser dev Python runtime is running.");
    await this.requestSupervisorAction("ensure-running");
    await this.waitForPort(this.options.pythonRuntimePort, this.options.supervisorHost, PYTHON_READY_TIMEOUT_MS);
    logger.info(
      `[ai-loom] python runtime ready on http://${this.options.supervisorHost}:${this.options.pythonRuntimePort} with MCP runtime auto-connect enabled.`,
    );
  }

  private async requestSupervisorAction(action: "provision" | "ensure-running"): Promise<void> {
    const supervisorBaseUrl = `http://${this.options.supervisorHost}:${this.options.supervisorPort}`;
    const response = await fetch(`${supervisorBaseUrl}/services/python-runtime/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Managed service supervisor could not ${action} the python-runtime service (${response.status})${body ? `: ${body}` : "."}`,
      );
    }
  }

  private async waitForPort(port: number, host: string, timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
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
  return new BrowserDevelopmentManagedRuntime({
    supervisorPort: Number(process.env.SERVICE_SUPERVISOR_PORT || 8790),
    supervisorHost: process.env.SERVICE_SUPERVISOR_HOST || "127.0.0.1",
    pythonRuntimePort: Number(process.env.PYTHON_RUNTIME_PORT || 8100),
    autostartEnabled: process.env.AI_LOOM_SERVICE_SUPERVISOR_AUTOSTART !== "false",
  });
}

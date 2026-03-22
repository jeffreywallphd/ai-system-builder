import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig, type Logger, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const SUPERVISOR_PORT = Number(process.env.SERVICE_SUPERVISOR_PORT || 8790);
const SUPERVISOR_HOST = process.env.SERVICE_SUPERVISOR_HOST || "127.0.0.1";
const PYTHON_RUNTIME_PORT = Number(process.env.PYTHON_RUNTIME_PORT || 8100);
const SUPERVISOR_AUTOSTART_ENABLED = process.env.AI_LOOM_SERVICE_SUPERVISOR_AUTOSTART !== "false";
const REPOSITORY_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SUPERVISOR_ENTRYPOINT = path.resolve(REPOSITORY_ROOT, "infrastructure/runtime/service-supervisor.js");
const PYTHON_RUNTIME_WORKDIR = path.resolve(REPOSITORY_ROOT, "python-runtime");
const MCP_WORKSPACE_ROOT = path.resolve(REPOSITORY_ROOT, "user", "workflow-data", "mcp");
const SUPERVISOR_DEFINITIONS_PATH = path.resolve(REPOSITORY_ROOT, ".ai-loom-studio", "browser-dev-managed-services.json");
const SUPERVISOR_READY_TIMEOUT_MS = 10_000;
const PYTHON_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

function canConnectToPort(port: number, host = "127.0.0.1"): Promise<boolean> {
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

function resolvePythonExecutable(): string {
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

function buildSupervisorEnvironment(): NodeJS.ProcessEnv {
  const pythonExecutable = resolvePythonExecutable();

  return {
    ...process.env,
    SERVICE_SUPERVISOR_HOST: SUPERVISOR_HOST,
    SERVICE_SUPERVISOR_PORT: String(SUPERVISOR_PORT),
    SERVICE_SUPERVISOR_DEFINITIONS_PATH: process.env.SERVICE_SUPERVISOR_DEFINITIONS_PATH || SUPERVISOR_DEFINITIONS_PATH,
    SERVICE_SUPERVISOR_ALLOWED_PATHS: process.env.SERVICE_SUPERVISOR_ALLOWED_PATHS || JSON.stringify([
      REPOSITORY_ROOT,
      PYTHON_RUNTIME_WORKDIR,
      MCP_WORKSPACE_ROOT,
      path.dirname(SUPERVISOR_DEFINITIONS_PATH),
    ]),
    PYTHON_RUNTIME_MODE: process.env.PYTHON_RUNTIME_MODE || "managed-local",
    PYTHON_RUNTIME_BASE_URL: process.env.PYTHON_RUNTIME_BASE_URL || `http://${SUPERVISOR_HOST}:${PYTHON_RUNTIME_PORT}`,
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

async function waitForPort(port: number, host: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnectToPort(port, host)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for ${host}:${port} after ${timeoutMs}ms.`);
}

async function requestSupervisorAction(action: "provision" | "ensure-running"): Promise<void> {
  const supervisorBaseUrl = `http://${SUPERVISOR_HOST}:${SUPERVISOR_PORT}`;
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

async function ensureManagedPythonRuntime(logger: Logger): Promise<void> {
  await waitForPort(SUPERVISOR_PORT, SUPERVISOR_HOST, SUPERVISOR_READY_TIMEOUT_MS);
  logger.info("[ai-loom] provisioning browser dev Python runtime environment.");
  await requestSupervisorAction("provision");
  logger.info("[ai-loom] ensuring browser dev Python runtime is running.");
  await requestSupervisorAction("ensure-running");
  await waitForPort(PYTHON_RUNTIME_PORT, SUPERVISOR_HOST, PYTHON_READY_TIMEOUT_MS);
  logger.info(
    `[ai-loom] python runtime ready on http://${SUPERVISOR_HOST}:${PYTHON_RUNTIME_PORT} with MCP runtime auto-connect enabled.`,
  );
}

function managedServiceSupervisorPlugin(): Plugin {
  let supervisorProcess: ChildProcess | undefined;
  let cleanupRegistered = false;

  const stopSupervisor = () => {
    if (!supervisorProcess || supervisorProcess.killed) {
      return;
    }

    supervisorProcess.kill("SIGTERM");
    supervisorProcess = undefined;
  };

  return {
    name: "ai-loom-managed-service-supervisor",
    apply: "serve",
    async configureServer(server) {
      if (!SUPERVISOR_AUTOSTART_ENABLED || supervisorProcess) {
        return;
      }

      if (await canConnectToPort(SUPERVISOR_PORT, SUPERVISOR_HOST)) {
        server.config.logger.info(
          `[ai-loom] managed service supervisor already available on http://${SUPERVISOR_HOST}:${SUPERVISOR_PORT}; ensuring python runtime.`,
        );
      } else {
        supervisorProcess = spawn(process.execPath, [SUPERVISOR_ENTRYPOINT], {
          cwd: REPOSITORY_ROOT,
          env: buildSupervisorEnvironment(),
          stdio: "inherit",
        });

        supervisorProcess.once("exit", () => {
          supervisorProcess = undefined;
        });

        server.config.logger.info(
          `[ai-loom] auto-started managed service supervisor on http://${SUPERVISOR_HOST}:${SUPERVISOR_PORT}.`,
        );
      }

      try {
        await ensureManagedPythonRuntime(server.config.logger);
      } catch (error) {
        server.config.logger.warn(
          `[ai-loom] browser dev runtime bootstrap warning: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!cleanupRegistered) {
        cleanupRegistered = true;
        server.httpServer?.once("close", stopSupervisor);
        process.once("exit", stopSupervisor);
        process.once("SIGINT", stopSupervisor);
        process.once("SIGTERM", stopSupervisor);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === "browser" ? [react(), managedServiceSupervisorPlugin()] : [react()],
  resolve: {
    alias: mode === "browser"
      ? [
          {
            find: "./modelManagementDependencies",
            replacement: path.resolve(
              REPOSITORY_ROOT,
              "ui/composition/modelManagementDependencies.browser.ts",
            ),
          },
        ]
      : [],
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
  },
}));

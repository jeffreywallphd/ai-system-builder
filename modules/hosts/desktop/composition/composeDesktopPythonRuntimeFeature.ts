import type { LoggingPort } from "../../../application/ports/logging";
import type { DesktopPythonRuntimeLogEntry, DesktopPythonRuntimeStatusPayload } from "../../../contracts/ipc";
import { PYTHON_RUNTIME_DATASET_PREPARATION_REQUIRED_CAPABILITIES } from "../../../contracts/runtime";
import { resolvePythonRuntimeBaseUrl, resolvePythonRuntimeHostAndPort, classifyPythonRuntimeStdioLogLevel } from "./composeDesktopHost";

const PYTHON_RUNTIME_STARTUP_TIMEOUT_MS_DEFAULT = 60_000;

export interface DesktopPythonRuntimeFeature {
  supervisor: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    restart: () => Promise<void>;
    getStatus: () => string;
  };
  runtimePort: any;
}

export interface ComposeDesktopPythonRuntimeFeatureOptions {
  loggingPort: LoggingPort;
  now: () => string;
  runtimeLogs: DesktopPythonRuntimeLogEntry[];
  recordRuntimeLog: (entry: Omit<DesktopPythonRuntimeLogEntry, "timestamp"> & { timestamp?: string }) => void;
}

export async function composeDesktopPythonRuntimeFeature(options: ComposeDesktopPythonRuntimeFeatureOptions): Promise<DesktopPythonRuntimeFeature> {
  const { createPythonRuntimeAdapterFoundation, ensurePythonRuntimeWorkerDependencies } = await import("../../../adapters/runtime/python");
  const pythonRuntimeEndpoint = resolvePythonRuntimeHostAndPort();
  const pythonRuntimeBaseUrl = resolvePythonRuntimeBaseUrl();
  const configuredPythonRuntimeStartupTimeoutMs = Number(process.env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS);
  const pythonRuntimeStartupTimeoutMs = Number.isFinite(configuredPythonRuntimeStartupTimeoutMs) && configuredPythonRuntimeStartupTimeoutMs > 0
    ? configuredPythonRuntimeStartupTimeoutMs
    : PYTHON_RUNTIME_STARTUP_TIMEOUT_MS_DEFAULT;
  const pythonRuntimeEnvironment = {
    ...process.env,
    PYTHON_RUNTIME_HOST: pythonRuntimeEndpoint.host,
    PYTHON_RUNTIME_PORT: pythonRuntimeEndpoint.port,
    ...(process.env.HF_HUB_DISABLE_XET ? { HF_HUB_DISABLE_XET: process.env.HF_HUB_DISABLE_XET } : {}),
    HF_HUB_DISABLE_SYMLINKS_WARNING: process.env.HF_HUB_DISABLE_SYMLINKS_WARNING ?? "1",
  };

  return createPythonRuntimeAdapterFoundation({
    client: { baseUrl: pythonRuntimeBaseUrl },
    supervisor: {
      command: process.env.PYTHON_RUNTIME_COMMAND ?? (process.platform === "win32" ? "python" : "python3"),
      args: process.env.PYTHON_RUNTIME_ARGS?.split(" ").filter(Boolean) ?? ["main.py"],
      cwd: process.env.PYTHON_RUNTIME_WORKER_DIR ?? "modules/adapters/runtime/python/worker",
      env: pythonRuntimeEnvironment,
      startupTimeoutMs: pythonRuntimeStartupTimeoutMs,
      requiredCapabilities: PYTHON_RUNTIME_DATASET_PREPARATION_REQUIRED_CAPABILITIES,
      prepareRuntimeEnvironment(context) {
        ensurePythonRuntimeWorkerDependencies({ command: context.command, cwd: context.cwd, env: context.env });
      },
      onEvent(event) {
        if (event.type === "stdio") {
          const message = event.detail?.trim();
          if (!message) return;
          const stream = event.data?.source === "stderr" ? "stderr" : "stdout";
          const level = classifyPythonRuntimeStdioLogLevel(stream, message);
          options.recordRuntimeLog({ level, message: `Python runtime ${stream}: ${message}` });
          return;
        }
        const message = event.detail ?? `Python runtime event: ${event.type}`;
        const level: "info" | "warn" | "error" = event.type === "process-error" || event.type === "startup-timeout"
          ? "error"
          : (event.type === "process-exit" ? "warn" : "info");
        options.recordRuntimeLog({ level, message });
      },
    },
  });
}

export function createUnavailablePythonRuntimeStatus(input: {
  runtimeLogs: DesktopPythonRuntimeLogEntry[];
  memoryUsagePercent: number;
  cpuUsagePercent: number;
}): DesktopPythonRuntimeStatusPayload {
  return {
    supervisorStatus: "stopped",
    healthy: false,
    runtimeStatus: "unavailable",
    capabilities: [],
    loadedModels: [],
    activeTaskCount: 0,
    systemResources: {
      memoryUsagePercent: input.memoryUsagePercent,
      cpuUsagePercent: input.cpuUsagePercent,
      gpuUsagePercent: 0,
    },
    logs: [...input.runtimeLogs],
  };
}

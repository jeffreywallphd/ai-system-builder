import type { DesktopPythonRuntimeLogEntry, DesktopPythonRuntimeStatusPayload } from "../../../contracts/ipc";

const PYTHON_RUNTIME_MANAGED_BASE_PORT = 43111;
const PYTHON_RUNTIME_MANAGED_PORT_SPAN = 10_000;

export interface DesktopPythonRuntimeFeature {
  supervisor: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    restart: () => Promise<void>;
    getStatus: () => string;
  };
  runtimePort: any;
}

export function classifyPythonRuntimeStdioLogLevel(stream: "stdout" | "stderr", message: string): "info" | "warn" | "error" {
  if (stream === "stdout") return "info";
  const normalizedMessage = message.trim();
  if (/^(ERROR|CRITICAL):/i.test(normalizedMessage) || normalizedMessage.includes("Traceback (most recent call last)")) return "error";
  if (/^WARNING:/i.test(normalizedMessage) || /\b(?:UserWarning|FutureWarning|RuntimeWarning|DeprecationWarning):/.test(normalizedMessage)) return "warn";
  return "info";
}

export function resolveDefaultManagedPythonRuntimePort(processId: number = process.pid): string {
  const processPortOffset = Math.abs(processId) % PYTHON_RUNTIME_MANAGED_PORT_SPAN;
  return String(PYTHON_RUNTIME_MANAGED_BASE_PORT + processPortOffset);
}

export function resolvePythonRuntimeHostAndPort(env: NodeJS.ProcessEnv = process.env): { host: string; port: string } {
  const configuredBaseUrl = env.PYTHON_RUNTIME_BASE_URL?.trim();
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl);
      return { host: env.PYTHON_RUNTIME_HOST?.trim() || parsed.hostname || "127.0.0.1", port: env.PYTHON_RUNTIME_PORT?.trim() || parsed.port || (parsed.protocol === "https:" ? "443" : "80") };
    } catch {
      return { host: env.PYTHON_RUNTIME_HOST?.trim() || "127.0.0.1", port: env.PYTHON_RUNTIME_PORT?.trim() || resolveDefaultManagedPythonRuntimePort() };
    }
  }
  return { host: env.PYTHON_RUNTIME_HOST?.trim() || "127.0.0.1", port: env.PYTHON_RUNTIME_PORT?.trim() || resolveDefaultManagedPythonRuntimePort() };
}

export function resolvePythonRuntimeBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredBaseUrl = env.PYTHON_RUNTIME_BASE_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;
  const { host, port } = resolvePythonRuntimeHostAndPort(env);
  return `http://${host}:${port}`;
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

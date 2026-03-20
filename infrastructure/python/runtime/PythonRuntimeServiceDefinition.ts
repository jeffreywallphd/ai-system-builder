import {
  ManagedServiceRestartPolicies,
  ManagedServiceTransports,
  type ManagedServiceDefinition,
} from "../../../application/services/ManagedServiceDefinition";
export { PYTHON_RUNTIME_MANAGED_SERVICE_ID } from "../../../application/services/ManagedServiceIds";
import { PYTHON_RUNTIME_MANAGED_SERVICE_ID } from "../../../application/services/ManagedServiceIds";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "../../../application/services/interfaces/ManagedServiceTypes";
import { PythonRuntimeMode } from "../../config/PythonRuntimeMode";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";

const DEFAULT_HEALTH_CHECK_PATH = "/health";
const DEFAULT_ENTRY_MODULE = "app.main:app";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8000;

export function createPythonRuntimeServiceDefinition(config: PythonRuntimeConfig): ManagedServiceDefinition {
  const launchTarget = resolveLaunchTarget(config.baseUrl);

  return Object.freeze({
    serviceId: PYTHON_RUNTIME_MANAGED_SERVICE_ID,
    kind: ManagedServiceKinds.pythonRuntime,
    displayName: "Python runtime",
    description: "Built-in Python runtime service definition for the local FastAPI runtime.",
    transport: ManagedServiceTransports.http,
    baseUrl: config.baseUrl,
    healthCheckPath: DEFAULT_HEALTH_CHECK_PATH,
    workingDirectory: config.runtimeWorkingDirectory,
    command: config.pythonExecutable,
    args: [
      "-m",
      "uvicorn",
      DEFAULT_ENTRY_MODULE,
      "--host",
      launchTarget.host,
      "--port",
      String(launchTarget.port),
    ],
    environmentVariables: {},
    autoStartPolicy: resolveAutoStartPolicy(config),
    restartPolicy: ManagedServiceRestartPolicies.onFailure,
    startupTimeoutMs: config.startupTimeoutMs,
    tags: ["builtin", "python", "runtime"],
    capabilities: ["workflow-execution", "node-execution", "mcp-runtime"],
  } satisfies ManagedServiceDefinition);
}

function resolveAutoStartPolicy(config: PythonRuntimeConfig) {
  if (config.mode === PythonRuntimeMode.disabled) {
    return ManagedServiceStartPolicies.disabled;
  }

  return config.autoStartEnabled
    ? ManagedServiceStartPolicies.onDemand
    : ManagedServiceStartPolicies.manual;
}

function resolveLaunchTarget(baseUrl?: string): { host: string; port: number } {
  if (!baseUrl) {
    return { host: DEFAULT_HOST, port: DEFAULT_PORT };
  }

  try {
    const url = new URL(baseUrl);
    const port = url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80);
    return {
      host: url.hostname || DEFAULT_HOST,
      port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    };
  } catch {
    return { host: DEFAULT_HOST, port: DEFAULT_PORT };
  }
}

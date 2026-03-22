import { PythonRuntimeMode, parsePythonRuntimeMode, type PythonRuntimeMode as PythonRuntimeModeValue } from "./PythonRuntimeMode";
import { normalizePythonRuntimeWorkingDirectory } from "./PythonRuntimeWorkingDirectory";

export interface PythonRuntimeConfigValues {
  readonly mode?: PythonRuntimeModeValue | string;
  readonly baseUrl?: string;
  readonly supervisorBaseUrl?: string;
  readonly timeoutMs?: number;
  readonly authToken?: string;
  readonly pythonExecutable?: string;
  readonly pythonVersion?: string;
  readonly pythonInterpreterPath?: string;
  readonly runtimeWorkingDirectory?: string;
  readonly startupTimeoutMs?: number;
  readonly healthPollIntervalMs?: number;
  readonly autoStartEnabled?: boolean;
}

export class PythonRuntimeConfig {
  public readonly mode: PythonRuntimeModeValue;
  public readonly baseUrl?: string;
  public readonly supervisorBaseUrl: string;
  public readonly timeoutMs: number;
  public readonly authToken?: string;
  public readonly pythonExecutable: string;
  public readonly pythonVersion: string;
  public readonly pythonInterpreterPath?: string;
  public readonly runtimeWorkingDirectory: string;
  public readonly startupTimeoutMs: number;
  public readonly healthPollIntervalMs: number;
  public readonly autoStartEnabled: boolean;

  constructor(values: PythonRuntimeConfigValues = {}) {
    this.mode = parsePythonRuntimeMode(values.mode);
    this.baseUrl = values.baseUrl?.trim() || undefined;
    this.supervisorBaseUrl = resolveSupervisorBaseUrl(values.supervisorBaseUrl, this.baseUrl);
    this.timeoutMs = values.timeoutMs && values.timeoutMs > 0 ? values.timeoutMs : 15_000;
    this.authToken = values.authToken?.trim() || undefined;
    this.pythonExecutable = values.pythonExecutable?.trim() || "python";
    this.pythonVersion = normalizePythonVersion(values.pythonVersion);
    this.pythonInterpreterPath = values.pythonInterpreterPath?.trim() || undefined;
    this.runtimeWorkingDirectory = normalizePythonRuntimeWorkingDirectory(values.runtimeWorkingDirectory);
    this.startupTimeoutMs = values.startupTimeoutMs && values.startupTimeoutMs > 0 ? values.startupTimeoutMs : 20_000;
    this.healthPollIntervalMs =
      values.healthPollIntervalMs && values.healthPollIntervalMs > 0 ? values.healthPollIntervalMs : 500;
    this.autoStartEnabled = resolveAutoStartEnabled(this.mode, values.autoStartEnabled);

    validatePythonRuntimeConfig(this);
  }

  public get isEnabled(): boolean {
    return this.mode !== PythonRuntimeMode.disabled;
  }

  public get isExternalHttp(): boolean {
    return this.mode === PythonRuntimeMode.externalHttp;
  }

  public get isManagedLocal(): boolean {
    return this.mode === PythonRuntimeMode.managedLocal;
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): PythonRuntimeConfig {
    return new PythonRuntimeConfig({
      mode: env.PYTHON_RUNTIME_MODE,
      baseUrl: env.PYTHON_RUNTIME_BASE_URL,
      supervisorBaseUrl: env.SERVICE_SUPERVISOR_BASE_URL,
      timeoutMs: env.PYTHON_RUNTIME_TIMEOUT_MS ? Number(env.PYTHON_RUNTIME_TIMEOUT_MS) : undefined,
      authToken: env.PYTHON_RUNTIME_AUTH_TOKEN,
      pythonExecutable: env.PYTHON_RUNTIME_EXECUTABLE,
      pythonVersion: env.PYTHON_RUNTIME_PYTHON_VERSION,
      pythonInterpreterPath: env.PYTHON_RUNTIME_INTERPRETER_PATH,
      runtimeWorkingDirectory: env.PYTHON_RUNTIME_WORKDIR,
      startupTimeoutMs: env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS
        ? Number(env.PYTHON_RUNTIME_STARTUP_TIMEOUT_MS)
        : undefined,
      healthPollIntervalMs: env.PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS
        ? Number(env.PYTHON_RUNTIME_HEALTH_POLL_INTERVAL_MS)
        : undefined,
      autoStartEnabled: env.PYTHON_RUNTIME_AUTO_START
        ? ["1", "true", "yes", "on"].includes(env.PYTHON_RUNTIME_AUTO_START.trim().toLowerCase())
        : undefined,
    });
  }
}

function resolveAutoStartEnabled(
  mode: PythonRuntimeModeValue,
  autoStartEnabled: boolean | undefined,
): boolean {
  if (typeof autoStartEnabled === "boolean") {
    return autoStartEnabled;
  }

  return mode === PythonRuntimeMode.managedLocal;
}

function validatePythonRuntimeConfig(config: PythonRuntimeConfig): void {
  if (config.isEnabled && !config.baseUrl) {
    throw new Error(`Python runtime mode '${config.mode}' requires baseUrl.`);
  }

  if (config.mode === PythonRuntimeMode.disabled && config.autoStartEnabled) {
    throw new Error("Python runtime mode 'disabled' cannot enable auto-start.");
  }

  if (config.mode === PythonRuntimeMode.externalHttp && config.autoStartEnabled) {
    throw new Error(
      "Python runtime mode 'external-http' cannot enable auto-start. Use 'managed-local' to supervise a local runtime."
    );
  }
}

function normalizePythonVersion(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "3.12";
  }

  return normalized;
}

function resolveSupervisorBaseUrl(supervisorBaseUrl: string | undefined, runtimeBaseUrl: string | undefined): string {
  const explicit = supervisorBaseUrl?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  try {
    const url = new URL(runtimeBaseUrl ?? "http://127.0.0.1:8100");
    url.hostname = "127.0.0.1";
    url.port = "8790";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://127.0.0.1:8790";
  }
}

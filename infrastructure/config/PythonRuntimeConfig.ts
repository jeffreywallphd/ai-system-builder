import { resolve } from "node:path";
import { PythonRuntimeMode, parsePythonRuntimeMode, type PythonRuntimeMode as PythonRuntimeModeValue } from "./PythonRuntimeMode";

export interface PythonRuntimeConfigValues {
  readonly mode?: PythonRuntimeModeValue | string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly authToken?: string;
  readonly pythonExecutable?: string;
  readonly runtimeWorkingDirectory?: string;
  readonly startupTimeoutMs?: number;
  readonly healthPollIntervalMs?: number;
  readonly autoStartEnabled?: boolean;
}

export class PythonRuntimeConfig {
  public readonly mode: PythonRuntimeModeValue;
  public readonly baseUrl?: string;
  public readonly timeoutMs: number;
  public readonly authToken?: string;
  public readonly pythonExecutable: string;
  public readonly runtimeWorkingDirectory: string;
  public readonly startupTimeoutMs: number;
  public readonly healthPollIntervalMs: number;
  public readonly autoStartEnabled: boolean;

  constructor(values: PythonRuntimeConfigValues = {}) {
    this.mode = parsePythonRuntimeMode(values.mode);
    this.baseUrl = values.baseUrl?.trim() || undefined;
    this.timeoutMs = values.timeoutMs && values.timeoutMs > 0 ? values.timeoutMs : 15_000;
    this.authToken = values.authToken?.trim() || undefined;
    this.pythonExecutable = values.pythonExecutable?.trim() || "python";
    this.runtimeWorkingDirectory = values.runtimeWorkingDirectory?.trim() || resolve(process.cwd(), "python-runtime");
    this.startupTimeoutMs = values.startupTimeoutMs && values.startupTimeoutMs > 0 ? values.startupTimeoutMs : 20_000;
    this.healthPollIntervalMs =
      values.healthPollIntervalMs && values.healthPollIntervalMs > 0 ? values.healthPollIntervalMs : 500;
    this.autoStartEnabled = values.autoStartEnabled ?? true;

    if (this.isEnabled && !this.baseUrl) {
      throw new Error("Python runtime requires baseUrl when enabled.");
    }
  }

  public get isEnabled(): boolean {
    return this.mode !== PythonRuntimeMode.disabled;
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): PythonRuntimeConfig {
    return new PythonRuntimeConfig({
      mode: env.PYTHON_RUNTIME_MODE,
      baseUrl: env.PYTHON_RUNTIME_BASE_URL,
      timeoutMs: env.PYTHON_RUNTIME_TIMEOUT_MS ? Number(env.PYTHON_RUNTIME_TIMEOUT_MS) : undefined,
      authToken: env.PYTHON_RUNTIME_AUTH_TOKEN,
      pythonExecutable: env.PYTHON_RUNTIME_EXECUTABLE,
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

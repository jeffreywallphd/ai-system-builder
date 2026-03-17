import { PythonRuntimeMode, parsePythonRuntimeMode, type PythonRuntimeMode as PythonRuntimeModeValue } from "./PythonRuntimeMode";

export interface PythonRuntimeConfigValues {
  readonly mode?: PythonRuntimeModeValue | string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly authToken?: string;
}

export class PythonRuntimeConfig {
  public readonly mode: PythonRuntimeModeValue;
  public readonly baseUrl?: string;
  public readonly timeoutMs: number;
  public readonly authToken?: string;

  constructor(values: PythonRuntimeConfigValues = {}) {
    this.mode = parsePythonRuntimeMode(values.mode);
    this.baseUrl = values.baseUrl?.trim() || undefined;
    this.timeoutMs = values.timeoutMs && values.timeoutMs > 0 ? values.timeoutMs : 15_000;
    this.authToken = values.authToken?.trim() || undefined;

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
    });
  }
}

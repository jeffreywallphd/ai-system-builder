export interface ComfyAdapterConfigValues {
  readonly baseUrl?: string;
  readonly requestTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly maxExecutionWaitMs?: number;
}

export class ComfyAdapterConfig {
  public readonly baseUrl: string;
  public readonly requestTimeoutMs: number;
  public readonly pollIntervalMs: number;
  public readonly maxExecutionWaitMs: number;

  constructor(values: ComfyAdapterConfigValues = {}) {
    const normalizedBaseUrl = values.baseUrl?.trim().replace(/\/+$/, "");
    if (!normalizedBaseUrl) {
      throw new Error("Comfy adapter configuration requires baseUrl.");
    }

    this.baseUrl = normalizedBaseUrl;
    this.requestTimeoutMs = normalizePositiveNumber(values.requestTimeoutMs, 30_000);
    this.pollIntervalMs = normalizePositiveNumber(values.pollIntervalMs, 1_000);
    this.maxExecutionWaitMs = normalizePositiveNumber(values.maxExecutionWaitMs, 1000 * 60 * 60);
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): ComfyAdapterConfig {
    return new ComfyAdapterConfig({
      baseUrl: env.COMFYUI_BASE_URL,
      requestTimeoutMs: parseOptionalNumber(env.COMFYUI_TIMEOUT_MS),
      pollIntervalMs: parseOptionalNumber(env.COMFYUI_POLL_INTERVAL_MS),
      maxExecutionWaitMs: parseOptionalNumber(env.COMFYUI_MAX_WAIT_MS),
    });
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

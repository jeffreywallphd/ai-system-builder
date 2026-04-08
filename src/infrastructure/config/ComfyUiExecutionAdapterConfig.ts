export const ComfyUiExecutionAdapterEnvironmentKeys = Object.freeze({
  enabled: "AI_LOOM_COMFYUI_ADAPTER_ENABLED",
  baseUrl: "AI_LOOM_COMFYUI_BASE_URL",
  requestTimeoutMs: "AI_LOOM_COMFYUI_REQUEST_TIMEOUT_MS",
  capabilityProbeOnStartup: "AI_LOOM_COMFYUI_CAPABILITY_PROBE_ON_STARTUP",
  requiredNodeTypes: "AI_LOOM_COMFYUI_REQUIRED_NODE_TYPES",
  authToken: "AI_LOOM_COMFYUI_AUTH_TOKEN",
});

export interface ComfyUiExecutionAdapterConfigValues {
  readonly enabled?: boolean;
  readonly baseUrl?: string;
  readonly requestTimeoutMs?: number;
  readonly capabilityProbeOnStartup?: boolean;
  readonly requiredNodeTypes?: ReadonlyArray<string>;
  readonly authToken?: string;
}

export class ComfyUiExecutionAdapterConfig {
  public readonly enabled: boolean;
  public readonly baseUrl?: string;
  public readonly requestTimeoutMs: number;
  public readonly capabilityProbeOnStartup: boolean;
  public readonly requiredNodeTypes: ReadonlyArray<string>;
  public readonly authToken?: string;

  public constructor(values: ComfyUiExecutionAdapterConfigValues = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(values.baseUrl);
    const enabled = values.enabled ?? Boolean(normalizedBaseUrl);
    if (enabled && !normalizedBaseUrl) {
      throw new Error("ComfyUI execution adapter requires baseUrl when enabled.");
    }

    this.enabled = enabled;
    this.baseUrl = normalizedBaseUrl;
    this.requestTimeoutMs = normalizePositiveInteger(values.requestTimeoutMs, 30_000);
    this.capabilityProbeOnStartup = values.capabilityProbeOnStartup ?? true;
    this.requiredNodeTypes = normalizeRequiredNodeTypes(values.requiredNodeTypes ?? []);
    this.authToken = normalizeOptional(values.authToken);
  }

  public toSafeSnapshot(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      enabled: this.enabled,
      baseUrl: this.baseUrl,
      requestTimeoutMs: this.requestTimeoutMs,
      capabilityProbeOnStartup: this.capabilityProbeOnStartup,
      requiredNodeTypes: this.requiredNodeTypes,
      hasAuthToken: Boolean(this.authToken),
    });
  }

  public static fromEnv(
    env: Readonly<Record<string, string | undefined>>,
  ): ComfyUiExecutionAdapterConfig {
    const enabledRaw = parseOptionalBoolean(env[ComfyUiExecutionAdapterEnvironmentKeys.enabled]);

    return new ComfyUiExecutionAdapterConfig({
      enabled: enabledRaw,
      baseUrl: normalizeOptional(env[ComfyUiExecutionAdapterEnvironmentKeys.baseUrl])
        ?? normalizeOptional(env.COMFYUI_BASE_URL)
        ?? normalizeOptional(env.VITE_COMFYUI_BASE_URL),
      requestTimeoutMs: parseOptionalNumber(env[ComfyUiExecutionAdapterEnvironmentKeys.requestTimeoutMs])
        ?? parseOptionalNumber(env.COMFYUI_TIMEOUT_MS),
      capabilityProbeOnStartup:
        parseOptionalBoolean(env[ComfyUiExecutionAdapterEnvironmentKeys.capabilityProbeOnStartup]),
      requiredNodeTypes:
        parseCommaDelimitedList(env[ComfyUiExecutionAdapterEnvironmentKeys.requiredNodeTypes]),
      authToken: normalizeOptional(env[ComfyUiExecutionAdapterEnvironmentKeys.authToken]),
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeRequiredNodeTypes(
  nodeTypes: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const nodeType of nodeTypes) {
    const normalized = normalizeOptional(nodeType);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`ComfyUI execution adapter baseUrl '${normalized}' is invalid.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("ComfyUI execution adapter baseUrl must use http or https.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function parseCommaDelimitedList(value: string | undefined): ReadonlyArray<string> | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  return Object.freeze(normalized.split(",").map((entry) => entry.trim()));
}

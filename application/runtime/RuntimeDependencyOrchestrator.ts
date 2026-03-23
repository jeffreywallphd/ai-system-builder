export const RuntimeDependencyIds = {
  pythonRuntime: "python-runtime",
  mcpRuntime: "mcp-runtime",
  workflowExecutionRuntime: "workflow-execution-runtime",
  documentConversionRuntime: "document-conversion-runtime",
  datasetGenerationRuntime: "dataset-generation-runtime",
  modelTrainingRuntime: "model-training-runtime",
} as const;

export type RuntimeDependencyId = (typeof RuntimeDependencyIds)[keyof typeof RuntimeDependencyIds];

export const RuntimeDependencyOperationalStates = {
  unknown: "unknown",
  disabled: "disabled",
  unavailable: "unavailable",
  provisioning: "provisioning",
  starting: "starting",
  healthy: "healthy",
  degraded: "degraded",
  failed: "failed",
  stopped: "stopped",
} as const;

export type RuntimeDependencyOperationalState =
  (typeof RuntimeDependencyOperationalStates)[keyof typeof RuntimeDependencyOperationalStates];

export const RuntimeDependencyAvailabilityStates = {
  unknown: "unknown",
  disabled: "disabled",
  unavailable: "unavailable",
  degraded: "degraded",
  available: "available",
} as const;

export type RuntimeDependencyAvailabilityState =
  (typeof RuntimeDependencyAvailabilityStates)[keyof typeof RuntimeDependencyAvailabilityStates];

export const RuntimeDependencyHealthStates = {
  unknown: "unknown",
  disabled: "disabled",
  unavailable: "unavailable",
  degraded: "degraded",
  healthy: "healthy",
} as const;

export type RuntimeDependencyHealthState =
  (typeof RuntimeDependencyHealthStates)[keyof typeof RuntimeDependencyHealthStates];

export interface RuntimeDependencyProbeResult {
  readonly state: RuntimeDependencyOperationalState;
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly remediationHints?: ReadonlyArray<string>;
  readonly isDegraded?: boolean;
}

export interface RuntimeDependencyRegistration {
  readonly dependencyId: RuntimeDependencyId;
  readonly providerId: string;
  readonly dependsOn?: ReadonlyArray<RuntimeDependencyId>;
  readonly fallbackDependencyIds?: ReadonlyArray<RuntimeDependencyId>;
  ensureAvailable(): Promise<RuntimeDependencyProbeResult>;
}

export interface RuntimeDependencyResolution {
  readonly requestedDependencyId: RuntimeDependencyId;
  readonly resolvedDependencyId: RuntimeDependencyId;
  readonly providerId: string;
  readonly state: RuntimeDependencyOperationalState;
  readonly health: RuntimeDependencyHealthState;
  readonly availability: RuntimeDependencyAvailabilityState;
  readonly available: boolean;
  readonly degraded: boolean;
  readonly detail?: string;
  readonly checkedAt: string;
  readonly dependencyChain: ReadonlyArray<RuntimeDependencyId>;
  readonly fallbackDependencyIds: ReadonlyArray<RuntimeDependencyId>;
  readonly usedFallback: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly remediationHints: ReadonlyArray<string>;
}

export interface IRuntimeDependencyOrchestrator {
  ensureAvailable(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution>;
  refresh(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution>;
  invalidate(dependencyId: RuntimeDependencyId): void;
  invalidateAll(): void;
  listRegistrations(): ReadonlyArray<RuntimeDependencyRegistration>;
}

export class RuntimeDependencyUnavailableError extends Error {
  public readonly resolution: RuntimeDependencyResolution;

  constructor(
    resolution: RuntimeDependencyResolution,
    message = resolution.detail ?? `${resolution.requestedDependencyId} is ${resolution.state}.`,
  ) {
    super(message);
    this.name = "RuntimeDependencyUnavailableError";
    this.resolution = resolution;
  }
}

export function isRuntimeDependencyOperational(resolution: RuntimeDependencyResolution): boolean {
  return resolution.available;
}

export function deriveRuntimeDependencyAvailability(
  state: RuntimeDependencyOperationalState,
  degraded = false,
): RuntimeDependencyAvailabilityState {
  if (state === RuntimeDependencyOperationalStates.disabled) {
    return RuntimeDependencyAvailabilityStates.disabled;
  }

  if (state === RuntimeDependencyOperationalStates.healthy) {
    return degraded
      ? RuntimeDependencyAvailabilityStates.degraded
      : RuntimeDependencyAvailabilityStates.available;
  }

  if (
    state === RuntimeDependencyOperationalStates.degraded
    || state === RuntimeDependencyOperationalStates.provisioning
    || state === RuntimeDependencyOperationalStates.starting
  ) {
    return RuntimeDependencyAvailabilityStates.degraded;
  }

  if (state === RuntimeDependencyOperationalStates.unknown) {
    return RuntimeDependencyAvailabilityStates.unknown;
  }

  return RuntimeDependencyAvailabilityStates.unavailable;
}

export function deriveRuntimeDependencyHealth(
  state: RuntimeDependencyOperationalState,
  degraded = false,
): RuntimeDependencyHealthState {
  if (state === RuntimeDependencyOperationalStates.disabled) {
    return RuntimeDependencyHealthStates.disabled;
  }

  if (state === RuntimeDependencyOperationalStates.healthy) {
    return degraded ? RuntimeDependencyHealthStates.degraded : RuntimeDependencyHealthStates.healthy;
  }

  if (
    degraded
    || state === RuntimeDependencyOperationalStates.degraded
    || state === RuntimeDependencyOperationalStates.provisioning
    || state === RuntimeDependencyOperationalStates.starting
  ) {
    return RuntimeDependencyHealthStates.degraded;
  }

  if (state === RuntimeDependencyOperationalStates.unknown) {
    return RuntimeDependencyHealthStates.unknown;
  }

  return RuntimeDependencyHealthStates.unavailable;
}


export function describeRuntimeDependencyResolution(
  resolution: Pick<
    RuntimeDependencyResolution,
    "requestedDependencyId" | "resolvedDependencyId" | "state" | "detail" | "usedFallback" | "remediationHints"
  >,
): string {
  const summary = resolution.detail?.trim()
    || `${resolution.requestedDependencyId} is ${resolution.state}.`;

  const fallbackDetail = resolution.usedFallback
    && resolution.resolvedDependencyId !== resolution.requestedDependencyId
    ? ` Using fallback dependency '${resolution.resolvedDependencyId}'.`
    : "";
  const remediationDetail = resolution.remediationHints.length > 0
    ? ` Next: ${resolution.remediationHints.join(" ")}`
    : "";

  return `${summary}${fallbackDetail}${remediationDetail}`.trim();
}

export function isRuntimeDependencyResolution(
  value: unknown,
): value is RuntimeDependencyResolution {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RuntimeDependencyResolution>;
  return typeof candidate.requestedDependencyId === "string"
    && typeof candidate.resolvedDependencyId === "string"
    && typeof candidate.providerId === "string"
    && typeof candidate.state === "string"
    && typeof candidate.checkedAt === "string"
    && Array.isArray(candidate.remediationHints);
}

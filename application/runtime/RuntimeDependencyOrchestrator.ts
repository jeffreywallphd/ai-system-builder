export const RuntimeDependencyIds = {
  pythonRuntime: "python-runtime",
  mcpRuntime: "mcp-runtime",
} as const;

export type RuntimeDependencyId = (typeof RuntimeDependencyIds)[keyof typeof RuntimeDependencyIds];

export interface RuntimeDependencyProbeResult {
  readonly available: boolean;
  readonly detail?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
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
  readonly available: boolean;
  readonly detail?: string;
  readonly checkedAt: string;
  readonly dependencyChain: ReadonlyArray<RuntimeDependencyId>;
  readonly fallbackDependencyIds: ReadonlyArray<RuntimeDependencyId>;
  readonly usedFallback: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IRuntimeDependencyOrchestrator {
  ensureAvailable(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution>;
  listRegistrations(): ReadonlyArray<RuntimeDependencyRegistration>;
}

export class RuntimeDependencyUnavailableError extends Error {
  public readonly resolution: RuntimeDependencyResolution;

  constructor(resolution: RuntimeDependencyResolution, message = resolution.detail ?? `${resolution.requestedDependencyId} is unavailable.`) {
    super(message);
    this.name = "RuntimeDependencyUnavailableError";
    this.resolution = resolution;
  }
}

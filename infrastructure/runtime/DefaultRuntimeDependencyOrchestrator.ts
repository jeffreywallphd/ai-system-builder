import {
  deriveRuntimeDependencyAvailability,
  deriveRuntimeDependencyHealth,
  RuntimeDependencyHealthStates,
  RuntimeDependencyOperationalStates,
  type IRuntimeDependencyOrchestrator,
  type RuntimeDependencyHealthState,
  type RuntimeDependencyId,
  type RuntimeDependencyOperationalState,
  type RuntimeDependencyProbeResult,
  type RuntimeDependencyRegistration,
  type RuntimeDependencyResolution,
} from "../../application/runtime/RuntimeDependencyOrchestrator";

export interface DefaultRuntimeDependencyOrchestratorOptions {
  readonly registrations: ReadonlyArray<RuntimeDependencyRegistration>;
  readonly cacheTtlMs?: number;
}

interface CachedResolution {
  readonly resolution: RuntimeDependencyResolution;
  readonly cachedAt: number;
  readonly version: string;
}

interface InflightResolution {
  readonly promise: Promise<RuntimeDependencyResolution>;
  readonly version: string;
}

export class DefaultRuntimeDependencyOrchestrator implements IRuntimeDependencyOrchestrator {
  private readonly registrations = new Map<RuntimeDependencyId, RuntimeDependencyRegistration>();
  private readonly dependents = new Map<RuntimeDependencyId, Set<RuntimeDependencyId>>();
  private readonly cache = new Map<RuntimeDependencyId, CachedResolution>();
  private readonly inflight = new Map<RuntimeDependencyId, InflightResolution>();
  private readonly cacheTtlMs: number;
  private globalVersion = 0;
  private readonly dependencyVersions = new Map<RuntimeDependencyId, number>();

  constructor(options: DefaultRuntimeDependencyOrchestratorOptions) {
    this.cacheTtlMs = options.cacheTtlMs && options.cacheTtlMs > 0 ? options.cacheTtlMs : 500;

    for (const registration of options.registrations) {
      this.registrations.set(registration.dependencyId, registration);
      for (const parentDependencyId of registration.dependsOn ?? []) {
        this.registerDependent(parentDependencyId, registration.dependencyId);
      }
      for (const fallbackDependencyId of registration.fallbackDependencyIds ?? []) {
        this.registerDependent(fallbackDependencyId, registration.dependencyId);
      }
    }
  }

  public listRegistrations(): ReadonlyArray<RuntimeDependencyRegistration> {
    return Object.freeze([...this.registrations.values()]);
  }

  public ensureAvailable(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution> {
    return this.resolveWithCaching(dependencyId, { bypassCache: false });
  }

  public refresh(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution> {
    this.invalidate(dependencyId);
    return this.resolveWithCaching(dependencyId, { bypassCache: true });
  }

  public invalidate(dependencyId: RuntimeDependencyId): void {
    this.invalidateDependencyGraph(dependencyId, new Set());
  }

  public invalidateAll(): void {
    this.cache.clear();
    this.globalVersion += 1;
  }

  private resolveWithCaching(
    dependencyId: RuntimeDependencyId,
    options: { readonly bypassCache: boolean },
  ): Promise<RuntimeDependencyResolution> {
    const version = this.getVersion(dependencyId);
    if (!options.bypassCache) {
      const cached = this.cache.get(dependencyId);
      if (cached && cached.version === version && Date.now() - cached.cachedAt < this.cacheTtlMs) {
        return Promise.resolve(cached.resolution);
      }
    }

    const existing = this.inflight.get(dependencyId);
    if (existing && existing.version === version) {
      return existing.promise;
    }

    const pending = this.resolveDependency(dependencyId, [], version);
    this.inflight.set(dependencyId, { promise: pending, version });

    return pending.finally(() => {
      const current = this.inflight.get(dependencyId);
      if (current?.promise === pending) {
        this.inflight.delete(dependencyId);
      }
    });
  }

  private async resolveDependency(
    dependencyId: RuntimeDependencyId,
    stack: ReadonlyArray<RuntimeDependencyId>,
    version: string,
  ): Promise<RuntimeDependencyResolution> {
    if (stack.includes(dependencyId)) {
      return this.cacheResolution(this.createResolution({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "runtime-dependency-cycle",
        state: RuntimeDependencyOperationalStates.failed,
        detail: `Runtime dependency cycle detected: ${[...stack, dependencyId].join(" -> ")}.`,
        dependencyChain: Object.freeze([...stack, dependencyId]),
        fallbackDependencyIds: Object.freeze([]),
        usedFallback: false,
        remediationHints: Object.freeze(["Review runtime dependency registrations for cyclical prerequisites."]),
      }), version);
    }

    const registration = this.registrations.get(dependencyId);
    if (!registration) {
      return this.cacheResolution(this.createResolution({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "runtime-dependency-missing",
        state: RuntimeDependencyOperationalStates.unavailable,
        detail: `No runtime dependency registration is configured for '${dependencyId}'.`,
        dependencyChain: Object.freeze([...stack, dependencyId]),
        fallbackDependencyIds: Object.freeze([]),
        usedFallback: false,
        remediationHints: Object.freeze(["Register this runtime dependency before requesting it."]),
      }), version);
    }

    const dependencyChain = Object.freeze([...stack, dependencyId]);
    for (const parentDependencyId of registration.dependsOn ?? []) {
      const dependencyResolution = await this.resolveDependency(parentDependencyId, dependencyChain, version);
      if (!dependencyResolution.available) {
        return this.cacheResolution(this.createResolution({
          requestedDependencyId: dependencyId,
          resolvedDependencyId: dependencyId,
          providerId: registration.providerId,
          state: mapBlockedDependencyState(dependencyResolution.state),
          detail: `${dependencyId} depends on ${parentDependencyId}, which is ${dependencyResolution.state}. ${dependencyResolution.detail ?? ""}`.trim(),
          dependencyChain,
          fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
          usedFallback: false,
          metadata: {
            dependency: dependencyResolution,
          },
          remediationHints: dependencyResolution.remediationHints,
        }), version);
      }
    }

    const probe = await registration.ensureAvailable();
    const primaryResolution = this.createResolution({
      requestedDependencyId: dependencyId,
      resolvedDependencyId: dependencyId,
      providerId: registration.providerId,
      state: probe.state,
      detail: probe.detail,
      dependencyChain,
      fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
      usedFallback: false,
      metadata: probe.metadata,
      remediationHints: Object.freeze([...(probe.remediationHints ?? [])]),
      degraded: probe.isDegraded,
    });

    if (primaryResolution.available) {
      return this.cacheResolution(primaryResolution, version);
    }

    for (const fallbackDependencyId of registration.fallbackDependencyIds ?? []) {
      const fallbackResolution = await this.resolveDependency(fallbackDependencyId, dependencyChain, version);
      if (fallbackResolution.available) {
        return this.cacheResolution(this.createResolution({
          requestedDependencyId: dependencyId,
          resolvedDependencyId: fallbackResolution.resolvedDependencyId,
          providerId: fallbackResolution.providerId,
          state: fallbackResolution.state,
          detail: probe.detail
            ? `${probe.detail} Falling back to ${fallbackDependencyId}.`
            : `Falling back to ${fallbackDependencyId}.`,
          dependencyChain,
          fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
          usedFallback: true,
          degraded: true,
          metadata: {
            primaryProbe: probe.metadata,
            fallback: fallbackResolution,
          },
          remediationHints: Object.freeze([
            ...(probe.remediationHints ?? []),
            ...(fallbackResolution.remediationHints ?? []),
          ]),
        }), version);
      }
    }

    return this.cacheResolution(primaryResolution, version);
  }

  private createResolution(input: {
    readonly requestedDependencyId: RuntimeDependencyId;
    readonly resolvedDependencyId: RuntimeDependencyId;
    readonly providerId: string;
    readonly state: RuntimeDependencyOperationalState;
    readonly detail?: string;
    readonly dependencyChain: ReadonlyArray<RuntimeDependencyId>;
    readonly fallbackDependencyIds: ReadonlyArray<RuntimeDependencyId>;
    readonly usedFallback: boolean;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly remediationHints?: ReadonlyArray<string>;
    readonly degraded?: boolean;
  }): RuntimeDependencyResolution {
    const degraded = input.degraded ?? input.state === RuntimeDependencyOperationalStates.degraded;
    const availability = deriveRuntimeDependencyAvailability(input.state, degraded);
    const health = deriveRuntimeDependencyHealth(input.state, degraded);

    return Object.freeze({
      requestedDependencyId: input.requestedDependencyId,
      resolvedDependencyId: input.resolvedDependencyId,
      providerId: input.providerId,
      state: input.state,
      health,
      availability,
      available: isResolutionOperationalState(input.state),
      degraded,
      detail: input.detail,
      checkedAt: new Date().toISOString(),
      dependencyChain: input.dependencyChain,
      fallbackDependencyIds: input.fallbackDependencyIds,
      usedFallback: input.usedFallback,
      metadata: input.metadata,
      remediationHints: Object.freeze([...(input.remediationHints ?? [])]),
    });
  }

  private cacheResolution(resolution: RuntimeDependencyResolution, version: string): RuntimeDependencyResolution {
    if (this.getVersion(resolution.requestedDependencyId) === version) {
      this.cache.set(resolution.requestedDependencyId, {
        resolution,
        cachedAt: Date.now(),
        version,
      });
    }

    return resolution;
  }


  private invalidateDependencyGraph(dependencyId: RuntimeDependencyId, visited: Set<RuntimeDependencyId>): void {
    if (visited.has(dependencyId)) {
      return;
    }

    visited.add(dependencyId);
    this.cache.delete(dependencyId);
    this.bumpDependencyVersion(dependencyId);

    for (const dependentId of this.dependents.get(dependencyId) ?? []) {
      this.invalidateDependencyGraph(dependentId, visited);
    }
  }

  private registerDependent(dependencyId: RuntimeDependencyId, dependentId: RuntimeDependencyId): void {
    const dependents = this.dependents.get(dependencyId) ?? new Set<RuntimeDependencyId>();
    dependents.add(dependentId);
    this.dependents.set(dependencyId, dependents);
  }

  private getVersion(dependencyId: RuntimeDependencyId): string {
    return `${this.globalVersion}:${this.dependencyVersions.get(dependencyId) ?? 0}`;
  }

  private bumpDependencyVersion(dependencyId: RuntimeDependencyId): void {
    this.dependencyVersions.set(dependencyId, (this.dependencyVersions.get(dependencyId) ?? 0) + 1);
  }
}

function isResolutionOperationalState(state: RuntimeDependencyOperationalState): boolean {
  return state === RuntimeDependencyOperationalStates.healthy
    || state === RuntimeDependencyOperationalStates.degraded;
}

function mapBlockedDependencyState(state: RuntimeDependencyOperationalState): RuntimeDependencyOperationalState {
  switch (state) {
    case RuntimeDependencyOperationalStates.provisioning:
      return RuntimeDependencyOperationalStates.provisioning;
    case RuntimeDependencyOperationalStates.starting:
      return RuntimeDependencyOperationalStates.starting;
    case RuntimeDependencyOperationalStates.disabled:
      return RuntimeDependencyOperationalStates.disabled;
    case RuntimeDependencyOperationalStates.stopped:
      return RuntimeDependencyOperationalStates.stopped;
    case RuntimeDependencyOperationalStates.failed:
      return RuntimeDependencyOperationalStates.failed;
    case RuntimeDependencyOperationalStates.unknown:
      return RuntimeDependencyOperationalStates.unknown;
    case RuntimeDependencyOperationalStates.degraded:
      return RuntimeDependencyOperationalStates.degraded;
    case RuntimeDependencyOperationalStates.healthy:
      return RuntimeDependencyOperationalStates.degraded;
    case RuntimeDependencyOperationalStates.unavailable:
    default:
      return RuntimeDependencyOperationalStates.unavailable;
  }
}

export function isRuntimeDependencyResolutionUnhealthy(
  resolution: RuntimeDependencyResolution,
): boolean {
  return resolution.health !== RuntimeDependencyHealthStates.healthy
    && resolution.health !== RuntimeDependencyHealthStates.disabled;
}

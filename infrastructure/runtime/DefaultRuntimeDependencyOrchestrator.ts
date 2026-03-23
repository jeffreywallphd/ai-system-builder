import type {
  IRuntimeDependencyOrchestrator,
  RuntimeDependencyId,
  RuntimeDependencyRegistration,
  RuntimeDependencyResolution,
} from "../../application/runtime/RuntimeDependencyOrchestrator";

export interface DefaultRuntimeDependencyOrchestratorOptions {
  readonly registrations: ReadonlyArray<RuntimeDependencyRegistration>;
  readonly cacheTtlMs?: number;
}

interface CachedResolution {
  readonly resolution: RuntimeDependencyResolution;
  readonly cachedAt: number;
}

export class DefaultRuntimeDependencyOrchestrator implements IRuntimeDependencyOrchestrator {
  private readonly registrations = new Map<RuntimeDependencyId, RuntimeDependencyRegistration>();
  private readonly cache = new Map<RuntimeDependencyId, CachedResolution>();
  private readonly inflight = new Map<RuntimeDependencyId, Promise<RuntimeDependencyResolution>>();
  private readonly cacheTtlMs: number;

  constructor(options: DefaultRuntimeDependencyOrchestratorOptions) {
    this.cacheTtlMs = options.cacheTtlMs && options.cacheTtlMs > 0 ? options.cacheTtlMs : 500;

    for (const registration of options.registrations) {
      this.registrations.set(registration.dependencyId, registration);
    }
  }

  public listRegistrations(): ReadonlyArray<RuntimeDependencyRegistration> {
    return Object.freeze([...this.registrations.values()]);
  }

  public ensureAvailable(dependencyId: RuntimeDependencyId): Promise<RuntimeDependencyResolution> {
    const cached = this.cache.get(dependencyId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return Promise.resolve(cached.resolution);
    }

    const existing = this.inflight.get(dependencyId);
    if (existing) {
      return existing;
    }

    const pending = this.resolveDependency(dependencyId, []);
    this.inflight.set(dependencyId, pending);

    return pending.finally(() => {
      this.inflight.delete(dependencyId);
    });
  }

  private async resolveDependency(
    dependencyId: RuntimeDependencyId,
    stack: ReadonlyArray<RuntimeDependencyId>,
  ): Promise<RuntimeDependencyResolution> {
    if (stack.includes(dependencyId)) {
      return this.cacheResolution(Object.freeze({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "runtime-dependency-cycle",
        available: false,
        detail: `Runtime dependency cycle detected: ${[...stack, dependencyId].join(" -> ")}.`,
        checkedAt: new Date().toISOString(),
        dependencyChain: Object.freeze([...stack, dependencyId]),
        fallbackDependencyIds: Object.freeze([]),
        usedFallback: false,
      }));
    }

    const registration = this.registrations.get(dependencyId);
    if (!registration) {
      return this.cacheResolution(Object.freeze({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: "runtime-dependency-missing",
        available: false,
        detail: `No runtime dependency registration is configured for '${dependencyId}'.`,
        checkedAt: new Date().toISOString(),
        dependencyChain: Object.freeze([...stack, dependencyId]),
        fallbackDependencyIds: Object.freeze([]),
        usedFallback: false,
      }));
    }

    const dependencyChain = Object.freeze([...stack, dependencyId]);
    for (const parentDependencyId of registration.dependsOn ?? []) {
      const dependencyResolution = await this.resolveDependency(parentDependencyId, dependencyChain);
      if (!dependencyResolution.available) {
        return this.cacheResolution(Object.freeze({
          requestedDependencyId: dependencyId,
          resolvedDependencyId: dependencyId,
          providerId: registration.providerId,
          available: false,
          detail: registration.fallbackDependencyIds?.length
            ? `${dependencyId} depends on ${parentDependencyId}, which is unavailable. Attempting fallbacks is not yet configured for this dependency chain.`
            : `${dependencyId} depends on ${parentDependencyId}, which is unavailable. ${dependencyResolution.detail ?? ""}`.trim(),
          checkedAt: new Date().toISOString(),
          dependencyChain,
          fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
          usedFallback: false,
          metadata: {
            dependency: dependencyResolution,
          },
        }));
      }
    }

    const probe = await registration.ensureAvailable();
    if (probe.available) {
      return this.cacheResolution(Object.freeze({
        requestedDependencyId: dependencyId,
        resolvedDependencyId: dependencyId,
        providerId: registration.providerId,
        available: true,
        detail: probe.detail,
        checkedAt: new Date().toISOString(),
        dependencyChain,
        fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
        usedFallback: false,
        metadata: probe.metadata,
      }));
    }

    for (const fallbackDependencyId of registration.fallbackDependencyIds ?? []) {
      const fallbackResolution = await this.resolveDependency(fallbackDependencyId, dependencyChain);
      if (fallbackResolution.available) {
        return this.cacheResolution(Object.freeze({
          requestedDependencyId: dependencyId,
          resolvedDependencyId: fallbackResolution.resolvedDependencyId,
          providerId: fallbackResolution.providerId,
          available: true,
          detail: probe.detail
            ? `${probe.detail} Falling back to ${fallbackDependencyId}.`
            : `Falling back to ${fallbackDependencyId}.`,
          checkedAt: new Date().toISOString(),
          dependencyChain,
          fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
          usedFallback: true,
          metadata: {
            primaryProbe: probe.metadata,
            fallback: fallbackResolution,
          },
        }));
      }
    }

    return this.cacheResolution(Object.freeze({
      requestedDependencyId: dependencyId,
      resolvedDependencyId: dependencyId,
      providerId: registration.providerId,
      available: false,
      detail: probe.detail,
      checkedAt: new Date().toISOString(),
      dependencyChain,
      fallbackDependencyIds: Object.freeze([...(registration.fallbackDependencyIds ?? [])]),
      usedFallback: false,
      metadata: probe.metadata,
    }));
  }

  private cacheResolution(resolution: RuntimeDependencyResolution): RuntimeDependencyResolution {
    this.cache.set(resolution.requestedDependencyId, {
      resolution,
      cachedAt: Date.now(),
    });
    return resolution;
  }
}

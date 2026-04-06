import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeDomainError,
  type HostRuntimeIdentity,
  type HostStartupDependencyBoundary,
  type HostStartupDependencyBoundaryLayer,
  assertHostIdentitySupportsAuthoritativeControlPlane,
  hasHostCapability,
} from "../../domain/hosts/HostRuntimeDomain";

export class HostCompositionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostCompositionContractError";
  }
}

export const HostLifecyclePhases = Object.freeze({
  configured: "configured",
  composing: "composing",
  starting: "starting",
  ready: "ready",
  stopping: "stopping",
  stopped: "stopped",
  failed: "failed",
});

export type HostLifecyclePhase = typeof HostLifecyclePhases[keyof typeof HostLifecyclePhases];

export const HostBootModes = Object.freeze({
  coldStart: "cold-start",
  reload: "reload",
  resume: "resume",
});

export type HostBootMode = typeof HostBootModes[keyof typeof HostBootModes];

export interface HostBootConfiguration {
  readonly host: HostRuntimeIdentity;
  readonly mode: HostBootMode;
  readonly startedAt: string;
  readonly startupReason: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds: ReadonlyArray<string>;
}

export interface HostLifecycleTransition {
  readonly hostId: string;
  readonly from: HostLifecyclePhase;
  readonly to: HostLifecyclePhase;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface HostRuntimeHandle {
  readonly host: HostRuntimeIdentity;
  readonly phase: HostLifecyclePhase;
  stop(): Promise<void>;
}

export interface ExecutableHostCompositionRoot<THandle extends HostRuntimeHandle = HostRuntimeHandle> {
  readonly compositionRootId: string;
  readonly host: HostRuntimeIdentity;
  readonly dependencyBoundary: ReadonlyArray<HostStartupDependencyBoundary>;
  compose(boot: HostBootConfiguration): Promise<THandle>;
}

const AllowedLifecycleTransitions = new Map<HostLifecyclePhase, ReadonlyArray<HostLifecyclePhase>>([
  [HostLifecyclePhases.configured, [HostLifecyclePhases.composing, HostLifecyclePhases.failed]],
  [HostLifecyclePhases.composing, [HostLifecyclePhases.starting, HostLifecyclePhases.failed]],
  [HostLifecyclePhases.starting, [HostLifecyclePhases.ready, HostLifecyclePhases.failed]],
  [HostLifecyclePhases.ready, [HostLifecyclePhases.stopping, HostLifecyclePhases.failed]],
  [HostLifecyclePhases.stopping, [HostLifecyclePhases.stopped, HostLifecyclePhases.failed]],
  [HostLifecyclePhases.stopped, []],
  [HostLifecyclePhases.failed, []],
]);

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostCompositionContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new HostCompositionContractError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeDependencyIds(values: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

export function createHostBootConfiguration(input: {
  readonly host: HostRuntimeIdentity;
  readonly mode: HostBootMode;
  readonly startedAt?: string;
  readonly startupReason: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly requiredDependencyIds?: ReadonlyArray<string>;
}): HostBootConfiguration {
  if (!Object.values(HostBootModes).includes(input.mode)) {
    throw new HostCompositionContractError(`Host boot mode '${String(input.mode)}' is invalid.`);
  }
  const requiredDependencyIds = normalizeDependencyIds(input.requiredDependencyIds ?? []);
  for (const dependencyId of requiredDependencyIds) {
    if (!input.host.startupDependencies.some((dependency) => dependency.dependencyId === dependencyId)) {
      throw new HostCompositionContractError(
        `Host boot configuration references unknown startup dependency '${dependencyId}'.`,
      );
    }
  }

  return Object.freeze({
    host: input.host,
    mode: input.mode,
    startedAt: normalizeIsoTimestamp(input.startedAt ?? new Date().toISOString(), "Host boot startedAt"),
    startupReason: normalizeRequired(input.startupReason, "Host boot startupReason"),
    environment: Object.freeze({ ...(input.environment ?? {}) }),
    requiredDependencyIds,
  });
}

export function assertExecutableHostBoundarySatisfiesBootConfiguration(
  compositionRoot: Pick<ExecutableHostCompositionRoot, "compositionRootId" | "host" | "dependencyBoundary">,
  boot: HostBootConfiguration,
): void {
  if (compositionRoot.host.hostId !== boot.host.hostId) {
    throw new HostCompositionContractError(
      `Composition root '${compositionRoot.compositionRootId}' cannot boot host '${boot.host.hostId}'.`,
    );
  }
  for (const requiredDependencyId of boot.requiredDependencyIds) {
    if (!compositionRoot.dependencyBoundary.some((dependency) => dependency.dependencyId === requiredDependencyId)) {
      throw new HostCompositionContractError(
        `Composition root '${compositionRoot.compositionRootId}' does not expose required dependency '${requiredDependencyId}'.`,
      );
    }
  }
}

export function assertHostDependencyBoundaryLayer(
  dependency: Pick<HostStartupDependencyBoundary, "dependencyId" | "boundaryLayer">,
  expectedLayer: HostStartupDependencyBoundaryLayer,
): void {
  if (dependency.boundaryLayer !== expectedLayer) {
    throw new HostCompositionContractError(
      `Dependency '${dependency.dependencyId}' must remain in boundary layer '${expectedLayer}'.`,
    );
  }
}

export function transitionHostLifecyclePhase(input: {
  readonly hostId: string;
  readonly from: HostLifecyclePhase;
  readonly to: HostLifecyclePhase;
  readonly occurredAt?: string;
  readonly reason: string;
}): HostLifecycleTransition {
  const allowed = AllowedLifecycleTransitions.get(input.from) ?? [];
  if (!allowed.includes(input.to)) {
    throw new HostCompositionContractError(
      `Host '${input.hostId}' cannot transition lifecycle from '${input.from}' to '${input.to}'.`,
    );
  }

  return Object.freeze({
    hostId: normalizeRequired(input.hostId, "Host lifecycle hostId"),
    from: input.from,
    to: input.to,
    occurredAt: normalizeIsoTimestamp(
      input.occurredAt ?? new Date().toISOString(),
      "Host lifecycle occurredAt",
    ),
    reason: normalizeRequired(input.reason, "Host lifecycle reason"),
  });
}

export function assertHostCanRunAsControlPlane(boot: HostBootConfiguration): void {
  try {
    assertHostIdentitySupportsAuthoritativeControlPlane(boot.host);
  } catch (error) {
    if (error instanceof HostRuntimeDomainError) {
      throw new HostCompositionContractError(error.message);
    }
    throw error;
  }
}

export function resolveHostCapabilityMatrix(host: Pick<HostRuntimeIdentity, "controlPlaneRole" | "capabilities">): {
  readonly controlPlaneAuthority: boolean;
  readonly nodeExecution: boolean;
  readonly splitAuthorityFromExecution: boolean;
} {
  const controlPlaneAuthority = host.controlPlaneRole === HostControlPlaneRoles.authoritativeServer
    && hasHostCapability(host, HostCapabilityFlags.controlPlaneAuthority);
  const nodeExecution = hasHostCapability(host, HostCapabilityFlags.nodeExecution);

  return Object.freeze({
    controlPlaneAuthority,
    nodeExecution,
    splitAuthorityFromExecution: controlPlaneAuthority !== nodeExecution,
  });
}


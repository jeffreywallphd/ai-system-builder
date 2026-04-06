import type {
  HostCapabilityFlag,
  HostControlPlaneRole,
  HostRuntimeIdentity,
  HostRuntimeKind,
  HostStartupDependencyBoundary,
  HostStartupDependencyBoundaryLayer,
} from "../../../domain/hosts/HostRuntimeDomain";
import type {
  HostBootConfiguration,
  HostBootMode,
  HostLifecycleEvent,
  HostLifecycleEventType,
  HostLifecyclePhase,
  HostLifecycleReadinessMarker,
  HostLifecycleTransition,
} from "../../../application/common/HostCompositionContracts";

export class HostCompositionSharedContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostCompositionSharedContractError";
  }
}

export const HostCompositionContractScopes = Object.freeze({
  hostInternal: "host-internal",
  runtimeTransport: "runtime-transport",
});

export type HostCompositionContractScope =
  typeof HostCompositionContractScopes[keyof typeof HostCompositionContractScopes];

export const HostCompositionContractVersions = Object.freeze({
  v1: "host-composition/v1",
});

export type HostCompositionContractVersion =
  typeof HostCompositionContractVersions[keyof typeof HostCompositionContractVersions];

export interface HostStartupDependencyBoundaryDto {
  readonly dependencyId: string;
  readonly description: string;
  readonly boundaryLayer: HostStartupDependencyBoundaryLayer;
  readonly requiredCapabilities: ReadonlyArray<HostCapabilityFlag>;
}

export interface HostRuntimeIdentityDto {
  readonly contractVersion: HostCompositionContractVersion;
  readonly hostId: string;
  readonly kind: HostRuntimeKind;
  readonly controlPlaneRole: HostControlPlaneRole;
  readonly capabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly responsibilities: ReadonlyArray<string>;
  readonly startupDependencies: ReadonlyArray<HostStartupDependencyBoundaryDto>;
}

export interface HostBootConfigurationDto {
  readonly contractVersion: HostCompositionContractVersion;
  readonly host: HostRuntimeIdentityDto;
  readonly mode: HostBootMode;
  readonly startedAt: string;
  readonly startupReason: string;
  readonly requiredDependencyIds: ReadonlyArray<string>;
}

export interface HostLifecycleReadinessMarkerDto {
  readonly marker: string;
  readonly markedAt: string;
}

export interface HostLifecycleTransitionDto {
  readonly hostId: string;
  readonly from: HostLifecyclePhase;
  readonly to: HostLifecyclePhase;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface HostLifecycleEventDto {
  readonly contractVersion: HostCompositionContractVersion;
  readonly hostId: string;
  readonly phase: HostLifecyclePhase;
  readonly type: HostLifecycleEventType;
  readonly occurredAt: string;
  readonly reason: string;
  readonly transition?: HostLifecycleTransitionDto;
  readonly readiness?: HostLifecycleReadinessMarkerDto;
  readonly metadata?: Readonly<Record<string, string>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostCompositionSharedContractError(`${field} is required.`);
  }
  return normalized;
}

function toStartupDependencyDto(value: HostStartupDependencyBoundary): HostStartupDependencyBoundaryDto {
  return Object.freeze({
    dependencyId: normalizeRequired(value.dependencyId, "Host startup dependency dependencyId"),
    description: normalizeRequired(value.description, "Host startup dependency description"),
    boundaryLayer: value.boundaryLayer,
    requiredCapabilities: Object.freeze([...(value.requiredCapabilities ?? [])]),
  });
}

export function toHostRuntimeIdentityDto(value: HostRuntimeIdentity): HostRuntimeIdentityDto {
  return Object.freeze({
    contractVersion: HostCompositionContractVersions.v1,
    hostId: normalizeRequired(value.hostId, "Host runtime hostId"),
    kind: value.kind,
    controlPlaneRole: value.controlPlaneRole,
    capabilities: Object.freeze([...value.capabilities]),
    responsibilities: Object.freeze([...value.responsibilities]),
    startupDependencies: Object.freeze(value.startupDependencies.map(toStartupDependencyDto)),
  });
}

export function toHostBootConfigurationDto(value: HostBootConfiguration): HostBootConfigurationDto {
  const normalizedStartedAt = normalizeRequired(value.startedAt, "Host boot startedAt");
  if (Number.isNaN(new Date(normalizedStartedAt).getTime())) {
    throw new HostCompositionSharedContractError("Host boot startedAt must be a valid ISO timestamp.");
  }
  return Object.freeze({
    contractVersion: HostCompositionContractVersions.v1,
    host: toHostRuntimeIdentityDto(value.host),
    mode: value.mode,
    startedAt: new Date(normalizedStartedAt).toISOString(),
    startupReason: normalizeRequired(value.startupReason, "Host boot startupReason"),
    requiredDependencyIds: Object.freeze([...value.requiredDependencyIds]),
  });
}

function toLifecycleTransitionDto(value: HostLifecycleTransition): HostLifecycleTransitionDto {
  return Object.freeze({
    hostId: normalizeRequired(value.hostId, "Host lifecycle transition hostId"),
    from: value.from,
    to: value.to,
    occurredAt: new Date(normalizeRequired(value.occurredAt, "Host lifecycle transition occurredAt")).toISOString(),
    reason: normalizeRequired(value.reason, "Host lifecycle transition reason"),
  });
}

function toReadinessMarkerDto(value: HostLifecycleReadinessMarker): HostLifecycleReadinessMarkerDto {
  return Object.freeze({
    marker: normalizeRequired(value.marker, "Host lifecycle readiness marker"),
    markedAt: new Date(normalizeRequired(value.markedAt, "Host lifecycle readiness markedAt")).toISOString(),
  });
}

export function toHostLifecycleEventDto(value: HostLifecycleEvent): HostLifecycleEventDto {
  return Object.freeze({
    contractVersion: HostCompositionContractVersions.v1,
    hostId: normalizeRequired(value.hostId, "Host lifecycle event hostId"),
    phase: value.phase,
    type: value.type,
    occurredAt: new Date(normalizeRequired(value.occurredAt, "Host lifecycle event occurredAt")).toISOString(),
    reason: normalizeRequired(value.reason, "Host lifecycle event reason"),
    transition: value.transition ? toLifecycleTransitionDto(value.transition) : undefined,
    readiness: value.readiness ? toReadinessMarkerDto(value.readiness) : undefined,
    metadata: value.metadata ? Object.freeze({ ...value.metadata }) : undefined,
  });
}


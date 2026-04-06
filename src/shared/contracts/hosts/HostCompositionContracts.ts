import type {
  HostCapabilityFlag,
  HostControlPlaneRole,
  HostRuntimeIdentity,
  HostRuntimeKind,
  HostStartupDependencyBoundary,
  HostStartupDependencyBoundaryLayer,
} from "../../../domain/hosts/HostRuntimeDomain";
import type { HostBootConfiguration, HostBootMode } from "../../../application/common/HostCompositionContracts";

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


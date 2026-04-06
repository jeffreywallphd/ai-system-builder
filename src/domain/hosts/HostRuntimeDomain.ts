export class HostRuntimeDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostRuntimeDomainError";
  }
}

export const HostRuntimeKinds = Object.freeze({
  server: "server",
  desktop: "desktop",
  hybrid: "hybrid",
  web: "web",
  worker: "worker",
});

export type HostRuntimeKind = typeof HostRuntimeKinds[keyof typeof HostRuntimeKinds];

export const HostControlPlaneRoles = Object.freeze({
  authoritativeServer: "authoritative-server",
  controlPlaneClient: "control-plane-client",
  none: "none",
});

export type HostControlPlaneRole = typeof HostControlPlaneRoles[keyof typeof HostControlPlaneRoles];

export const HostCapabilityFlags = Object.freeze({
  controlPlaneAuthority: "control-plane-authority",
  nodeExecution: "node-execution",
  userInterfaceRendering: "user-interface-rendering",
  desktopShell: "desktop-shell",
  browserRuntime: "browser-runtime",
  workerRuntime: "worker-runtime",
  localPersistence: "local-persistence",
  ipcBridge: "ipc-bridge",
  httpServing: "http-serving",
  transportTermination: "transport-termination",
});

export type HostCapabilityFlag = typeof HostCapabilityFlags[keyof typeof HostCapabilityFlags];

export const HostStartupDependencyBoundaryLayers = Object.freeze({
  sharedContracts: "shared-contracts",
  domain: "domain",
  application: "application",
  infrastructure: "infrastructure",
  host: "host",
});

export type HostStartupDependencyBoundaryLayer =
  typeof HostStartupDependencyBoundaryLayers[keyof typeof HostStartupDependencyBoundaryLayers];

export interface HostStartupDependencyBoundary {
  readonly dependencyId: string;
  readonly description: string;
  readonly boundaryLayer: HostStartupDependencyBoundaryLayer;
  readonly requiredCapabilities?: ReadonlyArray<HostCapabilityFlag>;
}

export interface HostRuntimeIdentity {
  readonly hostId: string;
  readonly kind: HostRuntimeKind;
  readonly controlPlaneRole: HostControlPlaneRole;
  readonly capabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly responsibilities: ReadonlyArray<string>;
  readonly startupDependencies: ReadonlyArray<HostStartupDependencyBoundary>;
}

const HostIdentifierPattern = /^[a-z][a-z0-9:-]{2,126}$/;

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostRuntimeDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeRequiredStringArray(
  values: ReadonlyArray<string>,
  field: string,
): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  if (deduped.size < 1) {
    throw new HostRuntimeDomainError(`${field} requires at least one value.`);
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeCapabilityArray(
  values: ReadonlyArray<HostCapabilityFlag>,
): ReadonlyArray<HostCapabilityFlag> {
  const normalized = new Set<HostCapabilityFlag>();
  for (const value of values) {
    if (!Object.values(HostCapabilityFlags).includes(value)) {
      throw new HostRuntimeDomainError(`Host capability '${String(value)}' is invalid.`);
    }
    normalized.add(value);
  }
  if (normalized.size < 1) {
    throw new HostRuntimeDomainError("Host capabilities require at least one value.");
  }
  return Object.freeze([...normalized.values()]);
}

function normalizeDependencyBoundaries(
  values: ReadonlyArray<HostStartupDependencyBoundary>,
): ReadonlyArray<HostStartupDependencyBoundary> {
  const byId = new Map<string, HostStartupDependencyBoundary>();
  for (const dependency of values) {
    const dependencyId = normalizeRequired(dependency.dependencyId, "Host startup dependency dependencyId");
    if (!HostIdentifierPattern.test(dependencyId)) {
      throw new HostRuntimeDomainError(
        "Host startup dependency dependencyId must start with a letter and use lowercase letters, numbers, ':', or '-'.",
      );
    }
    if (byId.has(dependencyId)) {
      throw new HostRuntimeDomainError(`Host startup dependency '${dependencyId}' must be unique.`);
    }
    if (!Object.values(HostStartupDependencyBoundaryLayers).includes(dependency.boundaryLayer)) {
      throw new HostRuntimeDomainError(
        `Host startup dependency '${dependencyId}' has invalid boundary layer '${String(dependency.boundaryLayer)}'.`,
      );
    }
    const requiredCapabilities = dependency.requiredCapabilities
      ? normalizeCapabilityArray(dependency.requiredCapabilities)
      : undefined;
    byId.set(dependencyId, Object.freeze({
      dependencyId,
      description: normalizeRequired(
        dependency.description,
        `Host startup dependency '${dependencyId}' description`,
      ),
      boundaryLayer: dependency.boundaryLayer,
      requiredCapabilities,
    }));
  }
  return Object.freeze([...byId.values()]);
}

export function createHostRuntimeIdentity(input: {
  readonly hostId: string;
  readonly kind: HostRuntimeKind;
  readonly controlPlaneRole: HostControlPlaneRole;
  readonly capabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly responsibilities: ReadonlyArray<string>;
  readonly startupDependencies?: ReadonlyArray<HostStartupDependencyBoundary>;
}): HostRuntimeIdentity {
  const hostId = normalizeRequired(input.hostId, "Host runtime hostId");
  if (!HostIdentifierPattern.test(hostId)) {
    throw new HostRuntimeDomainError(
      "Host runtime hostId must start with a letter and use lowercase letters, numbers, ':', or '-'.",
    );
  }
  if (!Object.values(HostRuntimeKinds).includes(input.kind)) {
    throw new HostRuntimeDomainError(`Host runtime kind '${String(input.kind)}' is invalid.`);
  }
  if (!Object.values(HostControlPlaneRoles).includes(input.controlPlaneRole)) {
    throw new HostRuntimeDomainError(
      `Host control-plane role '${String(input.controlPlaneRole)}' is invalid.`,
    );
  }

  const capabilities = normalizeCapabilityArray(input.capabilities);
  const hasControlPlaneAuthority = capabilities.includes(HostCapabilityFlags.controlPlaneAuthority);
  if (input.controlPlaneRole === HostControlPlaneRoles.authoritativeServer && !hasControlPlaneAuthority) {
    throw new HostRuntimeDomainError(
      "Authoritative server hosts must include control-plane-authority capability.",
    );
  }
  if (input.controlPlaneRole !== HostControlPlaneRoles.authoritativeServer && hasControlPlaneAuthority) {
    throw new HostRuntimeDomainError(
      "Only authoritative-server role can include control-plane-authority capability.",
    );
  }
  if (input.controlPlaneRole === HostControlPlaneRoles.authoritativeServer && input.kind !== HostRuntimeKinds.server) {
    throw new HostRuntimeDomainError("Authoritative server role must use host runtime kind 'server'.");
  }

  const responsibilities = normalizeRequiredStringArray(input.responsibilities, "Host runtime responsibilities");
  const startupDependencies = normalizeDependencyBoundaries(input.startupDependencies ?? []);

  return Object.freeze({
    hostId,
    kind: input.kind,
    controlPlaneRole: input.controlPlaneRole,
    capabilities,
    responsibilities,
    startupDependencies,
  });
}

export function hasHostCapability(
  host: Pick<HostRuntimeIdentity, "capabilities">,
  capability: HostCapabilityFlag,
): boolean {
  return host.capabilities.includes(capability);
}

export function assertHostIdentitySupportsAuthoritativeControlPlane(
  host: Pick<HostRuntimeIdentity, "hostId" | "kind" | "controlPlaneRole" | "capabilities">,
): void {
  if (host.controlPlaneRole !== HostControlPlaneRoles.authoritativeServer) {
    throw new HostRuntimeDomainError(
      `Host '${host.hostId}' cannot act as authoritative control plane without authoritative-server role.`,
    );
  }
  if (host.kind !== HostRuntimeKinds.server) {
    throw new HostRuntimeDomainError(
      `Host '${host.hostId}' cannot act as authoritative control plane unless kind is server.`,
    );
  }
  if (!host.capabilities.includes(HostCapabilityFlags.controlPlaneAuthority)) {
    throw new HostRuntimeDomainError(
      `Host '${host.hostId}' is missing control-plane-authority capability.`,
    );
  }
}

export function resolveStartupDependenciesByBoundaryLayer(
  host: Pick<HostRuntimeIdentity, "startupDependencies">,
): Readonly<Record<HostStartupDependencyBoundaryLayer, ReadonlyArray<HostStartupDependencyBoundary>>> {
  const grouped: Record<HostStartupDependencyBoundaryLayer, HostStartupDependencyBoundary[]> = {
    [HostStartupDependencyBoundaryLayers.sharedContracts]: [],
    [HostStartupDependencyBoundaryLayers.domain]: [],
    [HostStartupDependencyBoundaryLayers.application]: [],
    [HostStartupDependencyBoundaryLayers.infrastructure]: [],
    [HostStartupDependencyBoundaryLayers.host]: [],
  };

  for (const dependency of host.startupDependencies) {
    grouped[dependency.boundaryLayer].push(dependency);
  }

  return Object.freeze({
    [HostStartupDependencyBoundaryLayers.sharedContracts]: Object.freeze(
      grouped[HostStartupDependencyBoundaryLayers.sharedContracts],
    ),
    [HostStartupDependencyBoundaryLayers.domain]: Object.freeze(
      grouped[HostStartupDependencyBoundaryLayers.domain],
    ),
    [HostStartupDependencyBoundaryLayers.application]: Object.freeze(
      grouped[HostStartupDependencyBoundaryLayers.application],
    ),
    [HostStartupDependencyBoundaryLayers.infrastructure]: Object.freeze(
      grouped[HostStartupDependencyBoundaryLayers.infrastructure],
    ),
    [HostStartupDependencyBoundaryLayers.host]: Object.freeze(
      grouped[HostStartupDependencyBoundaryLayers.host],
    ),
  });
}


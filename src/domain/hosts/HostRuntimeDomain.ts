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

export const HostCapabilityCategories = Object.freeze({
  controlPlane: "control-plane",
  execution: "execution",
  interface: "interface",
  integration: "integration",
  transport: "transport",
  persistence: "persistence",
});

export type HostCapabilityCategory = typeof HostCapabilityCategories[keyof typeof HostCapabilityCategories];

export interface HostCapabilityDescriptor {
  readonly capability: HostCapabilityFlag;
  readonly category: HostCapabilityCategory;
  readonly summary: string;
}

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

export interface HostRuntimeRoleInspection {
  readonly hostId: string;
  readonly kind: HostRuntimeKind;
  readonly controlPlaneRole: HostControlPlaneRole;
  readonly isAuthoritativeControlPlane: boolean;
  readonly isControlPlaneClient: boolean;
  readonly isControlPlaneParticipant: boolean;
  readonly supportsNodeExecution: boolean;
  readonly supportsWorkerRuntime: boolean;
  readonly supportsUserInterface: boolean;
  readonly supportsTransportServing: boolean;
  readonly supportsLocalPersistence: boolean;
}

const HostCapabilityDescriptorCatalog: Readonly<Record<HostCapabilityFlag, HostCapabilityDescriptor>> = Object.freeze({
  [HostCapabilityFlags.controlPlaneAuthority]: Object.freeze({
    capability: HostCapabilityFlags.controlPlaneAuthority,
    category: HostCapabilityCategories.controlPlane,
    summary: "Host can own authoritative control-plane policy and orchestration responsibilities.",
  }),
  [HostCapabilityFlags.nodeExecution]: Object.freeze({
    capability: HostCapabilityFlags.nodeExecution,
    category: HostCapabilityCategories.execution,
    summary: "Host can execute node workloads and runtime jobs.",
  }),
  [HostCapabilityFlags.userInterfaceRendering]: Object.freeze({
    capability: HostCapabilityFlags.userInterfaceRendering,
    category: HostCapabilityCategories.interface,
    summary: "Host can render user-facing interface surfaces.",
  }),
  [HostCapabilityFlags.desktopShell]: Object.freeze({
    capability: HostCapabilityFlags.desktopShell,
    category: HostCapabilityCategories.interface,
    summary: "Host can compose desktop shell/window runtime boundaries.",
  }),
  [HostCapabilityFlags.browserRuntime]: Object.freeze({
    capability: HostCapabilityFlags.browserRuntime,
    category: HostCapabilityCategories.interface,
    summary: "Host can execute browser-based runtime composition.",
  }),
  [HostCapabilityFlags.workerRuntime]: Object.freeze({
    capability: HostCapabilityFlags.workerRuntime,
    category: HostCapabilityCategories.execution,
    summary: "Host can compose and run worker runtime execution flows.",
  }),
  [HostCapabilityFlags.localPersistence]: Object.freeze({
    capability: HostCapabilityFlags.localPersistence,
    category: HostCapabilityCategories.persistence,
    summary: "Host can own local persistence adapters and storage bootstrap wiring.",
  }),
  [HostCapabilityFlags.ipcBridge]: Object.freeze({
    capability: HostCapabilityFlags.ipcBridge,
    category: HostCapabilityCategories.integration,
    summary: "Host can expose inter-process communication bridge boundaries.",
  }),
  [HostCapabilityFlags.httpServing]: Object.freeze({
    capability: HostCapabilityFlags.httpServing,
    category: HostCapabilityCategories.transport,
    summary: "Host can serve HTTP transport endpoints.",
  }),
  [HostCapabilityFlags.transportTermination]: Object.freeze({
    capability: HostCapabilityFlags.transportTermination,
    category: HostCapabilityCategories.transport,
    summary: "Host can terminate and secure runtime transport connections.",
  }),
});

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

export function resolveHostCapabilityDescriptor(capability: HostCapabilityFlag): HostCapabilityDescriptor {
  const descriptor = HostCapabilityDescriptorCatalog[capability];
  if (!descriptor) {
    throw new HostRuntimeDomainError(`Host capability '${String(capability)}' is missing a descriptor.`);
  }
  return descriptor;
}

export function resolveHostCapabilityDescriptors(
  capabilities: ReadonlyArray<HostCapabilityFlag>,
): ReadonlyArray<HostCapabilityDescriptor> {
  const descriptors = new Map<HostCapabilityFlag, HostCapabilityDescriptor>();
  for (const capability of capabilities) {
    descriptors.set(capability, resolveHostCapabilityDescriptor(capability));
  }
  return Object.freeze([...descriptors.values()]);
}

export function inspectHostRuntimeRole(
  host: Pick<HostRuntimeIdentity, "hostId" | "kind" | "controlPlaneRole" | "capabilities">,
): HostRuntimeRoleInspection {
  const isAuthoritativeControlPlane = host.controlPlaneRole === HostControlPlaneRoles.authoritativeServer
    && hasHostCapability(host, HostCapabilityFlags.controlPlaneAuthority);
  const isControlPlaneClient = host.controlPlaneRole === HostControlPlaneRoles.controlPlaneClient;

  return Object.freeze({
    hostId: host.hostId,
    kind: host.kind,
    controlPlaneRole: host.controlPlaneRole,
    isAuthoritativeControlPlane,
    isControlPlaneClient,
    isControlPlaneParticipant: isAuthoritativeControlPlane || isControlPlaneClient,
    supportsNodeExecution: hasHostCapability(host, HostCapabilityFlags.nodeExecution),
    supportsWorkerRuntime: hasHostCapability(host, HostCapabilityFlags.workerRuntime),
    supportsUserInterface: hasHostCapability(host, HostCapabilityFlags.userInterfaceRendering),
    supportsTransportServing: hasHostCapability(host, HostCapabilityFlags.httpServing)
      || hasHostCapability(host, HostCapabilityFlags.transportTermination),
    supportsLocalPersistence: hasHostCapability(host, HostCapabilityFlags.localPersistence),
  });
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


import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  HostStartupDependencyBoundaryLayers,
  createHostRuntimeIdentity,
  type HostRuntimeIdentity,
} from "../domain/hosts/HostRuntimeDomain";

export const AuthoritativeServerHostRuntime = createHostRuntimeIdentity({
  hostId: "host:server:authoritative",
  kind: HostRuntimeKinds.server,
  controlPlaneRole: HostControlPlaneRoles.authoritativeServer,
  capabilities: [
    HostCapabilityFlags.controlPlaneAuthority,
    HostCapabilityFlags.httpServing,
    HostCapabilityFlags.transportTermination,
    HostCapabilityFlags.localPersistence,
  ],
  responsibilities: [
    "Compose and expose authoritative control-plane services.",
    "Own security, identity, and policy enforcement composition roots.",
    "Coordinate persisted server-side lifecycle state and observability.",
  ],
  startupDependencies: [{
    dependencyId: "dep:shared:host-contracts",
    description: "Shared host and transport contracts",
    boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
  }, {
    dependencyId: "dep:application:control-plane-services",
    description: "Application-level control-plane use cases",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
    requiredCapabilities: [HostCapabilityFlags.controlPlaneAuthority],
  }, {
    dependencyId: "dep:infrastructure:authoritative-server-adapters",
    description: "Infrastructure adapters for server persistence and transport",
    boundaryLayer: HostStartupDependencyBoundaryLayers.infrastructure,
  }, {
    dependencyId: "dep:host:server-bootstrap",
    description: "Server host bootstrap wiring and runtime process lifecycle",
    boundaryLayer: HostStartupDependencyBoundaryLayers.host,
  }],
});

export const DesktopHostRuntime = createHostRuntimeIdentity({
  hostId: "host:desktop:app-shell",
  kind: HostRuntimeKinds.desktop,
  controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
  capabilities: [
    HostCapabilityFlags.desktopShell,
    HostCapabilityFlags.userInterfaceRendering,
    HostCapabilityFlags.ipcBridge,
    HostCapabilityFlags.localPersistence,
  ],
  responsibilities: [
    "Compose desktop shell runtime and preload bridge boundaries.",
    "Render user interfaces and relay host capabilities through typed contracts.",
    "Consume authoritative control-plane APIs as a client runtime.",
  ],
  startupDependencies: [{
    dependencyId: "dep:shared:host-contracts",
    description: "Shared host and transport contracts",
    boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
  }, {
    dependencyId: "dep:application:desktop-runtime-services",
    description: "Application services consumed by desktop renderer and shell",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
  }, {
    dependencyId: "dep:infrastructure:desktop-adapters",
    description: "Desktop bridge adapters and local persistence infrastructure",
    boundaryLayer: HostStartupDependencyBoundaryLayers.infrastructure,
  }, {
    dependencyId: "dep:host:desktop-bootstrap",
    description: "Desktop host process and window bootstrap",
    boundaryLayer: HostStartupDependencyBoundaryLayers.host,
  }],
});

export const HybridHostRuntime = createHostRuntimeIdentity({
  hostId: "host:hybrid:desktop-worker",
  kind: HostRuntimeKinds.hybrid,
  controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
  capabilities: [
    HostCapabilityFlags.desktopShell,
    HostCapabilityFlags.userInterfaceRendering,
    HostCapabilityFlags.workerRuntime,
    HostCapabilityFlags.nodeExecution,
    HostCapabilityFlags.ipcBridge,
    HostCapabilityFlags.localPersistence,
  ],
  responsibilities: [
    "Compose desktop UI runtime with local worker execution boundaries.",
    "Run bounded local execution workers without assuming control-plane authority.",
    "Synchronize worker orchestration and UI state through host-owned composition roots.",
  ],
  startupDependencies: [{
    dependencyId: "dep:shared:host-contracts",
    description: "Shared host and transport contracts",
    boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
  }, {
    dependencyId: "dep:application:hybrid-orchestration-services",
    description: "Application orchestration for desktop and worker collaboration",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
    requiredCapabilities: [HostCapabilityFlags.nodeExecution],
  }, {
    dependencyId: "dep:infrastructure:hybrid-runtime-adapters",
    description: "Runtime adapters for local worker execution and persistence",
    boundaryLayer: HostStartupDependencyBoundaryLayers.infrastructure,
  }, {
    dependencyId: "dep:host:hybrid-bootstrap",
    description: "Hybrid host bootstrap and lifecycle wiring",
    boundaryLayer: HostStartupDependencyBoundaryLayers.host,
  }],
});

export const WebHostRuntime = createHostRuntimeIdentity({
  hostId: "host:web:thin-client",
  kind: HostRuntimeKinds.web,
  controlPlaneRole: HostControlPlaneRoles.controlPlaneClient,
  capabilities: [
    HostCapabilityFlags.browserRuntime,
    HostCapabilityFlags.userInterfaceRendering,
  ],
  responsibilities: [
    "Compose browser runtime UI boundaries.",
    "Consume authoritative control-plane APIs through transport contracts.",
    "Avoid server authority and privileged node execution concerns.",
  ],
  startupDependencies: [{
    dependencyId: "dep:shared:host-contracts",
    description: "Shared host and transport contracts",
    boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
  }, {
    dependencyId: "dep:application:web-runtime-services",
    description: "Application services consumed by thin-client runtime",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
  }, {
    dependencyId: "dep:host:web-bootstrap",
    description: "Web host bootstrap and route composition",
    boundaryLayer: HostStartupDependencyBoundaryLayers.host,
  }],
});

export const WorkerHostRuntime = createHostRuntimeIdentity({
  hostId: "host:worker:runtime",
  kind: HostRuntimeKinds.worker,
  controlPlaneRole: HostControlPlaneRoles.none,
  capabilities: [
    HostCapabilityFlags.workerRuntime,
    HostCapabilityFlags.nodeExecution,
  ],
  responsibilities: [
    "Compose background worker execution boundaries.",
    "Execute bounded workloads delegated by authoritative control-plane orchestration.",
    "Remain independent from control-plane authority composition responsibilities.",
  ],
  startupDependencies: [{
    dependencyId: "dep:shared:host-contracts",
    description: "Shared host and transport contracts",
    boundaryLayer: HostStartupDependencyBoundaryLayers.sharedContracts,
  }, {
    dependencyId: "dep:application:worker-execution-services",
    description: "Application-level worker execution orchestration",
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
    requiredCapabilities: [HostCapabilityFlags.nodeExecution],
  }, {
    dependencyId: "dep:host:worker-bootstrap",
    description: "Worker host lifecycle and process bootstrap",
    boundaryLayer: HostStartupDependencyBoundaryLayers.host,
  }],
});

export const HostRuntimeCatalog = Object.freeze({
  [HostRuntimeKinds.server]: AuthoritativeServerHostRuntime,
  [HostRuntimeKinds.desktop]: DesktopHostRuntime,
  [HostRuntimeKinds.hybrid]: HybridHostRuntime,
  [HostRuntimeKinds.web]: WebHostRuntime,
  [HostRuntimeKinds.worker]: WorkerHostRuntime,
});

export function resolveHostRuntimeFromCatalog(kind: keyof typeof HostRuntimeCatalog): HostRuntimeIdentity {
  return HostRuntimeCatalog[kind];
}


import type { HostRuntimeIdentity } from "@domain/hosts/HostRuntimeDomain";
import {
  AuthoritativeServerHostRuntime,
  DesktopHostRuntime,
  HybridHostRuntime,
  WebHostRuntime,
  WorkerHostRuntime,
} from "@hosts/HostRuntimeCatalog";
import {
  HostComposableServiceKinds,
  HostServiceExposureBoundaries,
  HostServiceRegistrationError,
  createHostServiceRegistry,
  type HostServiceRegistrationDefinition,
  type HostServiceRegistrationPlan,
} from "./HostServiceRegistration";

const ServiceRegistrations = Object.freeze<ReadonlyArray<HostServiceRegistrationDefinition>>([
  Object.freeze({
    serviceId: "svc:application:identity-control-plane",
    description: "Identity control-plane application use cases and policy orchestration.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:control-plane-services"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:application:workspace-control-plane",
    description: "Workspace and authorization control-plane orchestration services.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:control-plane-services"],
    dependsOn: ["svc:application:identity-control-plane"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:application:node-trust-control-plane",
    description: "Node enrollment, trust, and runtime material control-plane services.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:control-plane-services"],
    dependsOn: ["svc:application:identity-control-plane"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:application:asset-storage-control-plane",
    description: "Asset, storage, and encryption-aware control-plane orchestration services.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:control-plane-services"],
    dependsOn: [
      "svc:application:workspace-control-plane",
      "svc:platform:encryption-and-secrets",
    ],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:application:desktop-runtime-client",
    description: "Desktop host application services that consume authoritative control-plane APIs.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:desktop-runtime-services"],
    exposureBoundaries: [HostServiceExposureBoundaries.ui],
    dependsOn: ["svc:platform:ui-runtime-bridge"],
  }),
  Object.freeze({
    serviceId: "svc:application:hybrid-orchestration",
    description: "Hybrid host collaboration services for UI and local worker orchestration.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:hybrid-orchestration-services"],
    exposureBoundaries: [HostServiceExposureBoundaries.ui, HostServiceExposureBoundaries.execution],
    dependsOn: ["svc:platform:ui-runtime-bridge", "svc:platform:execution-runtime"],
  }),
  Object.freeze({
    serviceId: "svc:application:web-runtime-client",
    description: "Web thin-client application services for control-plane consumption.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:web-runtime-services"],
    exposureBoundaries: [HostServiceExposureBoundaries.ui, HostServiceExposureBoundaries.transport],
  }),
  Object.freeze({
    serviceId: "svc:application:worker-execution",
    description: "Worker host execution orchestration without control-plane authority.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: "application",
    startupDependencyIds: ["dep:application:worker-execution-services"],
    exposureBoundaries: [HostServiceExposureBoundaries.execution],
    dependsOn: ["svc:platform:execution-runtime"],
  }),
  Object.freeze({
    serviceId: "svc:infrastructure:server-transport-adapters",
    description: "Authoritative server HTTP/WebSocket transport adapters.",
    kind: HostComposableServiceKinds.infrastructureAdapter,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["http-serving", "transport-termination"],
    exposureBoundaries: [HostServiceExposureBoundaries.transport],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:infrastructure:server-persistence-adapters",
    description: "Authoritative server persistence adapters for control-plane state.",
    kind: HostComposableServiceKinds.infrastructureAdapter,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:infrastructure:authoritative-repository-adapters",
    description: "Authoritative repository adapter composition for persistent platform domains.",
    kind: HostComposableServiceKinds.infrastructureAdapter,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    dependsOn: ["svc:infrastructure:server-persistence-adapters"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:infrastructure:desktop-runtime-adapters",
    description: "Desktop runtime adapters for local persistence and host bridge composition.",
    kind: HostComposableServiceKinds.infrastructureAdapter,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:desktop-adapters"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
  }),
  Object.freeze({
    serviceId: "svc:infrastructure:hybrid-runtime-adapters",
    description: "Hybrid runtime adapters for bounded local worker execution and persistence.",
    kind: HostComposableServiceKinds.infrastructureAdapter,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:hybrid-runtime-adapters"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence, HostServiceExposureBoundaries.execution],
  }),
  Object.freeze({
    serviceId: "svc:platform:observability",
    description: "Shared host observability and diagnostics pipeline.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "host",
    dependsOn: ["svc:platform:boot-lifecycle"],
  }),
  Object.freeze({
    serviceId: "svc:platform:encryption-and-secrets",
    description: "Cross-cutting secret and encryption composition services.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:platform:persistence-bootstrap-runtime",
    description: "Host bootstrap runtime for authoritative SQLite migration and initialization ordering.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:platform:transaction-coordination",
    description: "Shared transaction-boundary services for grouped authoritative persistence mutations.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    dependsOn: ["svc:infrastructure:authoritative-repository-adapters"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:platform:persistence-shared-helpers",
    description: "Shared persistence mapper, diagnostics, and metadata helper composition services.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "infrastructure",
    startupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    requiredCapabilities: ["local-persistence"],
    exposureBoundaries: [HostServiceExposureBoundaries.persistence],
    dependsOn: ["svc:platform:persistence-bootstrap-runtime"],
    allowedControlPlaneRoles: ["authoritative-server"],
  }),
  Object.freeze({
    serviceId: "svc:platform:boot-lifecycle",
    description: "Host lifecycle orchestration and startup coordination services.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "host",
    startupDependencyIds: [
      "dep:shared:host-contracts",
      "dep:host:server-bootstrap",
      "dep:host:desktop-bootstrap",
      "dep:host:hybrid-bootstrap",
      "dep:host:web-bootstrap",
      "dep:host:worker-bootstrap",
    ],
  }),
  Object.freeze({
    serviceId: "svc:platform:ui-runtime-bridge",
    description: "UI runtime bridge services for desktop and browser hosts.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "host",
    exposureBoundaries: [HostServiceExposureBoundaries.ui],
  }),
  Object.freeze({
    serviceId: "svc:platform:execution-runtime",
    description: "Bounded local execution runtime services for hybrid and worker hosts.",
    kind: HostComposableServiceKinds.platformService,
    boundaryLayer: "host",
    exposureBoundaries: [HostServiceExposureBoundaries.execution],
  }),
]);

const HostServiceIdsByHostId = Object.freeze<Record<string, ReadonlyArray<string>>>({
  [AuthoritativeServerHostRuntime.hostId]: Object.freeze([
    "svc:application:identity-control-plane",
    "svc:application:workspace-control-plane",
    "svc:application:node-trust-control-plane",
    "svc:application:asset-storage-control-plane",
    "svc:infrastructure:server-transport-adapters",
    "svc:infrastructure:server-persistence-adapters",
    "svc:infrastructure:authoritative-repository-adapters",
    "svc:platform:encryption-and-secrets",
    "svc:platform:persistence-bootstrap-runtime",
    "svc:platform:transaction-coordination",
    "svc:platform:persistence-shared-helpers",
    "svc:platform:boot-lifecycle",
    "svc:platform:observability",
  ]),
  [DesktopHostRuntime.hostId]: Object.freeze([
    "svc:application:desktop-runtime-client",
    "svc:infrastructure:desktop-runtime-adapters",
    "svc:platform:ui-runtime-bridge",
    "svc:platform:boot-lifecycle",
    "svc:platform:observability",
  ]),
  [HybridHostRuntime.hostId]: Object.freeze([
    "svc:application:hybrid-orchestration",
    "svc:infrastructure:hybrid-runtime-adapters",
    "svc:platform:ui-runtime-bridge",
    "svc:platform:execution-runtime",
    "svc:platform:boot-lifecycle",
    "svc:platform:observability",
  ]),
  [WebHostRuntime.hostId]: Object.freeze([
    "svc:application:web-runtime-client",
    "svc:platform:ui-runtime-bridge",
    "svc:platform:boot-lifecycle",
    "svc:platform:observability",
  ]),
  [WorkerHostRuntime.hostId]: Object.freeze([
    "svc:application:worker-execution",
    "svc:platform:execution-runtime",
    "svc:platform:boot-lifecycle",
    "svc:platform:observability",
  ]),
});

export const AuthoritativeControlPlaneRequiredServiceIds = Object.freeze([
  "svc:application:identity-control-plane",
  "svc:application:workspace-control-plane",
  "svc:application:node-trust-control-plane",
  "svc:infrastructure:server-transport-adapters",
  "svc:infrastructure:server-persistence-adapters",
  "svc:infrastructure:authoritative-repository-adapters",
  "svc:platform:encryption-and-secrets",
  "svc:platform:persistence-bootstrap-runtime",
  "svc:platform:transaction-coordination",
  "svc:platform:persistence-shared-helpers",
]);

export const DesktopHostRequiredServiceIds = Object.freeze([
  "svc:application:desktop-runtime-client",
  "svc:infrastructure:desktop-runtime-adapters",
  "svc:platform:ui-runtime-bridge",
  "svc:platform:boot-lifecycle",
  "svc:platform:observability",
]);

export const HybridHostRequiredServiceIds = Object.freeze([
  "svc:application:hybrid-orchestration",
  "svc:infrastructure:hybrid-runtime-adapters",
  "svc:platform:ui-runtime-bridge",
  "svc:platform:execution-runtime",
  "svc:platform:boot-lifecycle",
  "svc:platform:observability",
]);

export const WebHostRequiredServiceIds = Object.freeze([
  "svc:application:web-runtime-client",
  "svc:platform:ui-runtime-bridge",
  "svc:platform:boot-lifecycle",
  "svc:platform:observability",
]);

export const WorkerHostRequiredServiceIds = Object.freeze([
  "svc:application:worker-execution",
  "svc:platform:execution-runtime",
  "svc:platform:boot-lifecycle",
  "svc:platform:observability",
]);

const ServiceRegistry = createHostServiceRegistry(ServiceRegistrations);

export function resolveHostServiceRegistrationIds(host: Pick<HostRuntimeIdentity, "hostId">): ReadonlyArray<string> {
  const ids = HostServiceIdsByHostId[host.hostId];
  if (!ids) {
    throw new HostServiceRegistrationError(`Host service registration catalog is missing host '${host.hostId}'.`);
  }
  return ids;
}

export function composeHostServiceRegistrationPlan(input: {
  readonly host: HostRuntimeIdentity;
  readonly requiredStartupDependencyIds?: ReadonlyArray<string>;
  readonly includeServiceIds?: ReadonlyArray<string>;
}): HostServiceRegistrationPlan {
  const includeServiceIds = input.includeServiceIds ?? resolveHostServiceRegistrationIds(input.host);
  return ServiceRegistry.composeForHost({
    host: input.host,
    includeServiceIds,
    requiredStartupDependencyIds: input.requiredStartupDependencyIds,
  });
}

export function assertAuthoritativeControlPlaneServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
  for (const requiredServiceId of AuthoritativeControlPlaneRequiredServiceIds) {
    if (!selected.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Authoritative control-plane composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
}

export function assertDesktopHostServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
  for (const requiredServiceId of DesktopHostRequiredServiceIds) {
    if (!selected.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Desktop host composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
}

export function assertHybridHostServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
  for (const requiredServiceId of HybridHostRequiredServiceIds) {
    if (!selected.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Hybrid host composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
}

export function assertWebHostServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
  for (const requiredServiceId of WebHostRequiredServiceIds) {
    if (!selected.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Web host composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
}

export function assertWorkerHostServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
  for (const requiredServiceId of WorkerHostRequiredServiceIds) {
    if (!selected.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Worker host composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
}


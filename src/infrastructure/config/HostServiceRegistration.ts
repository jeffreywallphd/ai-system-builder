import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostStartupDependencyBoundaryLayers,
  type HostCapabilityFlag,
  type HostControlPlaneRole,
  type HostRuntimeIdentity,
  type HostStartupDependencyBoundaryLayer,
} from "../../domain/hosts/HostRuntimeDomain";

export class HostServiceRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HostServiceRegistrationError";
  }
}

export const HostComposableServiceKinds = Object.freeze({
  applicationPort: "application-port",
  infrastructureAdapter: "infrastructure-adapter",
  platformService: "platform-service",
});

export type HostComposableServiceKind = typeof HostComposableServiceKinds[keyof typeof HostComposableServiceKinds];

export const HostServiceExposureBoundaries = Object.freeze({
  ui: "ui",
  transport: "transport",
  execution: "execution",
  persistence: "persistence",
});

export type HostServiceExposureBoundary =
  typeof HostServiceExposureBoundaries[keyof typeof HostServiceExposureBoundaries];

export interface HostServiceRegistrationDefinition {
  readonly serviceId: string;
  readonly description: string;
  readonly kind: HostComposableServiceKind;
  readonly boundaryLayer: HostStartupDependencyBoundaryLayer;
  readonly startupDependencyIds?: ReadonlyArray<string>;
  readonly requiredCapabilities?: ReadonlyArray<HostCapabilityFlag>;
  readonly allowedControlPlaneRoles?: ReadonlyArray<HostControlPlaneRole>;
  readonly exposureBoundaries?: ReadonlyArray<HostServiceExposureBoundary>;
  readonly dependsOn?: ReadonlyArray<string>;
}

export interface HostServiceRegistrationPlan {
  readonly hostId: string;
  readonly selectedServices: ReadonlyArray<HostServiceRegistrationDefinition>;
  readonly startupDependencyCoverage: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly servicesByLayer: Readonly<Record<HostStartupDependencyBoundaryLayer, ReadonlyArray<string>>>;
}

const ServiceIdPattern = /^[a-z][a-z0-9:-]{2,126}$/;

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostServiceRegistrationError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIdentifiers(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeCapabilities(values: ReadonlyArray<HostCapabilityFlag> | undefined): ReadonlyArray<HostCapabilityFlag> {
  const deduped = new Set<HostCapabilityFlag>();
  for (const value of values ?? []) {
    if (!Object.values(HostCapabilityFlags).includes(value)) {
      throw new HostServiceRegistrationError(`Host capability '${String(value)}' is invalid.`);
    }
    deduped.add(value);
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeControlPlaneRoles(
  values: ReadonlyArray<HostControlPlaneRole> | undefined,
): ReadonlyArray<HostControlPlaneRole> {
  const deduped = new Set<HostControlPlaneRole>();
  for (const value of values ?? []) {
    if (!Object.values(HostControlPlaneRoles).includes(value)) {
      throw new HostServiceRegistrationError(`Host control-plane role '${String(value)}' is invalid.`);
    }
    deduped.add(value);
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeExposureBoundaries(
  values: ReadonlyArray<HostServiceExposureBoundary> | undefined,
): ReadonlyArray<HostServiceExposureBoundary> {
  const deduped = new Set<HostServiceExposureBoundary>();
  for (const value of values ?? []) {
    if (!Object.values(HostServiceExposureBoundaries).includes(value)) {
      throw new HostServiceRegistrationError(`Host service exposure boundary '${String(value)}' is invalid.`);
    }
    deduped.add(value);
  }
  return Object.freeze([...deduped.values()]);
}

function validateLayerAlignment(service: Pick<HostServiceRegistrationDefinition, "serviceId" | "kind" | "boundaryLayer">): void {
  if (service.kind === HostComposableServiceKinds.applicationPort
    && service.boundaryLayer !== HostStartupDependencyBoundaryLayers.application) {
    throw new HostServiceRegistrationError(
      `Service '${service.serviceId}' must use application boundary layer for kind '${HostComposableServiceKinds.applicationPort}'.`,
    );
  }
  if (service.kind === HostComposableServiceKinds.infrastructureAdapter
    && service.boundaryLayer !== HostStartupDependencyBoundaryLayers.infrastructure) {
    throw new HostServiceRegistrationError(
      `Service '${service.serviceId}' must use infrastructure boundary layer for kind '${HostComposableServiceKinds.infrastructureAdapter}'.`,
    );
  }
  if (service.kind === HostComposableServiceKinds.platformService
    && ![
      HostStartupDependencyBoundaryLayers.infrastructure,
      HostStartupDependencyBoundaryLayers.host,
    ].includes(service.boundaryLayer)) {
    throw new HostServiceRegistrationError(
      `Service '${service.serviceId}' must use infrastructure or host boundary layer for kind '${HostComposableServiceKinds.platformService}'.`,
    );
  }
}

function normalizeDefinition(input: HostServiceRegistrationDefinition): HostServiceRegistrationDefinition {
  const serviceId = normalizeRequired(input.serviceId, "Host service registration serviceId");
  if (!ServiceIdPattern.test(serviceId)) {
    throw new HostServiceRegistrationError(
      "Host service registration serviceId must start with a letter and use lowercase letters, numbers, ':', or '-'.",
    );
  }
  validateLayerAlignment({
    serviceId,
    kind: input.kind,
    boundaryLayer: input.boundaryLayer,
  });
  const dependsOn = normalizeIdentifiers(input.dependsOn);
  if (dependsOn.includes(serviceId)) {
    throw new HostServiceRegistrationError(`Service '${serviceId}' cannot depend on itself.`);
  }

  return Object.freeze({
    serviceId,
    description: normalizeRequired(input.description, `Service '${serviceId}' description`),
    kind: input.kind,
    boundaryLayer: input.boundaryLayer,
    startupDependencyIds: normalizeIdentifiers(input.startupDependencyIds),
    requiredCapabilities: normalizeCapabilities(input.requiredCapabilities),
    allowedControlPlaneRoles: normalizeControlPlaneRoles(input.allowedControlPlaneRoles),
    exposureBoundaries: normalizeExposureBoundaries(input.exposureBoundaries),
    dependsOn,
  });
}

function assertNoCircularDependencies(
  definitionsById: ReadonlyMap<string, HostServiceRegistrationDefinition>,
): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (serviceId: string, path: string[]) => {
    if (visited.has(serviceId)) {
      return;
    }
    if (visiting.has(serviceId)) {
      throw new HostServiceRegistrationError(
        `Circular host service dependency detected: ${[...path, serviceId].join(" -> ")}.`,
      );
    }

    const service = definitionsById.get(serviceId);
    if (!service) {
      return;
    }

    visiting.add(serviceId);
    for (const dependencyId of service.dependsOn ?? []) {
      if (!definitionsById.has(dependencyId)) {
        throw new HostServiceRegistrationError(
          `Service '${serviceId}' depends on unknown service '${dependencyId}'.`,
        );
      }
      visit(dependencyId, [...path, serviceId]);
    }
    visiting.delete(serviceId);
    visited.add(serviceId);
  };

  for (const serviceId of definitionsById.keys()) {
    visit(serviceId, []);
  }
}

function assertHostCanComposeService(
  host: HostRuntimeIdentity,
  service: HostServiceRegistrationDefinition,
): void {
  for (const requiredCapability of service.requiredCapabilities ?? []) {
    if (!host.capabilities.includes(requiredCapability)) {
      throw new HostServiceRegistrationError(
        `Host '${host.hostId}' cannot compose '${service.serviceId}' because capability '${requiredCapability}' is missing.`,
      );
    }
  }
  if ((service.allowedControlPlaneRoles?.length ?? 0) > 0
    && !service.allowedControlPlaneRoles?.includes(host.controlPlaneRole)) {
    throw new HostServiceRegistrationError(
      `Host '${host.hostId}' cannot compose '${service.serviceId}' because control-plane role '${host.controlPlaneRole}' is not allowed.`,
    );
  }

  const boundaryRequires: Record<HostServiceExposureBoundary, ReadonlyArray<HostCapabilityFlag>> = {
    [HostServiceExposureBoundaries.ui]: [HostCapabilityFlags.userInterfaceRendering],
    [HostServiceExposureBoundaries.transport]: [
      HostCapabilityFlags.transportTermination,
      HostCapabilityFlags.ipcBridge,
      HostCapabilityFlags.browserRuntime,
    ],
    [HostServiceExposureBoundaries.execution]: [
      HostCapabilityFlags.nodeExecution,
      HostCapabilityFlags.workerRuntime,
    ],
    [HostServiceExposureBoundaries.persistence]: [HostCapabilityFlags.localPersistence],
  };

  for (const boundary of service.exposureBoundaries ?? []) {
    const required = boundaryRequires[boundary] ?? [];
    if (!required.some((capability) => host.capabilities.includes(capability))) {
      throw new HostServiceRegistrationError(
        `Host '${host.hostId}' cannot compose '${service.serviceId}' because exposure boundary '${boundary}' is not supported.`,
      );
    }
  }
}

export interface HostServiceRegistry {
  resolveService(serviceId: string): HostServiceRegistrationDefinition | undefined;
  composeForHost(input: {
    readonly host: HostRuntimeIdentity;
    readonly includeServiceIds: ReadonlyArray<string>;
    readonly requiredStartupDependencyIds?: ReadonlyArray<string>;
  }): HostServiceRegistrationPlan;
}

export function createHostServiceRegistry(
  registrations: ReadonlyArray<HostServiceRegistrationDefinition>,
): HostServiceRegistry {
  const definitionsById = new Map<string, HostServiceRegistrationDefinition>();
  for (const definition of registrations) {
    const normalized = normalizeDefinition(definition);
    if (definitionsById.has(normalized.serviceId)) {
      throw new HostServiceRegistrationError(`Host service registration '${normalized.serviceId}' is duplicated.`);
    }
    definitionsById.set(normalized.serviceId, normalized);
  }
  assertNoCircularDependencies(definitionsById);

  const resolveService = (serviceId: string): HostServiceRegistrationDefinition | undefined => {
    return definitionsById.get(serviceId.trim());
  };

  return Object.freeze({
    resolveService,
    composeForHost(input): HostServiceRegistrationPlan {
      const includeServiceIds = normalizeIdentifiers(input.includeServiceIds);
      if (includeServiceIds.length < 1) {
        throw new HostServiceRegistrationError(`Host '${input.host.hostId}' composition requires at least one service id.`);
      }
      const requiredStartupDependencyIds = normalizeIdentifiers(input.requiredStartupDependencyIds);

      const selectedById = new Map<string, HostServiceRegistrationDefinition>();
      const visiting = new Set<string>();
      const topological: HostServiceRegistrationDefinition[] = [];

      const includeService = (serviceId: string) => {
        if (selectedById.has(serviceId)) {
          return;
        }
        if (visiting.has(serviceId)) {
          throw new HostServiceRegistrationError(
            `Circular host service dependency detected while composing host '${input.host.hostId}' at '${serviceId}'.`,
          );
        }
        const service = definitionsById.get(serviceId);
        if (!service) {
          throw new HostServiceRegistrationError(
            `Host '${input.host.hostId}' references unknown service '${serviceId}'.`,
          );
        }
        visiting.add(serviceId);
        for (const dependencyId of service.dependsOn ?? []) {
          includeService(dependencyId);
        }
        visiting.delete(serviceId);

        assertHostCanComposeService(input.host, service);
        selectedById.set(service.serviceId, service);
        topological.push(service);
      };

      for (const serviceId of includeServiceIds) {
        includeService(serviceId);
      }

      const startupDependencyCoverage = new Map<string, string[]>();
      for (const service of topological) {
        for (const startupDependencyId of service.startupDependencyIds ?? []) {
          const coveredBy = startupDependencyCoverage.get(startupDependencyId) ?? [];
          coveredBy.push(service.serviceId);
          startupDependencyCoverage.set(startupDependencyId, coveredBy);
        }
      }

      for (const requiredStartupDependencyId of requiredStartupDependencyIds) {
        const coveredBy = startupDependencyCoverage.get(requiredStartupDependencyId) ?? [];
        if (coveredBy.length < 1) {
          throw new HostServiceRegistrationError(
            `Host '${input.host.hostId}' has no composed service covering startup dependency '${requiredStartupDependencyId}'.`,
          );
        }
      }

      const byLayer: Record<HostStartupDependencyBoundaryLayer, string[]> = {
        [HostStartupDependencyBoundaryLayers.sharedContracts]: [],
        [HostStartupDependencyBoundaryLayers.domain]: [],
        [HostStartupDependencyBoundaryLayers.application]: [],
        [HostStartupDependencyBoundaryLayers.infrastructure]: [],
        [HostStartupDependencyBoundaryLayers.host]: [],
      };
      for (const service of topological) {
        byLayer[service.boundaryLayer].push(service.serviceId);
      }

      const coverage: Record<string, ReadonlyArray<string>> = {};
      for (const [startupDependencyId, coveredBy] of startupDependencyCoverage.entries()) {
        coverage[startupDependencyId] = Object.freeze([...coveredBy]);
      }

      return Object.freeze({
        hostId: input.host.hostId,
        selectedServices: Object.freeze([...topological]),
        startupDependencyCoverage: Object.freeze(coverage),
        servicesByLayer: Object.freeze({
          [HostStartupDependencyBoundaryLayers.sharedContracts]: Object.freeze(
            [...byLayer[HostStartupDependencyBoundaryLayers.sharedContracts]],
          ),
          [HostStartupDependencyBoundaryLayers.domain]: Object.freeze(
            [...byLayer[HostStartupDependencyBoundaryLayers.domain]],
          ),
          [HostStartupDependencyBoundaryLayers.application]: Object.freeze(
            [...byLayer[HostStartupDependencyBoundaryLayers.application]],
          ),
          [HostStartupDependencyBoundaryLayers.infrastructure]: Object.freeze(
            [...byLayer[HostStartupDependencyBoundaryLayers.infrastructure]],
          ),
          [HostStartupDependencyBoundaryLayers.host]: Object.freeze(
            [...byLayer[HostStartupDependencyBoundaryLayers.host]],
          ),
        }),
      });
    },
  });
}

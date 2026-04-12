import {
  type AuthoritativeServerHostEntrypointOptions,
  type AuthoritativeServerHostEntrypointBootOptions,
  constructAuthoritativeServerHostAssembly,
  createAuthoritativeServerHostBootConfiguration,
  type ConstructedAuthoritativeServerHostAssembly,
} from "./AuthoritativeServerHostEntrypoint";
import type { HostBootConfiguration } from "@application/common/HostCompositionContracts";
import type { AuthoritativeServerHostRuntimeHandle } from "./AuthoritativeServerCompositionRoot";
import {
  assertAuthMinimalServerApiRouteRegistrationCoverage,
  composeAuthMinimalServerApiRouteRegistrationPlan,
} from "./AuthMinimalServerApiRouteComposition";
import { startAuthMinimalIdentityServerHost } from "./AuthMinimalIdentityServerHost";
import {
  createSqlitePersistenceRuntime,
  resolveSqlitePersistenceRuntimeConfiguration,
} from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import {
  createAuthMinimalPersistentPlatformServices,
  createAuthMinimalPersistenceMigrationHooks,
  type AuthMinimalPersistentPlatformServices,
} from "@infrastructure/persistence/AuthMinimalPersistenceComposition";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import {
  HostServiceRegistrationError,
  type HostServiceRegistrationPlan,
} from "@infrastructure/config/HostServiceRegistration";
import { composeHostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistrationCatalog";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";

const DefaultAuthMinimalStartupReason = "auth-minimal-server-entrypoint-startup";
export type AuthMinimalServerHostRuntimeHandle = AuthoritativeServerHostRuntimeHandle;

export interface AuthMinimalServerHostEntrypointOptions
  extends AuthoritativeServerHostEntrypointOptions {
  readonly boot?: AuthoritativeServerHostEntrypointBootOptions;
}

export const AuthMinimalServerRequiredServiceIds = Object.freeze([
  "svc:application:identity-control-plane",
  "svc:infrastructure:server-transport-adapters",
  "svc:infrastructure:server-persistence-adapters",
  "svc:platform:boot-lifecycle",
]);

export const AuthMinimalServerForbiddenServiceIds = Object.freeze([
  "svc:application:workspace-control-plane",
  "svc:application:node-trust-control-plane",
  "svc:application:asset-storage-control-plane",
  "svc:infrastructure:authoritative-repository-adapters",
  "svc:platform:transaction-coordination",
  "svc:platform:persistence-shared-helpers",
]);

export const AuthMinimalServerForbiddenPersistentServiceKeys = Object.freeze([
  "authorizationRepository",
  "nodeTrustRepository",
  "executionNodeRepository",
  "certificateAuthorityRepository",
  "secretRecordRepository",
  "storageInstanceRepository",
  "assetRepository",
  "assetUploadSessionRepository",
  "imageAssetRepository",
  "imageWorkflowSystemRepository",
  "platformPersistenceRepository",
  "auditLedgerRepository",
  "deploymentPolicyRepository",
  "generatedResultRepository",
]);

function isDevelopmentLikeEnvironment(environment: Readonly<Record<string, string | undefined>>): boolean {
  const nodeEnv = environment.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "production";
}

function emitAuthMinimalScopeDiagnostics(input: {
  readonly options: AuthMinimalServerHostEntrypointOptions;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly event: string;
  readonly details: Readonly<Record<string, unknown>>;
}): void {
  if (!isDevelopmentLikeEnvironment(input.environment)) {
    return;
  }
  const payload = Object.freeze({
    event: input.event,
    startupReason: input.options.boot?.startupReason ?? DefaultAuthMinimalStartupReason,
    details: input.details,
  });
  if (input.options.hostOptions.logger) {
    input.options.hostOptions.logger.info(payload);
    return;
  }
  console.info(payload);
}

function createAuthMinimalServerServiceRegistrationPlan(
  planInput: { readonly boot: HostBootConfiguration },
): HostServiceRegistrationPlan {
  return composeHostServiceRegistrationPlan({
    host: planInput.boot.host,
    includeServiceIds: AuthMinimalServerRequiredServiceIds,
    requiredStartupDependencyIds: planInput.boot.requiredDependencyIds,
  });
}

export function assertAuthMinimalServerServiceCoverage(plan: HostServiceRegistrationPlan): void {
  const selectedServiceIds = plan.selectedServices.map((service) => service.serviceId);
  const selectedServiceIdsSet = new Set(selectedServiceIds);
  for (const requiredServiceId of AuthMinimalServerRequiredServiceIds) {
    if (!selectedServiceIdsSet.has(requiredServiceId)) {
      throw new HostServiceRegistrationError(
        `Auth-minimal startup composition is missing required service '${requiredServiceId}'.`,
      );
    }
  }
  const unexpectedServiceIds = selectedServiceIds
    .filter((serviceId) => !AuthMinimalServerRequiredServiceIds.includes(serviceId))
    .sort();
  if (unexpectedServiceIds.length > 0) {
    throw new HostServiceRegistrationError(
      `Auth-minimal startup composition includes unexpected services: ${unexpectedServiceIds.join(", ")}.`,
    );
  }
  const forbiddenServiceIds = AuthMinimalServerForbiddenServiceIds
    .filter((serviceId) => selectedServiceIdsSet.has(serviceId));
  if (forbiddenServiceIds.length > 0) {
    throw new HostServiceRegistrationError(
      `Auth-minimal startup composition includes forbidden services: ${forbiddenServiceIds.join(", ")}.`,
    );
  }
}

function assertAuthMinimalPersistentServiceScope(
  services: AuthMinimalPersistentPlatformServices,
): void {
  if (!services.identityRepository || !services.trustedDeviceRepository || !services.workspaceRepository) {
    throw new Error("Auth-minimal startup requires identity, trusted-device, and workspace persistence coverage.");
  }
  const forbiddenKeys = AuthMinimalServerForbiddenPersistentServiceKeys
    .filter((key) => (services as Readonly<Record<string, unknown>>)[key] !== undefined);
  if (forbiddenKeys.length > 0) {
    throw new Error(
      `Auth-minimal startup composed forbidden persistence services: ${forbiddenKeys.join(", ")}.`,
    );
  }
}

function createAuthMinimalDeploymentPolicyBootstrapStub(): DeploymentPolicyBootstrapResolutionResult {
  const context = Object.freeze({
    profileId: "auth-minimal",
  });
  return Object.freeze({
    scope: Object.freeze({
      kind: "deployment-policy-scope",
      scopeId: "auth-minimal:bootstrap",
    }),
    activeProfile: Object.freeze({
      profileId: "auth-minimal",
      source: "auth-minimal-bootstrap",
    }),
    overrideRecords: Object.freeze([]),
    evaluationContext: context,
    evaluationService: {} as never,
    snapshot: {} as never,
    validation: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
      evaluatedAt: new Date().toISOString(),
    }),
    contextResolver: Object.freeze({
      resolveContext: async () => context,
    }),
  });
}

export function createAuthMinimalServerHostBootConfiguration(
  options?: AuthoritativeServerHostEntrypointBootOptions,
): HostBootConfiguration {
  return createAuthoritativeServerHostBootConfiguration({
    ...options,
    startupReason: options?.startupReason ?? DefaultAuthMinimalStartupReason,
  });
}

export function constructAuthMinimalServerHostAssembly(
  options: AuthMinimalServerHostEntrypointOptions,
): ConstructedAuthoritativeServerHostAssembly {
  const resolvedEnvironment = options.boot?.environment ?? options.hostOptions.env ?? process.env;
  return constructAuthoritativeServerHostAssembly({
    ...options,
    startHost: options.startHost ?? startAuthMinimalIdentityServerHost,
    bootstrap: {
      ...options.bootstrap,
      createPersistenceRuntime: options.bootstrap?.createPersistenceRuntime
        ?? ((runtimeInput) => createSqlitePersistenceRuntime({
          configuration: resolveSqlitePersistenceRuntimeConfiguration({
            databasePath: runtimeInput.hostConfiguration.databasePath,
            environment: runtimeInput.environment,
          }),
          migrationHooks: createAuthMinimalPersistenceMigrationHooks(),
        })),
      composePersistentPlatformServices: options.bootstrap?.composePersistentPlatformServices
        ?? ((servicesInput) => {
          const services = createAuthMinimalPersistentPlatformServices({
            databasePath: servicesInput.persistenceRuntime.configuration.databasePath,
          });
          assertAuthMinimalPersistentServiceScope(services);
          emitAuthMinimalScopeDiagnostics({
            options,
            environment: resolvedEnvironment,
            event: "auth-minimal-server.startup.persistence-scope",
            details: Object.freeze({
              selectedPersistenceKeys: Object.freeze(Object.keys(services).sort()),
              forbiddenPersistenceKeys: AuthMinimalServerForbiddenPersistentServiceKeys,
            }),
          });
          return services as unknown as AuthoritativePersistentPlatformServices;
        }),
      composeServiceRegistrationPlan: options.bootstrap?.composeServiceRegistrationPlan
        ?? ((boot) => {
          const plan = createAuthMinimalServerServiceRegistrationPlan({
            boot,
          });
          emitAuthMinimalScopeDiagnostics({
            options,
            environment: resolvedEnvironment,
            event: "auth-minimal-server.startup.service-scope",
            details: Object.freeze({
              selectedServices: Object.freeze(plan.selectedServices.map((service) => service.serviceId)),
              requiredServices: AuthMinimalServerRequiredServiceIds,
              forbiddenServices: AuthMinimalServerForbiddenServiceIds,
            }),
          });
          return plan;
        }),
      composeApiRouteRegistrationPlan: options.bootstrap?.composeApiRouteRegistrationPlan
        ?? composeAuthMinimalServerApiRouteRegistrationPlan,
      assertApiRouteRegistrationCoverage: options.bootstrap?.assertApiRouteRegistrationCoverage
        ?? ((plan: AuthoritativeApiRouteRegistrationPlan) => {
          assertAuthMinimalServerApiRouteRegistrationCoverage(plan);
          emitAuthMinimalScopeDiagnostics({
            options,
            environment: resolvedEnvironment,
            event: "auth-minimal-server.startup.route-scope",
            details: Object.freeze({
              registeredRouteFamilies: Object.freeze(
                plan.registeredRouteFamilies.map((family) => family.routeFamilyId),
              ),
              registeredRoutePrefixes: plan.registeredRoutePrefixes,
            }),
          });
        }),
      resolveDeploymentPolicyBootstrap: options.bootstrap?.resolveDeploymentPolicyBootstrap
        ?? (async () => createAuthMinimalDeploymentPolicyBootstrapStub()),
      assertServiceCoverage: options.bootstrap?.assertServiceCoverage
        ?? assertAuthMinimalServerServiceCoverage,
      executionInfrastructureEnabled: false,
    },
    boot: {
      ...options.boot,
      startupReason: options.boot?.startupReason ?? DefaultAuthMinimalStartupReason,
    },
  });
}

export async function startAuthMinimalServerHostAssembly(
  options: AuthMinimalServerHostEntrypointOptions,
): Promise<AuthMinimalServerHostRuntimeHandle> {
  const assembly = constructAuthMinimalServerHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}

export type { AuthoritativeServerHostRuntimeHandle } from "./AuthoritativeServerCompositionRoot";

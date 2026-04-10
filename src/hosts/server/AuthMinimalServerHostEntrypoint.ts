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
} from "@infrastructure/persistence/AuthMinimalPersistenceComposition";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";

const DefaultAuthMinimalStartupReason = "auth-minimal-server-entrypoint-startup";

export interface AuthMinimalServerHostEntrypointOptions
  extends AuthoritativeServerHostEntrypointOptions {
  readonly boot?: AuthoritativeServerHostEntrypointBootOptions;
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
        ?? ((servicesInput) => createAuthMinimalPersistentPlatformServices({
          databasePath: servicesInput.persistenceRuntime.configuration.databasePath,
        }) as unknown as AuthoritativePersistentPlatformServices),
      composeApiRouteRegistrationPlan: options.bootstrap?.composeApiRouteRegistrationPlan
        ?? composeAuthMinimalServerApiRouteRegistrationPlan,
      assertApiRouteRegistrationCoverage: options.bootstrap?.assertApiRouteRegistrationCoverage
        ?? assertAuthMinimalServerApiRouteRegistrationCoverage,
      resolveDeploymentPolicyBootstrap: options.bootstrap?.resolveDeploymentPolicyBootstrap
        ?? (async () => createAuthMinimalDeploymentPolicyBootstrapStub()),
      assertServiceCoverage: options.bootstrap?.assertServiceCoverage
        ?? ((_plan: HostServiceRegistrationPlan) => {}),
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
): Promise<AuthoritativeServerHostRuntimeHandle> {
  const assembly = constructAuthMinimalServerHostAssembly(options);
  return assembly.compositionRoot.compose(assembly.boot);
}

export type { AuthoritativeServerHostRuntimeHandle } from "./AuthoritativeServerCompositionRoot";

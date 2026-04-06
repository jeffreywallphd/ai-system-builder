import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  assertHostCanRunAsControlPlane,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../HostRuntimeCatalog";
import {
  HostBootstrapStageIds,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapStageId,
  type HostBootstrapReusableStageHandlers,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import type { HostCapabilityFlag } from "../../domain/hosts/HostRuntimeDomain";
import {
  assertAuthoritativeControlPlaneServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import { resolveHostStartupConfiguration } from "../../infrastructure/config/HostStartupConfiguration";
import {
  startIdentityServerHost,
  type IdentityServerHost,
  type IdentityServerHostOptions,
} from "../../../hosts/server/IdentityServerHost";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import { HostRuntimeMetadataArtifactKey, advertiseHostRuntimeMetadata } from "../HostRuntimeMetadataCatalog";
import {
  createSqlitePersistenceRuntime,
  resolveSqlitePersistenceRuntimeConfiguration,
  type SqlitePersistenceRuntime,
} from "../../infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import {
  createAuthoritativePersistenceMigrationHooks,
  createAuthoritativePersistentPlatformServices,
  type AuthoritativePersistentPlatformServices,
} from "../../infrastructure/persistence/AuthoritativePersistenceComposition";

export interface AuthoritativeServerHostRuntimeHandle extends HostRuntimeHandle {
  readonly port: number;
  readonly address: string;
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
}

export interface AuthoritativeServerCompositionRootOptions {
  readonly hostOptions: IdentityServerHostOptions;
  readonly startHost?: (options: IdentityServerHostOptions) => Promise<IdentityServerHost>;
  readonly bootstrap?: {
    readonly deploymentProfile?: {
      readonly profileId?: string;
      readonly environmentName?: string;
      readonly releaseChannel?: string;
      readonly region?: string;
      readonly metadata?: Readonly<Record<string, string | undefined>>;
    };
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly enabledCapabilities?: ReadonlyArray<HostCapabilityFlag>;
    readonly stageHandlers?: HostBootstrapReusableStageHandlers;
    readonly hostSpecificStages?: ReadonlyArray<HostSpecificBootstrapStage>;
    readonly lifecycleHooks?: HostStartupLifecycleHooks;
    readonly composeServiceRegistrationPlan?: (boot: HostBootConfiguration) => HostServiceRegistrationPlan;
    readonly assertServiceCoverage?: (plan: HostServiceRegistrationPlan) => void;
    readonly createPersistenceRuntime?: (input: {
      readonly hostConfiguration: IdentityServerHostOptions;
      readonly environment: Readonly<Record<string, string | undefined>>;
    }) => SqlitePersistenceRuntime;
    readonly composePersistentPlatformServices?: (input: {
      readonly persistenceRuntime: SqlitePersistenceRuntime;
      readonly hostConfiguration: IdentityServerHostOptions;
      readonly environment: Readonly<Record<string, string | undefined>>;
    }) => AuthoritativePersistentPlatformServices;
  };
}

const StartedHostArtifactKey = "artifact:host:server:authoritative:runtime";
export const AuthoritativeServerServiceRegistrationPlanArtifactKey =
  "artifact:host:server:authoritative:service-registration-plan";
export const AuthoritativeServerPersistenceRuntimeArtifactKey = "artifact:host:server:authoritative:persistence-runtime";
export const AuthoritativeServerPersistentPlatformServicesArtifactKey =
  "artifact:host:server:authoritative:persistent-platform-services";

function combineStartupLifecycleHooks(
  primary: HostStartupLifecycleHooks | undefined,
  secondary: HostStartupLifecycleHooks | undefined,
): HostStartupLifecycleHooks {
  return Object.freeze({
    onStageStarting: async (event) => {
      await primary?.onStageStarting?.(event);
      await secondary?.onStageStarting?.(event);
    },
    onStageCompleted: async (event) => {
      await primary?.onStageCompleted?.(event);
      await secondary?.onStageCompleted?.(event);
    },
    onStageFailed: async (event) => {
      await primary?.onStageFailed?.(event);
      await secondary?.onStageFailed?.(event);
    },
    onPipelineCompleted: async (event) => {
      await primary?.onPipelineCompleted?.(event);
      await secondary?.onPipelineCompleted?.(event);
    },
  });
}

function combineStageHandlers(
  base: HostBootstrapReusableStageHandlers,
  overrides: HostBootstrapReusableStageHandlers | undefined,
): HostBootstrapReusableStageHandlers {
  const combined: HostBootstrapReusableStageHandlers = {};
  for (const stageId of Object.values(HostBootstrapStageIds) as ReadonlyArray<HostBootstrapStageId>) {
    const baseHandler = base[stageId];
    const overrideHandler = overrides?.[stageId];
    if (!baseHandler && !overrideHandler) {
      continue;
    }
    combined[stageId] = async (context) => {
      await baseHandler?.(context);
      await overrideHandler?.(context);
    };
  }
  return Object.freeze(combined);
}

export function createAuthoritativeServerCompositionRoot(
  input: AuthoritativeServerCompositionRootOptions,
): ExecutableHostCompositionRoot<AuthoritativeServerHostRuntimeHandle> {
  const startHost = input.startHost ?? startIdentityServerHost;

  return Object.freeze({
    compositionRootId: "composition-root:host:server:authoritative",
    host: AuthoritativeServerHostRuntime,
    dependencyBoundary: AuthoritativeServerHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<AuthoritativeServerHostRuntimeHandle> {
      assertHostCanRunAsControlPlane(boot);
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:server:authoritative",
        host: AuthoritativeServerHostRuntime,
        dependencyBoundary: AuthoritativeServerHostRuntime.startupDependencies,
      }, boot);

      const lifecycle = createHostLifecycleCoordinator({ boot });
      const runtimeMetadata = advertiseHostRuntimeMetadata({
        host: boot.host,
        metadata: Object.freeze({
          compositionRootId: "composition-root:host:server:authoritative",
          startupReason: boot.startupReason,
          controlPlaneSource: "local-authoritative-server",
          transportHost: input.hostOptions.host,
          transportPort: input.hostOptions.port !== undefined ? String(input.hostOptions.port) : undefined,
        }),
      });
      let startedHost: IdentityServerHost | undefined;
      let persistenceRuntime: SqlitePersistenceRuntime | undefined;
      let persistentPlatformServices: AuthoritativePersistentPlatformServices | undefined;
      await lifecycle.markComposing("compose-authoritative-server-host");

      try {
        const startupConfiguration = resolveHostStartupConfiguration({
          boot,
          startup: {
            deploymentProfile: input.bootstrap?.deploymentProfile,
            environment: input.bootstrap?.environment ?? input.hostOptions.env ?? process.env,
            enabledCapabilities: input.bootstrap?.enabledCapabilities,
          },
        });

        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact(
              "artifact:host:server:authoritative:host-options",
              context.hostConfiguration as IdentityServerHostOptions,
            );
            context.setArtifact(HostRuntimeMetadataArtifactKey, runtimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composePlan = input.bootstrap?.composeServiceRegistrationPlan
              ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                host: composedBoot.host,
                requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
              }));
            const plan = composePlan(context.boot);
            context.setArtifact(AuthoritativeServerServiceRegistrationPlanArtifactKey, plan);
          },
          [HostBootstrapStageIds.persistence]: async (context) => {
            persistenceRuntime = (
              input.bootstrap?.createPersistenceRuntime
              ?? ((runtimeInput) => createSqlitePersistenceRuntime({
                configuration: resolveSqlitePersistenceRuntimeConfiguration({
                  databasePath: runtimeInput.hostConfiguration.databasePath,
                  environment: runtimeInput.environment,
                }),
                migrationHooks: createAuthoritativePersistenceMigrationHooks(),
              }))
            )({
              hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
              environment: context.environment,
            });
            await persistenceRuntime.start();
            persistentPlatformServices = (
              input.bootstrap?.composePersistentPlatformServices
              ?? ((servicesInput) => createAuthoritativePersistentPlatformServices({
                databasePath: servicesInput.persistenceRuntime.configuration.databasePath,
              }))
            )({
              persistenceRuntime,
              hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
              environment: context.environment,
            });
            context.setArtifact(AuthoritativeServerPersistenceRuntimeArtifactKey, persistenceRuntime);
            context.setArtifact(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
              persistentPlatformServices,
            );
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              AuthoritativeServerServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Authoritative server startup requires a composed host service registration plan.");
            }
            const composedPersistentServices = context.getArtifact<AuthoritativePersistentPlatformServices>(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
            );
            if (!composedPersistentServices) {
              throw new Error(
                "Authoritative server startup requires composed persistent platform services before runtime feature registration.",
              );
            }
            (input.bootstrap?.assertServiceCoverage ?? assertAuthoritativeControlPlaneServiceCoverage)(plan);
            const composedHost = await startHost({
              ...(context.hostConfiguration as IdentityServerHostOptions),
              persistentPlatformServices: composedPersistentServices,
            });
            context.setArtifact(StartedHostArtifactKey, composedHost);
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-authoritative-server-host");
            }
          },
          onPipelineCompleted: async (event) => {
            if (lifecycle.phase === HostLifecyclePhases.starting) {
              await lifecycle.markStartupCompleted({
                transitionReason: "authoritative-server-ready",
                completionReason: "authoritative-server-startup-completed",
                readinessMarker: "authoritative-server:feature-registration-complete",
                metadata: Object.freeze({
                  stageCount: String(event.executedStageIds.length),
                  executedStageIds: event.executedStageIds.join(","),
                }),
              });
            }
          },
        }, input.bootstrap?.lifecycleHooks);

        const context = createHostStartupContext({
          boot,
          deploymentProfile: startupConfiguration.deploymentProfile,
          environment: startupConfiguration.environment,
          enabledCapabilities: startupConfiguration.enabledCapabilities,
          hostConfiguration: input.hostOptions,
          lifecycleHooks,
        });
        const stages = composeHostBootstrapPipeline({
          reusableStageHandlers: stageHandlers,
          hostSpecificStages: input.bootstrap?.hostSpecificStages,
        });
        await executeHostBootstrapPipeline({
          context,
          stages,
        });
        startedHost = context.getArtifact<IdentityServerHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Authoritative server bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;
        const activePersistenceRuntime = persistenceRuntime;

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "authoritative-server-stop-requested",
            shutdownCompletedReason: "authoritative-server-stopped",
            shutdownFailureReason: "authoritative-server-stop-failed",
            cleanupHooks: [
              {
                hookId: "close-runtime-host",
                run: async () => {
                  await activeHost.close();
                },
              },
              {
                hookId: "close-persistence-runtime",
                run: async () => {
                  persistentPlatformServices?.dispose();
                  await activePersistenceRuntime?.dispose();
                },
              },
            ],
          });
        };

        return Object.freeze({
          host: boot.host,
          runtimeMetadata,
          get phase() {
            return lifecycle.phase;
          },
          port: activeHost.port,
          address: activeHost.address,
          get readiness() {
            return lifecycle.readiness;
          },
          get lifecycleEvents() {
            return lifecycle.lifecycleEvents;
          },
          get transitionHistory() {
            return lifecycle.transitionHistory as ReadonlyArray<HostLifecycleTransition>;
          },
          stop,
        });
      } catch (error) {
        let failure: unknown = error;
        if (startedHost) {
          try {
            await lifecycle.runStartupFailureCleanup({
              cleanupReason: "authoritative-server-start-failure-cleanup",
              cleanupFailureReason: "authoritative-server-start-failure-cleanup-failed",
              cleanupHooks: [
                {
                  hookId: "close-runtime-host",
                  run: async () => {
                    await startedHost?.close();
                  },
                },
                {
                  hookId: "close-persistence-runtime",
                  run: async () => {
                    persistentPlatformServices?.dispose();
                    await persistenceRuntime?.dispose();
                  },
                },
              ],
            });
          } catch (cleanupError) {
            failure = cleanupError;
          }
        } else {
          try {
            persistentPlatformServices?.dispose();
            await persistenceRuntime?.dispose();
          } catch (cleanupError) {
            failure = cleanupError;
          }
        }
        await lifecycle.markStartupFailed("authoritative-server-start-failed", failure);
        throw failure;
      }
    },
  });
}

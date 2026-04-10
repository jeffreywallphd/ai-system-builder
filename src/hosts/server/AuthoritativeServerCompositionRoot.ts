import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  assertHostCanRunAsControlPlane,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeMetadata,
  type HostRuntimeHandle,
} from "@application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../HostRuntimeCatalog";
import {
  HostBootstrapStageIds,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapStageId,
  type HostBootstrapReusableStageHandlers,
  type HostDeploymentProfile,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import {
  type StartupSpan,
  type StartupTracer,
} from "../bootstrap/startupTracer";
import type { HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import {
  assertAuthoritativeControlPlaneServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "@infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import {
  startIdentityServerHost,
  type IdentityServerHost,
  type IdentityServerHostOptions,
} from "./IdentityServerHost";
import {
  AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
  assertAuthoritativeServerApiRouteRegistrationCoverage,
  composeAuthoritativeServerApiRouteRegistrationPlan,
} from "./AuthoritativeServerApiRouteComposition";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import { HostRuntimeMetadataArtifactKey } from "../HostRuntimeMetadataCatalog";
import {
  createSqlitePersistenceRuntime,
  resolveSqlitePersistenceRuntimeConfiguration,
  type SqlitePersistenceRuntime,
} from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import {
  createAuthoritativePersistenceMigrationHooks,
  createAuthoritativePersistentPlatformServices,
  type AuthoritativePersistentPlatformServices,
} from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import {
  DeploymentPolicyBootstrapResolutionService,
  type DeploymentPolicyBootstrapResolutionResult,
} from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import { PlatformDeploymentPolicyAdministrationObservabilityPort } from "@infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort";
import {
  createComfyUiExecutionAdapterInfrastructure,
  type ComfyUiExecutionAdapterInfrastructure,
} from "@infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition";
import {
  createAuthoritativeRunExecutionAdapterRegistration,
  type AuthoritativeRunExecutionAdapterRegistration,
} from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import {
  AuthoritativeServerBootstrapStageIds,
  type AuthoritativeServerBootstrapStageId,
} from "./AuthoritativeServerBootstrapStageContracts";
import {
  createAuthoritativeServerConfigBootstrapStage,
  type AuthoritativeServerConfigBootstrapStage,
} from "./AuthoritativeServerConfigBootstrapStage";
import {
  createAuthoritativeServerSecurityBootstrapStage,
  type AuthoritativeServerSecurityBootstrapStage,
} from "./AuthoritativeServerSecurityBootstrapStage";
import {
  createAuthoritativeServerBootstrapStageOrchestrator,
  type AuthoritativeServerBootstrapStageOrchestrator,
} from "./AuthoritativeServerBootstrapStageOrchestrator";
import type { AuthoritativeServerStartupBaselineRecordResult } from "./AuthoritativeServerStartupBaselineRecorder";

export interface AuthoritativeServerHostRuntimeHandle extends HostRuntimeHandle {
  readonly port: number;
  readonly address: string;
  readonly startupCorrelationId?: string;
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
    readonly composeApiRouteRegistrationPlan?: () => AuthoritativeApiRouteRegistrationPlan;
    readonly assertApiRouteRegistrationCoverage?: (plan: AuthoritativeApiRouteRegistrationPlan) => void;
    readonly executionInfrastructureEnabled?: boolean;
    readonly composeComfyUiExecutionAdapter?: (input: {
      readonly hostConfiguration: IdentityServerHostOptions;
      readonly environment: Readonly<Record<string, string | undefined>>;
      readonly deploymentProfile: HostDeploymentProfile;
    }) => ComfyUiExecutionAdapterInfrastructure | undefined;
    readonly composeRunExecutionAdapterRegistration?: (input: {
      readonly hostConfiguration: IdentityServerHostOptions;
      readonly environment: Readonly<Record<string, string | undefined>>;
      readonly deploymentProfile: HostDeploymentProfile;
      readonly comfyUiExecutionAdapter?: ComfyUiExecutionAdapterInfrastructure;
    }) => AuthoritativeRunExecutionAdapterRegistration | undefined;
    readonly resolveDeploymentPolicyBootstrap?: (input: {
      readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
      readonly hostConfiguration: IdentityServerHostOptions;
      readonly deploymentProfile: HostDeploymentProfile;
      readonly environment: Readonly<Record<string, string | undefined>>;
    }) => Promise<DeploymentPolicyBootstrapResolutionResult>;
    readonly createStartupTracer?: (input: {
      readonly boot: HostBootConfiguration;
      readonly hostConfiguration: IdentityServerHostOptions;
    }) => StartupTracer;
    readonly createConfigStage?: () => AuthoritativeServerConfigBootstrapStage;
    readonly createSecurityStage?: () => AuthoritativeServerSecurityBootstrapStage;
    readonly recordStartupBaseline?: (measurement: {
      readonly hostId: string;
      readonly startupReason: string;
      readonly outcome: "succeeded" | "failed";
      readonly durationMs: number;
      readonly startedAt: string;
      readonly completedAt: string;
      readonly traceId?: string;
      readonly startupCorrelationId?: string;
      readonly pipelineStageDurations: Readonly<Record<string, number>>;
      readonly authoritativeStageDurations: Readonly<Record<string, number>>;
    }) => Promise<AuthoritativeServerStartupBaselineRecordResult | void> | AuthoritativeServerStartupBaselineRecordResult | void;
  };
}

const StartedHostArtifactKey = "artifact:host:server:authoritative:runtime";
export const AuthoritativeServerServiceRegistrationPlanArtifactKey =
  "artifact:host:server:authoritative:service-registration-plan";
export const AuthoritativeServerPersistenceRuntimeArtifactKey = "artifact:host:server:authoritative:persistence-runtime";
export const AuthoritativeServerPersistentPlatformServicesArtifactKey =
  "artifact:host:server:authoritative:persistent-platform-services";
export const AuthoritativeServerComfyUiExecutionAdapterArtifactKey =
  "artifact:host:server:authoritative:comfyui-execution-adapter";
export const AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey =
  "artifact:host:server:authoritative:run-execution-adapter-registration";
export const AuthoritativeServerDeploymentPolicyBootstrapArtifactKey =
  "artifact:host:server:authoritative:deployment-policy-bootstrap";
export const AuthoritativeServerSecurityBootstrapArtifactKey =
  "artifact:host:server:authoritative:security-bootstrap";

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

async function runStartupChildStepSpan<TResult>(input: {
  readonly parentSpan: StartupSpan;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly run: (span: StartupSpan) => Promise<TResult> | TResult;
}): Promise<TResult> {
  const span = input.parentSpan.startChild(input.name, { metadata: input.metadata });
  try {
    const result = await input.run(span);
    span.complete();
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
}

interface AuthoritativeServerPipelineStageSummary {
  readonly stageId: string;
  readonly sequence: number;
  readonly status: "completed" | "failed";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly failure?: Readonly<Record<string, string>>;
}

function summarizeStartupError(error: unknown): Readonly<Record<string, string>> {
  if (error instanceof Error) {
    return Object.freeze({
      name: error.name || "Error",
      message: error.message || "Authoritative server startup failed.",
    });
  }
  return Object.freeze({
    name: "Error",
    message: String(error),
  });
}

function attachStartupCorrelationIdToError(
  error: unknown,
  startupCorrelationId: string | undefined,
): void {
  if (!(error instanceof Error) || !startupCorrelationId) {
    return;
  }
  (error as Error & { startupCorrelationId?: string }).startupCorrelationId = startupCorrelationId;
  (error as Error & { traceId?: string }).traceId = startupCorrelationId;
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
      const startupStartedAtMs = Date.now();
      const startupStartedAt = new Date(startupStartedAtMs).toISOString();
      let startedHost: IdentityServerHost | undefined;
      let persistenceRuntime: SqlitePersistenceRuntime | undefined;
      let persistentPlatformServices: AuthoritativePersistentPlatformServices | undefined;
      let startupTracer: StartupTracer | undefined;
      let runtimeMetadata: HostRuntimeMetadata | undefined;
      let startupRootSpan: StartupSpan | undefined;
      let startupStageOrchestrator: AuthoritativeServerBootstrapStageOrchestrator | undefined;
      const pipelineStageSummaries: AuthoritativeServerPipelineStageSummary[] = [];
      let startupFailure: unknown | undefined;
      await lifecycle.markComposing("compose-authoritative-server-host");
      const configStage = (
        input.bootstrap?.createConfigStage
        ?? (() => createAuthoritativeServerConfigBootstrapStage({
          startup: {
            deploymentProfile: input.bootstrap?.deploymentProfile,
            enabledCapabilities: input.bootstrap?.enabledCapabilities,
          },
          createStartupTracer: input.bootstrap?.createStartupTracer,
        }))
      )();
      const securityStage = (
        input.bootstrap?.createSecurityStage
        ?? (() => createAuthoritativeServerSecurityBootstrapStage())
      )();

      try {
        const startupConfiguration = await configStage.execute({
          boot,
          hostConfiguration: input.hostOptions,
          startupReason: boot.startupReason,
          environment: input.bootstrap?.environment ?? input.hostOptions.env ?? process.env,
        });
        startupTracer = startupConfiguration.startupTracer;
        runtimeMetadata = startupConfiguration.runtimeMetadata;
        const resolvedStartupTracer = startupTracer;
        const resolvedRuntimeMetadata = runtimeMetadata;
        startupRootSpan = startupTracer.startSpan("authoritative-server-bootstrap", {
          metadata: Object.freeze({
            hostId: boot.host.hostId,
            startupReason: boot.startupReason,
          }),
        });
        const startupStageOrder: ReadonlyArray<AuthoritativeServerBootstrapStageId> = Object.freeze([
          AuthoritativeServerBootstrapStageIds.services,
          AuthoritativeServerBootstrapStageIds.security,
          AuthoritativeServerBootstrapStageIds.persistence,
          AuthoritativeServerBootstrapStageIds.transport,
        ]);
        const resolvedStartupStageOrchestrator = createAuthoritativeServerBootstrapStageOrchestrator({
          tracer: resolvedStartupTracer,
          parentSpan: startupRootSpan,
          stageOrder: startupStageOrder,
        });
        startupStageOrchestrator = resolvedStartupStageOrchestrator;

        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact(
              "artifact:host:server:authoritative:host-options",
              context.hostConfiguration as IdentityServerHostOptions,
            );
            context.setArtifact(HostRuntimeMetadataArtifactKey, resolvedRuntimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: async (context) => {
            await resolvedStartupStageOrchestrator.runStage({
              stageId: AuthoritativeServerBootstrapStageIds.services,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.dependencies,
              }),
              run: () => {
                const composePlan = input.bootstrap?.composeServiceRegistrationPlan
                  ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                    host: composedBoot.host,
                    requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
                  }));
                const plan = composePlan(context.boot);
                const apiRouteRegistrationPlan = (
                  input.bootstrap?.composeApiRouteRegistrationPlan
                  ?? composeAuthoritativeServerApiRouteRegistrationPlan
                )();
                context.setArtifact(AuthoritativeServerServiceRegistrationPlanArtifactKey, plan);
                context.setArtifact(
                  AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
                  apiRouteRegistrationPlan,
                );
                const executionInfrastructureEnabled = input.bootstrap?.executionInfrastructureEnabled ?? true;
                if (!executionInfrastructureEnabled) {
                  return;
                }
                const comfyUiExecutionAdapter = (
                  input.bootstrap?.composeComfyUiExecutionAdapter
                  ?? ((adapterInput) => createComfyUiExecutionAdapterInfrastructure({
                    env: adapterInput.environment,
                  }))
                )({
                  hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                  environment: context.environment,
                  deploymentProfile: context.deploymentProfile,
                });
                if (comfyUiExecutionAdapter) {
                  context.setArtifact(
                    AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
                    comfyUiExecutionAdapter,
                  );
                }
                const runExecutionAdapterRegistration = (
                  input.bootstrap?.composeRunExecutionAdapterRegistration
                  ?? ((registrationInput) => createAuthoritativeRunExecutionAdapterRegistration({
                    comfyUiExecutionAdapter: registrationInput.comfyUiExecutionAdapter,
                  }))
                )({
                  hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                  environment: context.environment,
                  deploymentProfile: context.deploymentProfile,
                  comfyUiExecutionAdapter,
                });
                if (runExecutionAdapterRegistration) {
                  context.setArtifact(
                    AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
                    runExecutionAdapterRegistration,
                  );
                }
              },
            });
          },
          [HostBootstrapStageIds.security]: async (context) => {
            await resolvedStartupStageOrchestrator.runStage({
              stageId: AuthoritativeServerBootstrapStageIds.security,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.security,
              }),
              run: async () => {
                const security = await securityStage.execute({
                  deploymentProfile: context.deploymentProfile,
                  environment: context.environment,
                  enabledCapabilities: context.enabledCapabilities,
                  runtimeMetadata: resolvedRuntimeMetadata,
                  startupTracer: resolvedStartupTracer,
                  hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                });
                context.setArtifact(AuthoritativeServerSecurityBootstrapArtifactKey, security);
              },
            });
          },
          [HostBootstrapStageIds.persistence]: async (context) => {
            await resolvedStartupStageOrchestrator.runStage({
              stageId: AuthoritativeServerBootstrapStageIds.persistence,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.persistence,
              }),
              run: async ({ span: stageSpan }) => {
                await runStartupChildStepSpan({
                  parentSpan: stageSpan,
                  name: "persistence-setup",
                  run: async (persistenceSetupSpan) => {
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
                    await runStartupChildStepSpan({
                      parentSpan: persistenceSetupSpan,
                      name: "migrations",
                      run: async () => {
                        await persistenceRuntime?.start();
                      },
                    });
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
                  },
                });
                context.setArtifact(AuthoritativeServerPersistenceRuntimeArtifactKey, persistenceRuntime);
                context.setArtifact(
                  AuthoritativeServerPersistentPlatformServicesArtifactKey,
                  persistentPlatformServices,
                );
                const deploymentPolicyBootstrap = await (
                  input.bootstrap?.resolveDeploymentPolicyBootstrap
                  ?? (async (bootstrapInput) => new DeploymentPolicyBootstrapResolutionService({
                    deploymentPolicyRepository: bootstrapInput.persistentPlatformServices.deploymentPolicyRepository,
                    observabilityPort: new PlatformDeploymentPolicyAdministrationObservabilityPort({
                      logger: bootstrapInput.hostConfiguration.logger
                        ? {
                          info: (event) => bootstrapInput.hostConfiguration.logger?.info(event),
                          warn: (event) => bootstrapInput.hostConfiguration.logger?.warn(event),
                          error: (event) => bootstrapInput.hostConfiguration.logger?.error(event),
                        }
                        : undefined,
                    }),
                  }).execute())
                )({
                  persistentPlatformServices,
                  hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                  deploymentProfile: context.deploymentProfile,
                  environment: context.environment,
                });
                context.setArtifact(
                  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
                  deploymentPolicyBootstrap,
                );
              },
            });
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            await resolvedStartupStageOrchestrator.runStage({
              stageId: AuthoritativeServerBootstrapStageIds.transport,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.featureRegistration,
              }),
              run: async () => {
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
                const apiRouteRegistrationPlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
                  AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
                );
                if (!apiRouteRegistrationPlan) {
                  throw new Error("Authoritative server startup requires a composed API route registration plan.");
                }
                const deploymentPolicyBootstrap = context.getArtifact<DeploymentPolicyBootstrapResolutionResult>(
                  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
                );
                if (!deploymentPolicyBootstrap) {
                  throw new Error(
                    "Authoritative server startup requires deployment policy bootstrap resolution before runtime feature registration.",
                  );
                }
                (input.bootstrap?.assertServiceCoverage ?? assertAuthoritativeControlPlaneServiceCoverage)(plan);
                (input.bootstrap?.assertApiRouteRegistrationCoverage
                  ?? assertAuthoritativeServerApiRouteRegistrationCoverage)(apiRouteRegistrationPlan);
                const runExecutionAdapterRegistration = context.getArtifact<AuthoritativeRunExecutionAdapterRegistration>(
                  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
                );
                const composedHost = await startHost({
                  ...(context.hostConfiguration as IdentityServerHostOptions),
                  startupTracer: resolvedStartupTracer,
                  deploymentProfile: context.deploymentProfile,
                  deploymentPolicyBootstrap,
                  persistentPlatformServices: composedPersistentServices,
                  routeRegistrationPlan: apiRouteRegistrationPlan,
                  runExecutionAdapters: runExecutionAdapterRegistration,
                });
                context.setArtifact(StartedHostArtifactKey, composedHost);
              },
            });
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-authoritative-server-host");
            }
          },
          onStageCompleted: async (event) => {
            const startedAtMs = Date.parse(event.startedAt);
            const completedAtMs = Date.parse(event.completedAt);
            pipelineStageSummaries.push(Object.freeze({
              stageId: event.stageId,
              sequence: event.sequence,
              status: "completed",
              startedAt: event.startedAt,
              endedAt: event.completedAt,
              durationMs: Number.isNaN(startedAtMs) || Number.isNaN(completedAtMs)
                ? 0
                : Math.max(0, completedAtMs - startedAtMs),
            }));
          },
          onStageFailed: async (event) => {
            const startedAtMs = Date.parse(event.startedAt);
            const failedAtMs = Date.parse(event.failedAt);
            pipelineStageSummaries.push(Object.freeze({
              stageId: event.stageId,
              sequence: event.sequence,
              status: "failed",
              startedAt: event.startedAt,
              endedAt: event.failedAt,
              durationMs: Number.isNaN(startedAtMs) || Number.isNaN(failedAtMs)
                ? 0
                : Math.max(0, failedAtMs - startedAtMs),
              failure: summarizeStartupError(event.error),
            }));
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
          runtimeMetadata: resolvedRuntimeMetadata,
          get phase() {
            return lifecycle.phase;
          },
          port: activeHost.port,
          address: activeHost.address,
          startupCorrelationId: resolvedStartupTracer.startupCorrelationId,
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
        startupRootSpan?.fail(error);
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
        startupFailure = failure;
        attachStartupCorrelationIdToError(failure, startupTracer?.startupCorrelationId);
        throw failure;
      } finally {
        startupRootSpan?.complete();
        const startupCompletedAtMs = Date.now();
        const startupCompletedAt = new Date(startupCompletedAtMs).toISOString();
        const stageStatus = startupStageOrchestrator?.getStatus().stages ?? [];
        const pipelineFailures = pipelineStageSummaries
          .filter((stage) => stage.status === "failed")
          .map((stage) => Object.freeze({
            stageId: stage.stageId,
            sequence: stage.sequence,
            failure: stage.failure,
          }));
        const startupSummary = Object.freeze({
          event: "authoritative-server.startup.summary",
          hostId: boot.host.hostId,
          startupReason: boot.startupReason,
          outcome: startupFailure ? "failed" : "succeeded",
          traceId: startupTracer?.traceId,
          startupCorrelationId: startupTracer?.startupCorrelationId,
          startedAt: startupStartedAt,
          completedAt: startupCompletedAt,
          durationMs: Math.max(0, startupCompletedAtMs - startupStartedAtMs),
          pipeline: Object.freeze({
            stageCount: pipelineStageSummaries.length,
            stages: Object.freeze([...pipelineStageSummaries]),
            failedStageCount: pipelineFailures.length,
            failures: Object.freeze(pipelineFailures),
          }),
          authoritativeStages: Object.freeze({
            stageCount: stageStatus.length,
            stages: Object.freeze(stageStatus),
            failedStageCount: stageStatus.filter((stage) => stage.state === "failed").length,
            failures: Object.freeze(stageStatus
              .filter((stage) => stage.state === "failed")
              .map((stage) => Object.freeze({
                stageId: stage.stageId,
                sequence: stage.sequence,
                failure: stage.failure,
              }))),
          }),
          startupFailure: startupFailure ? summarizeStartupError(startupFailure) : undefined,
        });
        if (startupFailure) {
          if (input.hostOptions.logger) {
            input.hostOptions.logger.error(startupSummary);
          } else {
            console.error(startupSummary);
          }
        } else if (input.hostOptions.logger) {
          input.hostOptions.logger.info(startupSummary);
        } else {
          console.info(startupSummary);
        }
        const startupBaselineMeasurement = Object.freeze({
          hostId: boot.host.hostId,
          startupReason: boot.startupReason,
          outcome: startupSummary.outcome,
          durationMs: startupSummary.durationMs,
          startedAt: startupSummary.startedAt,
          completedAt: startupSummary.completedAt,
          traceId: startupSummary.traceId,
          startupCorrelationId: startupSummary.startupCorrelationId,
          pipelineStageDurations: Object.freeze(Object.fromEntries(
            pipelineStageSummaries.map((stage) => [stage.stageId, stage.durationMs] as const),
          )),
          authoritativeStageDurations: Object.freeze(Object.fromEntries(
            stageStatus
              .filter((stage) => typeof stage.durationMs === "number")
              .map((stage) => [stage.stageId, stage.durationMs ?? 0] as const),
          )),
        });
        if (input.bootstrap?.recordStartupBaseline) {
          try {
            const baselineRecord = await input.bootstrap.recordStartupBaseline(startupBaselineMeasurement);
            const regressionWarning = baselineRecord?.regressionWarning;
            if (regressionWarning) {
              const regressionEvent = Object.freeze({
                event: "authoritative-server.startup.baseline-regression.detected",
                hostId: boot.host.hostId,
                startupReason: boot.startupReason,
                traceId: startupSummary.traceId,
                startupCorrelationId: startupSummary.startupCorrelationId,
                baselinePath: baselineRecord?.baselinePath,
                sampleCount: baselineRecord?.sampleCount,
                thresholdMs: regressionWarning.thresholdMs,
                baselineDurationMs: regressionWarning.baselineDurationMs,
                currentDurationMs: regressionWarning.currentDurationMs,
                regressionDurationMs: regressionWarning.regressionDurationMs,
                previousSampleCount: regressionWarning.previousSampleCount,
              });
              if (input.hostOptions.logger) {
                input.hostOptions.logger.warn(regressionEvent);
              } else {
                console.warn(regressionEvent);
              }
            }
          } catch (baselineError) {
            const baselineErrorSummary = Object.freeze({
              event: "authoritative-server.startup.baseline-recording.failed",
              hostId: boot.host.hostId,
              startupReason: boot.startupReason,
              traceId: startupSummary.traceId,
              startupCorrelationId: startupSummary.startupCorrelationId,
              error: summarizeStartupError(baselineError),
            });
            if (input.hostOptions.logger) {
              input.hostOptions.logger.warn(baselineErrorSummary);
            } else {
              console.warn(baselineErrorSummary);
            }
          }
        }
      }
    },
  });
}


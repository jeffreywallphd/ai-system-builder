import type {
  HostBootConfiguration,
  HostRuntimeMetadata,
} from "@application/common/HostCompositionContracts";
import {
  HostBootstrapStageIds,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapReusableStageHandlers,
  type HostDeploymentProfile,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "@hosts/bootstrap/HostBootstrapPipeline";
import type { StartupSpan, StartupTracer } from "@hosts/bootstrap/startupTracer";
import type { HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import {
  assertAuthoritativeControlPlaneServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "@infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
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
  composeAuthoritativeServerApiRouteRegistrationPlan,
  assertAuthoritativeServerApiRouteRegistrationCoverage,
  AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
} from "./AuthoritativeServerApiRouteComposition";
import {
  createComfyUiExecutionAdapterInfrastructure,
  type ComfyUiExecutionAdapterInfrastructure,
} from "@infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition";
import {
  createAuthoritativeRunExecutionAdapterRegistration,
  type AuthoritativeRunExecutionAdapterRegistration,
} from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import {
  DeploymentPolicyBootstrapResolutionService,
  type DeploymentPolicyBootstrapResolutionResult,
} from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import { PlatformDeploymentPolicyAdministrationObservabilityPort } from "@infrastructure/api/deployment/PlatformDeploymentPolicyAdministrationObservabilityPort";
import type {
  IdentityServerHost,
  IdentityServerHostOptions,
} from "./IdentityServerHost";
import type {
  AuthoritativeServerConfigBootstrapStage,
  AuthoritativeServerSecurityBootstrapStage,
  AuthoritativeServerSecurityStageOutput,
} from "./AuthoritativeServerBootstrapStageContracts";
import {
  AuthoritativeServerBootstrapPipelineStageAdoptionStates,
  AuthoritativeServerBootstrapPipelineStageIds,
  AuthoritativeServerBootstrapReadinessStates,
  AuthoritativeServerBootstrapStageExecutionStates,
  type AuthoritativeServerBootstrapPipelineStageId,
  type AuthoritativeServerBootstrapPipelineStageStatus,
  type AuthoritativeServerBootstrapReadinessState,
  type AuthoritativeServerBootstrapStageFailure,
  createAuthoritativeServerBootstrapPipelineState,
  listAuthoritativeServerBootstrapPipelineStages,
  updateAuthoritativeServerBootstrapPipelineStageState,
} from "./composition/contracts/AuthoritativeServerBootstrapPipelineStateModel";
import { HostRuntimeMetadataArtifactKey } from "../HostRuntimeMetadataCatalog";
import {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
  AuthoritativeServerPersistenceRuntimeArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
  AuthoritativeServerSecurityBootstrapArtifactKey,
  AuthoritativeServerServiceRegistrationPlanArtifactKey,
} from "./AuthoritativeServerBootstrapArtifactKeys";

export const StartedHostArtifactKey = "artifact:host:server:authoritative:runtime";

interface AuthoritativeServerBootstrapStageRuntimeStatus {
  readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
  readonly sequence: number;
  readonly state: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly durationMs?: number;
  readonly failure?: AuthoritativeServerBootstrapStageFailure;
}

export interface AuthoritativeServerBootstrapOrchestratorStageStatus {
  readonly stages: ReadonlyArray<AuthoritativeServerBootstrapStageRuntimeStatus>;
  readonly readiness: AuthoritativeServerBootstrapReadinessState;
}

export interface AuthoritativeServerBootstrapOrchestratorResult {
  readonly startedHost: IdentityServerHost;
  readonly startupTracer: StartupTracer;
  readonly runtimeMetadata: HostRuntimeMetadata;
  readonly persistenceRuntime?: SqlitePersistenceRuntime;
  readonly persistentPlatformServices?: AuthoritativePersistentPlatformServices;
  readonly stageStatus: AuthoritativeServerBootstrapOrchestratorStageStatus;
}

export interface AuthoritativeServerBootstrapOrchestratorInput {
  readonly boot: HostBootConfiguration;
  readonly hostOptions: IdentityServerHostOptions;
  readonly startHost: (options: IdentityServerHostOptions) => Promise<IdentityServerHost>;
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
    readonly createConfigStage?: () => AuthoritativeServerConfigBootstrapStage;
    readonly createSecurityStage?: () => AuthoritativeServerSecurityBootstrapStage;
  };
}

function summarizeStageFailure(error: unknown): AuthoritativeServerBootstrapStageFailure {
  if (error instanceof Error) {
    return Object.freeze({
      name: error.name || "Error",
      message: error.message || "Authoritative startup stage failed.",
    });
  }
  return Object.freeze({
    name: "Error",
    message: String(error),
  });
}

function combineStageHandlers(
  base: HostBootstrapReusableStageHandlers,
  overrides: HostBootstrapReusableStageHandlers | undefined,
): HostBootstrapReusableStageHandlers {
  const combined: HostBootstrapReusableStageHandlers = {};
  for (const stageId of Object.values(HostBootstrapStageIds)) {
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

function createStageStatusSnapshot(
  stageStatuses: ReadonlyArray<AuthoritativeServerBootstrapPipelineStageStatus>,
): AuthoritativeServerBootstrapOrchestratorStageStatus {
  const adoptedStages = listAuthoritativeServerBootstrapPipelineStages().filter(
    (stage) => stage.adoptionState === AuthoritativeServerBootstrapStageAdoptionStates.active,
  );
  const runtimeStages = adoptedStages.map((definition) => {
    const stage = stageStatuses.find((candidate) => candidate.stageId === definition.stageId);
    return Object.freeze({
      stageId: definition.stageId,
      sequence: definition.sequence,
      state: stage?.executionState ?? AuthoritativeServerBootstrapStageExecutionStates.pending,
      startedAt: stage?.startedAt,
      completedAt: stage?.completedAt,
      failedAt: stage?.failedAt,
      durationMs: stage?.durationMs,
      failure: stage?.failure,
    } satisfies AuthoritativeServerBootstrapStageRuntimeStatus);
  });
  const readiness = stageStatuses.some(
    (stage) => stage.executionState === AuthoritativeServerBootstrapStageExecutionStates.failed,
  )
    ? AuthoritativeServerBootstrapReadinessStates.degraded
    : (
      runtimeStages.find((stage) => stage.stageId === AuthoritativeServerBootstrapPipelineStageIds.transportStartup)?.state
        === AuthoritativeServerBootstrapStageExecutionStates.success
      && runtimeStages.find((stage) => stage.stageId === AuthoritativeServerBootstrapPipelineStageIds.readinessVerification)?.state
        === AuthoritativeServerBootstrapStageExecutionStates.success
        ? AuthoritativeServerBootstrapReadinessStates.ready
        : AuthoritativeServerBootstrapReadinessStates.notReady
    );
  return Object.freeze({
    stages: Object.freeze(runtimeStages),
    readiness,
  });
}

export function createAuthoritativeServerBootstrapOrchestrator(input: AuthoritativeServerBootstrapOrchestratorInput): {
  execute(): Promise<AuthoritativeServerBootstrapOrchestratorResult>;
} {
  let bootstrapState = createAuthoritativeServerBootstrapPipelineState();
  const clock = () => Date.now();

  const markStageRunning = (stageId: AuthoritativeServerBootstrapPipelineStageId, startedAtMs: number): void => {
    bootstrapState = updateAuthoritativeServerBootstrapPipelineStageState({
      state: bootstrapState,
      stageId,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.running,
      startedAt: new Date(startedAtMs).toISOString(),
      readinessState: AuthoritativeServerBootstrapReadinessStates.notReady,
    });
  };

  const markStageSucceeded = (inputStage: {
    readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
    readonly startedAtMs: number;
    readonly completedAtMs: number;
    readonly readinessState?: AuthoritativeServerBootstrapReadinessState;
  }): void => {
    bootstrapState = updateAuthoritativeServerBootstrapPipelineStageState({
      state: bootstrapState,
      stageId: inputStage.stageId,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.success,
      startedAt: new Date(inputStage.startedAtMs).toISOString(),
      completedAt: new Date(inputStage.completedAtMs).toISOString(),
      durationMs: Math.max(0, inputStage.completedAtMs - inputStage.startedAtMs),
      readinessState: inputStage.readinessState ?? AuthoritativeServerBootstrapReadinessStates.notReady,
    });
  };

  const markStageFailed = (inputStage: {
    readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
    readonly startedAtMs: number;
    readonly failedAtMs: number;
    readonly error: unknown;
  }): void => {
    bootstrapState = updateAuthoritativeServerBootstrapPipelineStageState({
      state: bootstrapState,
      stageId: inputStage.stageId,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.failed,
      startedAt: new Date(inputStage.startedAtMs).toISOString(),
      failedAt: new Date(inputStage.failedAtMs).toISOString(),
      durationMs: Math.max(0, inputStage.failedAtMs - inputStage.startedAtMs),
      readinessState: AuthoritativeServerBootstrapReadinessStates.degraded,
      failure: summarizeStageFailure(inputStage.error),
    });
  };

  return Object.freeze({
    async execute(): Promise<AuthoritativeServerBootstrapOrchestratorResult> {
      let startedHost: IdentityServerHost | undefined;
      let persistenceRuntime: SqlitePersistenceRuntime | undefined;
      let persistentPlatformServices: AuthoritativePersistentPlatformServices | undefined;
      const configStage = input.bootstrap?.createConfigStage?.();
      const securityStage = input.bootstrap?.createSecurityStage?.();
      if (!configStage) {
        throw new Error("Authoritative server bootstrap orchestrator requires a config stage implementation.");
      }
      if (!securityStage) {
        throw new Error("Authoritative server bootstrap orchestrator requires a security stage implementation.");
      }
      const configurationStartedAtMs = clock();
      markStageRunning(AuthoritativeServerBootstrapPipelineStageIds.configurationLoad, configurationStartedAtMs);
      let startupConfiguration: Awaited<ReturnType<typeof configStage.execute>>;
      try {
        startupConfiguration = await configStage.execute({
          boot: input.boot,
          hostConfiguration: input.hostOptions,
          startupReason: input.boot.startupReason,
          environment: input.bootstrap?.environment ?? input.hostOptions.env ?? process.env,
        });
      } catch (error) {
        markStageFailed({
          stageId: AuthoritativeServerBootstrapPipelineStageIds.configurationLoad,
          startedAtMs: configurationStartedAtMs,
          failedAtMs: clock(),
          error,
        });
        throw error;
      }
      const configurationCompletedAtMs = clock();
      markStageSucceeded({
        stageId: AuthoritativeServerBootstrapPipelineStageIds.configurationLoad,
        startedAtMs: configurationStartedAtMs,
        completedAtMs: configurationCompletedAtMs,
      });

      const startupTracer = startupConfiguration.startupTracer;
      const runtimeMetadata = startupConfiguration.runtimeMetadata;
      const startupRootSpan = startupTracer.startSpan("authoritative-server-bootstrap", {
        metadata: Object.freeze({
          hostId: input.boot.host.hostId,
          startupReason: input.boot.startupReason,
        }),
      });

      const runBootstrapStage = async <TResult>(stageInput: {
        readonly stageId: AuthoritativeServerBootstrapPipelineStageId;
        readonly metadata?: Readonly<Record<string, unknown>>;
        readonly readinessState?: AuthoritativeServerBootstrapReadinessState;
        readonly run: (span: StartupSpan) => Promise<TResult> | TResult;
      }): Promise<TResult> => {
        const startedAtMs = clock();
        markStageRunning(stageInput.stageId, startedAtMs);
        const span = startupRootSpan.startChild(stageInput.stageId, {
          metadata: Object.freeze({
            stageId: stageInput.stageId,
            ...stageInput.metadata,
          }),
        });
        try {
          const result = await stageInput.run(span);
          span.complete();
          markStageSucceeded({
            stageId: stageInput.stageId,
            startedAtMs,
            completedAtMs: clock(),
            readinessState: stageInput.readinessState,
          });
          return result;
        } catch (error) {
          span.fail(error);
          markStageFailed({
            stageId: stageInput.stageId,
            startedAtMs,
            failedAtMs: clock(),
            error,
          });
          throw error;
        }
      };

      try {
        let securityOutput: AuthoritativeServerSecurityStageOutput | undefined;
        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact(
              "artifact:host:server:authoritative:host-options",
              context.hostConfiguration as IdentityServerHostOptions,
            );
            context.setArtifact(HostRuntimeMetadataArtifactKey, runtimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: async (context) => {
            await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.subsystemComposition,
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
            securityOutput = await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.securityMaterialResolution,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.security,
              }),
              run: async () => {
                const security = await securityStage.execute({
                  deploymentProfile: context.deploymentProfile,
                  environment: context.environment,
                  enabledCapabilities: context.enabledCapabilities,
                  runtimeMetadata,
                  startupTracer,
                  hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                });
                context.setArtifact(AuthoritativeServerSecurityBootstrapArtifactKey, security);
                return security;
              },
            });
          },
          [HostBootstrapStageIds.persistence]: async (context) => {
            await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.persistenceInitialization,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.persistence,
              }),
              run: () => {
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
                context.setArtifact(AuthoritativeServerPersistenceRuntimeArtifactKey, persistenceRuntime);
              },
            });
            await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.migrationExecution,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.persistence,
              }),
              run: async (migrationStageSpan) => {
                await runStartupChildStepSpan({
                  parentSpan: migrationStageSpan,
                  name: "persistence-setup",
                  run: async (persistenceSetupSpan) => {
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
                      persistenceRuntime: persistenceRuntime as SqlitePersistenceRuntime,
                      hostConfiguration: context.hostConfiguration as IdentityServerHostOptions,
                      environment: context.environment,
                    });
                  },
                });
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
                  persistentPlatformServices: persistentPlatformServices as AuthoritativePersistentPlatformServices,
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
            await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.readinessVerification,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.featureRegistration,
              }),
              run: () => {
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
                if (!securityOutput) {
                  throw new Error("Authoritative server startup requires security material resolution before readiness verification.");
                }
                (input.bootstrap?.assertServiceCoverage ?? assertAuthoritativeControlPlaneServiceCoverage)(plan);
                (input.bootstrap?.assertApiRouteRegistrationCoverage
                  ?? assertAuthoritativeServerApiRouteRegistrationCoverage)(apiRouteRegistrationPlan);
              },
            });
            await runBootstrapStage({
              stageId: AuthoritativeServerBootstrapPipelineStageIds.transportStartup,
              metadata: Object.freeze({
                hostBootstrapStageId: HostBootstrapStageIds.featureRegistration,
              }),
              readinessState: AuthoritativeServerBootstrapReadinessStates.ready,
              run: async () => {
                const composedPersistentServices = context.getArtifact<AuthoritativePersistentPlatformServices>(
                  AuthoritativeServerPersistentPlatformServicesArtifactKey,
                );
                const apiRouteRegistrationPlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
                  AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
                );
                const deploymentPolicyBootstrap = context.getArtifact<DeploymentPolicyBootstrapResolutionResult>(
                  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
                );
                const runExecutionAdapterRegistration = context.getArtifact<AuthoritativeRunExecutionAdapterRegistration>(
                  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
                );
                startedHost = await input.startHost({
                  ...(context.hostConfiguration as IdentityServerHostOptions),
                  startupTracer,
                  deploymentProfile: context.deploymentProfile,
                  deploymentPolicyBootstrap: deploymentPolicyBootstrap as DeploymentPolicyBootstrapResolutionResult,
                  persistentPlatformServices: composedPersistentServices as AuthoritativePersistentPlatformServices,
                  routeRegistrationPlan: apiRouteRegistrationPlan as AuthoritativeApiRouteRegistrationPlan,
                  runExecutionAdapters: runExecutionAdapterRegistration,
                });
                context.setArtifact(StartedHostArtifactKey, startedHost);
              },
            });
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const context = createHostStartupContext({
          boot: input.boot,
          deploymentProfile: startupConfiguration.deploymentProfile,
          environment: startupConfiguration.environment,
          enabledCapabilities: startupConfiguration.enabledCapabilities,
          hostConfiguration: input.hostOptions,
          lifecycleHooks: input.bootstrap?.lifecycleHooks,
        });
        const stages = composeHostBootstrapPipeline({
          reusableStageHandlers: stageHandlers,
          hostSpecificStages: input.bootstrap?.hostSpecificStages,
        });
        await executeHostBootstrapPipeline({
          context,
          stages,
        });
        const activeHost = context.getArtifact<IdentityServerHost>(StartedHostArtifactKey);
        if (!activeHost) {
          throw new Error("Authoritative server bootstrap did not produce a runtime host artifact.");
        }
        return Object.freeze({
          startedHost: activeHost,
          startupTracer,
          runtimeMetadata,
          persistenceRuntime,
          persistentPlatformServices,
          stageStatus: createStageStatusSnapshot(bootstrapState.stages),
        });
      } finally {
        startupRootSpan.complete();
      }
    },
  });
}

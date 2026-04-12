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
  type HostBootstrapReusableStageHandlers,
  type HostDeploymentProfile,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import type { StartupTracer } from "../bootstrap/startupTracer";
import type { HostCapabilityFlag } from "@domain/hosts/HostRuntimeDomain";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import {
  startIdentityServerHost,
  type IdentityServerHost,
  type IdentityServerHostOptions,
} from "./IdentityServerHost";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import type { SqlitePersistenceRuntime } from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type {
  ComfyUiExecutionAdapterInfrastructure,
} from "@infrastructure/execution/comfyui/ComfyUiExecutionAdapterComposition";
import type {
  AuthoritativeRunExecutionAdapterRegistration,
} from "@infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration";
import {
  createAuthoritativeServerConfigBootstrapStage,
  type AuthoritativeServerConfigBootstrapStage,
} from "./AuthoritativeServerConfigBootstrapStage";
import {
  createAuthoritativeServerSecurityBootstrapStage,
  type AuthoritativeServerSecurityBootstrapStage,
} from "./AuthoritativeServerSecurityBootstrapStage";
import type { AuthoritativeServerStartupBaselineRecordResult } from "./AuthoritativeServerStartupBaselineRecorder";
import {
  createAuthoritativeServerBootstrapOrchestrator,
  type AuthoritativeServerBootstrapReadinessReport,
} from "./AuthoritativeServerBootstrapOrchestrator";
import {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
  AuthoritativeServerPersistenceRuntimeArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
  AuthoritativeServerSecurityBootstrapArtifactKey,
  AuthoritativeServerServiceRegistrationPlanArtifactKey,
} from "./AuthoritativeServerBootstrapArtifactKeys";

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

export {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
  AuthoritativeServerPersistenceRuntimeArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
  AuthoritativeServerSecurityBootstrapArtifactKey,
  AuthoritativeServerServiceRegistrationPlanArtifactKey,
};

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
      let startupTracer: StartupTracer | undefined;
      let runtimeMetadata: HostRuntimeMetadata | undefined;
      let startedHost: IdentityServerHost | undefined;
      let persistenceRuntime: SqlitePersistenceRuntime | undefined;
      let persistentPlatformServices: AuthoritativePersistentPlatformServices | undefined;
      let startupFailure: unknown | undefined;
      let authoritativeStageStatus: ReadonlyArray<{
        readonly stageId: string;
        readonly sequence: number;
        readonly state: string;
        readonly durationMs?: number;
        readonly failure?: Readonly<Record<string, string>>;
      }> = [];
      let startupReadinessReport: AuthoritativeServerBootstrapReadinessReport = Object.freeze({
        state: "not-ready",
        checks: Object.freeze([]),
        totalCheckCount: 0,
        readyCheckCount: 0,
        degradedCheckCount: 0,
        failedCheckCount: 0,
        blockingFailureCount: 0,
      });
      const pipelineStageSummaries: AuthoritativeServerPipelineStageSummary[] = [];

      await lifecycle.markComposing("compose-authoritative-server-host");

      try {
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

        const configStageFactory = (
          input.bootstrap?.createConfigStage
          ?? (() => createAuthoritativeServerConfigBootstrapStage({
            startup: {
              deploymentProfile: input.bootstrap?.deploymentProfile,
              enabledCapabilities: input.bootstrap?.enabledCapabilities,
            },
            createStartupTracer: input.bootstrap?.createStartupTracer,
          }))
        );
        const securityStageFactory = (
          input.bootstrap?.createSecurityStage
          ?? (() => createAuthoritativeServerSecurityBootstrapStage())
        );

        const bootstrapOrchestrator = createAuthoritativeServerBootstrapOrchestrator({
          boot,
          hostOptions: input.hostOptions,
          startHost,
          bootstrap: {
            ...input.bootstrap,
            lifecycleHooks,
            createConfigStage: configStageFactory,
            createSecurityStage: securityStageFactory,
          },
        });
        const bootstrapResult = await bootstrapOrchestrator.execute();
        startupTracer = bootstrapResult.startupTracer;
        runtimeMetadata = bootstrapResult.runtimeMetadata;
        startedHost = bootstrapResult.startedHost;
        persistenceRuntime = bootstrapResult.persistenceRuntime;
        persistentPlatformServices = bootstrapResult.persistentPlatformServices;
        authoritativeStageStatus = bootstrapResult.stageStatus.stages;
        startupReadinessReport = bootstrapResult.readinessReport;

        const activeHost = startedHost;
        const activePersistenceRuntime = persistenceRuntime;
        const resolvedStartupTracer = startupTracer as StartupTracer;
        const resolvedRuntimeMetadata = runtimeMetadata as HostRuntimeMetadata;

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
        const startupCompletedAtMs = Date.now();
        const startupCompletedAt = new Date(startupCompletedAtMs).toISOString();
        const pipelineFailures = pipelineStageSummaries
          .filter((stage) => stage.status === "failed")
          .map((stage) => Object.freeze({
            stageId: stage.stageId,
            sequence: stage.sequence,
            failure: stage.failure,
          }));
        const summaryReadinessReport = (
          startupReadinessReport.totalCheckCount > 0 || authoritativeStageStatus.length > 0
            ? startupReadinessReport
            : Object.freeze({
              ...startupReadinessReport,
              state: pipelineFailures.length > 0 ? "degraded" : "not-ready",
            } satisfies AuthoritativeServerBootstrapReadinessReport)
        );
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
            stageCount: authoritativeStageStatus.length,
            stages: Object.freeze(authoritativeStageStatus),
            failedStageCount: authoritativeStageStatus.filter((stage) => stage.state === "failed").length,
            failures: Object.freeze(authoritativeStageStatus
              .filter((stage) => stage.state === "failed")
              .map((stage) => Object.freeze({
                stageId: stage.stageId,
                sequence: stage.sequence,
                failure: stage.failure,
              }))),
          }),
          startupResult: Object.freeze({
            outcome: startupFailure ? "failed" : "succeeded",
            readiness: summaryReadinessReport,
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
            authoritativeStageStatus
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

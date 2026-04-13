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
import type {
  AuthoritativeServerCapabilityActivationRequest,
  AuthoritativeServerCapabilityActivationSnapshot,
} from "./AuthoritativeServerCapabilityActivation";
import {
  createHostLifecycleCoordinator,
} from "../lifecycle/HostLifecycleCoordinator";
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
import {
  createAuthoritativeServerBootstrapOrchestrator,
  type AuthoritativeServerBootstrapReadinessReport,
} from "./AuthoritativeServerBootstrapOrchestrator";
import type { AuthoritativeServerShutdownDisposalPlan } from "./composition/contracts/AuthoritativeServerCompositionModuleContracts";
import {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
  AuthoritativeServerPersistenceRuntimeArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
  AuthoritativeServerSecurityBootstrapArtifactKey,
  AuthoritativeServerServiceRegistrationPlanArtifactKey,
} from "./AuthoritativeServerBootstrapArtifactKeys";
import {
  combineStartupLifecycleHooks,
  createLifecycleCleanupHooksFromShutdownPlan,
} from "./AuthoritativeServerLifecycleComposition";
import {
  attachStartupCorrelationIdToError,
  emitAuthoritativeServerStartupTelemetry,
  summarizeStartupError,
  type AuthoritativeServerPipelineStageSummary,
  type AuthoritativeServerRecordStartupBaseline,
} from "./AuthoritativeServerStartupTelemetry";

interface BootstrapFailureDiagnosticsCarrier {
  readonly bootstrapStageStatus?: {
    readonly stages: ReadonlyArray<{
      readonly stageId: string;
      readonly sequence: number;
      readonly state: string;
      readonly durationMs?: number;
      readonly failure?: Readonly<Record<string, string>>;
    }>;
  };
  readonly bootstrapReadinessReport?: AuthoritativeServerBootstrapReadinessReport;
}

export interface AuthoritativeServerHostRuntimeHandle extends HostRuntimeHandle {
  readonly port: number;
  readonly address: string;
  readonly startupCorrelationId?: string;
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
  readonly activateCapabilities: (
    request: AuthoritativeServerCapabilityActivationRequest,
  ) => AuthoritativeServerCapabilityActivationSnapshot;
  readonly getCapabilityActivationSnapshot: () => AuthoritativeServerCapabilityActivationSnapshot | undefined;
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
    readonly recordStartupBaseline?: AuthoritativeServerRecordStartupBaseline;
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
      let shutdownDisposalPlan: AuthoritativeServerShutdownDisposalPlan = Object.freeze({
        stageId: "shutdown-preparation",
        steps: Object.freeze([]),
      });
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
        securityMaterial: Object.freeze({
          state: "degraded",
          blocking: false,
          lifecycleStage: "unknown",
          productionCapable: false,
          issueCount: 0,
          fatalIssueCount: 0,
          warningIssueCount: 0,
          summary: Object.freeze({
            total: 0,
            healthy: 0,
            degraded: 0,
            missing: 0,
            nonCompliant: 0,
          }),
          issues: Object.freeze([]),
          entries: Object.freeze([]),
          governanceAssertions: Object.freeze({
            total: 0,
            warning: 0,
            blocked: 0,
            entries: Object.freeze([]),
          }),
        }),
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
        shutdownDisposalPlan = bootstrapResult.shutdownDisposalPlan;
        authoritativeStageStatus = bootstrapResult.stageStatus.stages;
        startupReadinessReport = bootstrapResult.readinessReport;

        const activeHost = startedHost;
        const resolvedStartupTracer = startupTracer as StartupTracer;
        const resolvedRuntimeMetadata = runtimeMetadata as HostRuntimeMetadata;
        const stopCleanupHooks = createLifecycleCleanupHooksFromShutdownPlan({
          plan: shutdownDisposalPlan,
          reason: "authoritative-server-stop-requested",
        });

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "authoritative-server-stop-requested",
            shutdownCompletedReason: "authoritative-server-stopped",
            shutdownFailureReason: "authoritative-server-stop-failed",
            cleanupHooks: stopCleanupHooks,
          });
        };

        const activateCapabilities = (
          request: AuthoritativeServerCapabilityActivationRequest,
        ): AuthoritativeServerCapabilityActivationSnapshot => {
          if (!activeHost.activateCapabilities) {
            throw new Error("Authoritative server runtime host does not expose capability activation.");
          }
          return activeHost.activateCapabilities(request);
        };

        const getCapabilityActivationSnapshot = (): AuthoritativeServerCapabilityActivationSnapshot | undefined => {
          return activeHost.getCapabilityActivationSnapshot?.();
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
          activateCapabilities,
          getCapabilityActivationSnapshot,
          stop,
        });
      } catch (error) {
        const diagnostics = error as BootstrapFailureDiagnosticsCarrier;
        if (diagnostics.bootstrapStageStatus?.stages) {
          authoritativeStageStatus = diagnostics.bootstrapStageStatus.stages;
        }
        if (diagnostics.bootstrapReadinessReport) {
          startupReadinessReport = diagnostics.bootstrapReadinessReport;
        }
        let failure: unknown = error;
        try {
          const startupFailureCleanupHooks = shutdownDisposalPlan.steps.length > 0
            ? createLifecycleCleanupHooksFromShutdownPlan({
              plan: shutdownDisposalPlan,
              reason: "authoritative-server-start-failure-cleanup",
            })
            : [{
              hookId: "close-persistence-runtime",
              run: async () => {
                persistentPlatformServices?.dispose();
                await persistenceRuntime?.dispose();
              },
            }];
          await lifecycle.runStartupFailureCleanup({
            cleanupReason: "authoritative-server-start-failure-cleanup",
            cleanupFailureReason: "authoritative-server-start-failure-cleanup-failed",
            cleanupHooks: startupFailureCleanupHooks,
          });
        } catch (cleanupError) {
          failure = cleanupError;
        }
        await lifecycle.markStartupFailed("authoritative-server-start-failed", failure);
        startupFailure = failure;
        attachStartupCorrelationIdToError(failure, startupTracer?.startupCorrelationId);
        throw failure;
      } finally {
        await emitAuthoritativeServerStartupTelemetry({
          boot,
          startupTracer,
          startupStartedAtMs,
          startupStartedAt,
          startupFailure,
          pipelineStageSummaries,
          authoritativeStageStatus,
          startupReadinessReport,
          logger: input.hostOptions.logger,
          recordStartupBaseline: input.bootstrap?.recordStartupBaseline,
        });
      }
    },
  });
}

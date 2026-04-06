import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { DesktopHostRuntime } from "../HostRuntimeCatalog";
import {
  HostBootstrapStageIds,
  createHostDeploymentProfile,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapReusableStageHandlers,
  type HostBootstrapStageId,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import {
  assertDesktopHostServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import { HostRuntimeMetadataArtifactKey, advertiseHostRuntimeMetadata } from "../HostRuntimeMetadataCatalog";

export interface DesktopRuntimeHost {
  close(): Promise<void>;
}

export interface DesktopHostRuntimeHandle extends HostRuntimeHandle {
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
}

export interface DesktopCompositionRootOptions {
  readonly hostOptions?: Readonly<Record<string, unknown>>;
  readonly startHost: (
    options: Readonly<Record<string, unknown>>,
    boot: HostBootConfiguration,
  ) => Promise<DesktopRuntimeHost>;
  readonly bootstrap?: {
    readonly deploymentProfile?: {
      readonly profileId?: string;
      readonly environmentName?: string;
      readonly releaseChannel?: string;
      readonly region?: string;
      readonly metadata?: Readonly<Record<string, string | undefined>>;
    };
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly stageHandlers?: HostBootstrapReusableStageHandlers;
    readonly hostSpecificStages?: ReadonlyArray<HostSpecificBootstrapStage>;
    readonly lifecycleHooks?: HostStartupLifecycleHooks;
    readonly composeServiceRegistrationPlan?: (boot: HostBootConfiguration) => HostServiceRegistrationPlan;
    readonly assertServiceCoverage?: (plan: HostServiceRegistrationPlan) => void;
  };
}

const StartedHostArtifactKey = "artifact:host:desktop:runtime";
export const DesktopServiceRegistrationPlanArtifactKey =
  "artifact:host:desktop:service-registration-plan";

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

export function createDesktopCompositionRoot(
  input: DesktopCompositionRootOptions,
): ExecutableHostCompositionRoot<DesktopHostRuntimeHandle> {
  return Object.freeze({
    compositionRootId: "composition-root:host:desktop:app-shell",
    host: DesktopHostRuntime,
    dependencyBoundary: DesktopHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<DesktopHostRuntimeHandle> {
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:desktop:app-shell",
        host: DesktopHostRuntime,
        dependencyBoundary: DesktopHostRuntime.startupDependencies,
      }, boot);

      const lifecycle = createHostLifecycleCoordinator({ boot });
      const runtimeMetadata = advertiseHostRuntimeMetadata({
        host: boot.host,
        metadata: Object.freeze({
          compositionRootId: "composition-root:host:desktop:app-shell",
          startupReason: boot.startupReason,
          controlPlaneSource: "remote-authoritative-server",
        }),
      });
      let startedHost: DesktopRuntimeHost | undefined;
      await lifecycle.markComposing("compose-desktop-host");

      try {
        const environment = input.bootstrap?.environment ?? boot.environment;
        const deploymentProfile = createHostDeploymentProfile({
          profileId: input.bootstrap?.deploymentProfile?.profileId ?? "deployment:host:desktop:app-shell",
          environmentName: input.bootstrap?.deploymentProfile?.environmentName
            ?? environment.NODE_ENV
            ?? "development",
          releaseChannel: input.bootstrap?.deploymentProfile?.releaseChannel
            ?? (environment.NODE_ENV === "production" ? "stable" : "development"),
          region: input.bootstrap?.deploymentProfile?.region,
          metadata: input.bootstrap?.deploymentProfile?.metadata,
        });

        const hostOptions = Object.freeze({ ...(input.hostOptions ?? {}) });
        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact("artifact:host:desktop:host-options", context.hostConfiguration);
            context.setArtifact(HostRuntimeMetadataArtifactKey, runtimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composePlan = input.bootstrap?.composeServiceRegistrationPlan
              ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                host: composedBoot.host,
                requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
              }));
            const plan = composePlan(context.boot);
            context.setArtifact(DesktopServiceRegistrationPlanArtifactKey, plan);
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              DesktopServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Desktop startup requires a composed host service registration plan.");
            }
            (input.bootstrap?.assertServiceCoverage ?? assertDesktopHostServiceCoverage)(plan);
            const host = await input.startHost(context.hostConfiguration, context.boot);
            context.setArtifact(StartedHostArtifactKey, host);
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-desktop-host");
            }
          },
          onPipelineCompleted: async (event) => {
            if (lifecycle.phase === HostLifecyclePhases.starting) {
              await lifecycle.markStartupCompleted({
                transitionReason: "desktop-host-ready",
                completionReason: "desktop-host-startup-completed",
                readinessMarker: "desktop-host:feature-registration-complete",
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
          deploymentProfile,
          environment,
          hostConfiguration: hostOptions,
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
        startedHost = context.getArtifact<DesktopRuntimeHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Desktop bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "desktop-host-stop-requested",
            shutdownCompletedReason: "desktop-host-stopped",
            shutdownFailureReason: "desktop-host-stop-failed",
            cleanupHooks: [{
              hookId: "close-runtime-host",
              run: async () => {
                await activeHost.close();
              },
            }],
          });
        };

        return Object.freeze({
          host: boot.host,
          runtimeMetadata,
          get phase() {
            return lifecycle.phase;
          },
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
              cleanupReason: "desktop-host-start-failure-cleanup",
              cleanupFailureReason: "desktop-host-start-failure-cleanup-failed",
              cleanupHooks: [{
                hookId: "close-runtime-host",
                run: async () => {
                  await startedHost?.close();
                },
              }],
            });
          } catch (cleanupError) {
            failure = cleanupError;
          }
        }
        await lifecycle.markStartupFailed("desktop-host-start-failed", failure);
        throw failure;
      }
    },
  });
}

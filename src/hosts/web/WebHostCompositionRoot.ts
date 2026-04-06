import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { WebHostRuntime } from "../HostRuntimeCatalog";
import {
  HostBootstrapStageIds,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapReusableStageHandlers,
  type HostBootstrapStageId,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import {
  assertWebHostServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import { resolveHostStartupConfiguration } from "../../infrastructure/config/HostStartupConfiguration";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import { HostRuntimeMetadataArtifactKey, advertiseHostRuntimeMetadata } from "../HostRuntimeMetadataCatalog";
import type { HostCapabilityFlag } from "../../domain/hosts/HostRuntimeDomain";

export interface WebHostDeliveryContext {
  readonly deliveryMode: "thin-client" | "static-shell";
  readonly basePath?: string;
}

export interface WebRuntimeHost {
  close(): Promise<void>;
}

export interface WebHostRuntimeHandle extends HostRuntimeHandle {
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
  readonly delivery: WebHostDeliveryContext;
}

export interface WebCompositionRootOptions {
  readonly hostOptions?: {
    readonly deliveryMode?: WebHostDeliveryContext["deliveryMode"];
    readonly basePath?: string;
    readonly [key: string]: unknown;
  };
  readonly startHost: (
    options: Readonly<Record<string, unknown>>,
    boot: HostBootConfiguration,
    delivery: WebHostDeliveryContext,
  ) => Promise<WebRuntimeHost>;
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
  };
}

const StartedHostArtifactKey = "artifact:host:web:runtime";
const WebHostDeliveryArtifactKey = "artifact:host:web:delivery";
export const WebServiceRegistrationPlanArtifactKey =
  "artifact:host:web:service-registration-plan";

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

function normalizeBasePath(basePath: string | undefined): string | undefined {
  const normalized = basePath?.trim();
  if (!normalized) {
    return undefined;
  }
  if (!normalized.startsWith("/")) {
    return `/${normalized}`;
  }
  return normalized;
}

export function createWebCompositionRoot(
  input: WebCompositionRootOptions,
): ExecutableHostCompositionRoot<WebHostRuntimeHandle> {
  const delivery: WebHostDeliveryContext = Object.freeze({
    deliveryMode: input.hostOptions?.deliveryMode ?? "thin-client",
    basePath: normalizeBasePath(input.hostOptions?.basePath),
  });

  return Object.freeze({
    compositionRootId: "composition-root:host:web:thin-client",
    host: WebHostRuntime,
    dependencyBoundary: WebHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<WebHostRuntimeHandle> {
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:web:thin-client",
        host: WebHostRuntime,
        dependencyBoundary: WebHostRuntime.startupDependencies,
      }, boot);

      const lifecycle = createHostLifecycleCoordinator({ boot });
      const runtimeMetadata = advertiseHostRuntimeMetadata({
        host: boot.host,
        metadata: Object.freeze({
          compositionRootId: "composition-root:host:web:thin-client",
          startupReason: boot.startupReason,
          deliveryMode: delivery.deliveryMode,
          basePath: delivery.basePath,
        }),
      });
      let startedHost: WebRuntimeHost | undefined;
      await lifecycle.markComposing("compose-web-host");

      try {
        const startupConfiguration = resolveHostStartupConfiguration({
          boot,
          startup: {
            deploymentProfile: input.bootstrap?.deploymentProfile,
            environment: input.bootstrap?.environment,
            enabledCapabilities: input.bootstrap?.enabledCapabilities,
          },
        });

        const hostOptions = Object.freeze({ ...(input.hostOptions ?? {}) });
        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact("artifact:host:web:host-options", context.hostConfiguration);
            context.setArtifact(WebHostDeliveryArtifactKey, delivery);
            context.setArtifact(HostRuntimeMetadataArtifactKey, runtimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composePlan = input.bootstrap?.composeServiceRegistrationPlan
              ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                host: composedBoot.host,
                requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
              }));
            const plan = composePlan(context.boot);
            context.setArtifact(WebServiceRegistrationPlanArtifactKey, plan);
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              WebServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Web host startup requires a composed host service registration plan.");
            }
            (input.bootstrap?.assertServiceCoverage ?? assertWebHostServiceCoverage)(plan);
            const host = await input.startHost(context.hostConfiguration, context.boot, delivery);
            context.setArtifact(StartedHostArtifactKey, host);
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-web-host");
            }
          },
          onPipelineCompleted: async (event) => {
            if (lifecycle.phase === HostLifecyclePhases.starting) {
              await lifecycle.markStartupCompleted({
                transitionReason: "web-host-ready",
                completionReason: "web-host-startup-completed",
                readinessMarker: "web-host:feature-registration-complete",
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
        startedHost = context.getArtifact<WebRuntimeHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Web bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "web-host-stop-requested",
            shutdownCompletedReason: "web-host-stopped",
            shutdownFailureReason: "web-host-stop-failed",
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
          delivery,
          stop,
        });
      } catch (error) {
        let failure: unknown = error;
        if (startedHost) {
          try {
            await lifecycle.runStartupFailureCleanup({
              cleanupReason: "web-host-start-failure-cleanup",
              cleanupFailureReason: "web-host-start-failure-cleanup-failed",
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
        await lifecycle.markStartupFailed("web-host-start-failed", failure);
        throw failure;
      }
    },
  });
}

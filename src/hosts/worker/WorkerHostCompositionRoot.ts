import {
  HostLifecyclePhases,
  HostCompositionContractError,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { HostCapabilityFlags, type HostCapabilityFlag } from "../../domain/hosts/HostRuntimeDomain";
import { WorkerHostRuntime } from "../HostRuntimeCatalog";
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
  assertWorkerHostServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import { resolveHostStartupConfiguration } from "../../infrastructure/config/HostStartupConfiguration";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";
import { HostRuntimeMetadataArtifactKey, advertiseHostRuntimeMetadata } from "../HostRuntimeMetadataCatalog";

export interface WorkerCapabilitySelection {
  readonly enableNodeExecution?: boolean;
  readonly enableWorkerRuntime?: boolean;
}

export interface WorkerRuntimeStartContext {
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly nodeRegistrationCapabilities: ReadonlyArray<HostCapabilityFlag>;
}

export interface WorkerRuntimeHost {
  close(): Promise<void>;
}

export interface WorkerHostRuntimeHandle extends HostRuntimeHandle {
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly nodeRegistrationCapabilities: ReadonlyArray<HostCapabilityFlag>;
}

export interface WorkerCompositionRootOptions {
  readonly hostOptions?: Readonly<Record<string, unknown>>;
  readonly startHost: (
    options: Readonly<Record<string, unknown>>,
    boot: HostBootConfiguration,
    context: WorkerRuntimeStartContext,
  ) => Promise<WorkerRuntimeHost>;
  readonly capabilitySelection?: WorkerCapabilitySelection;
  readonly nodeRegistrationCapabilities?: ReadonlyArray<HostCapabilityFlag>;
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

const StartedHostArtifactKey = "artifact:host:worker:runtime";
export const WorkerServiceRegistrationPlanArtifactKey =
  "artifact:host:worker:service-registration-plan";
export const WorkerEnabledCapabilitiesArtifactKey =
  "artifact:host:worker:enabled-capabilities";

const RequiredWorkerCapabilities = Object.freeze([
  HostCapabilityFlags.nodeExecution,
  HostCapabilityFlags.workerRuntime,
]);

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

export function resolveWorkerEnabledCapabilities(
  selection?: WorkerCapabilitySelection,
): ReadonlyArray<HostCapabilityFlag> {
  const enableNodeExecution = selection?.enableNodeExecution ?? true;
  const enableWorkerRuntime = selection?.enableWorkerRuntime ?? true;

  if (enableNodeExecution !== enableWorkerRuntime) {
    throw new HostCompositionContractError(
      "Worker host requires node execution and worker runtime capabilities to be enabled together.",
    );
  }
  if (!enableNodeExecution || !enableWorkerRuntime) {
    throw new HostCompositionContractError(
      "Worker host cannot disable node execution or worker runtime capabilities.",
    );
  }

  return Object.freeze([...RequiredWorkerCapabilities]);
}

function resolveWorkerNodeRegistrationCapabilities(
  enabledCapabilities: ReadonlyArray<HostCapabilityFlag>,
  requestedCapabilities: ReadonlyArray<HostCapabilityFlag> | undefined,
): ReadonlyArray<HostCapabilityFlag> {
  if (!requestedCapabilities || requestedCapabilities.length < 1) {
    return enabledCapabilities;
  }

  const enabledSet = new Set(enabledCapabilities);
  const normalized = new Set<HostCapabilityFlag>();
  for (const capability of requestedCapabilities) {
    if (!enabledSet.has(capability)) {
      throw new HostCompositionContractError(
        `Worker node registration capability '${capability}' is not enabled for this worker host composition.`,
      );
    }
    normalized.add(capability);
  }

  return Object.freeze([...normalized.values()]);
}

export function createWorkerCompositionRoot(
  input: WorkerCompositionRootOptions,
): ExecutableHostCompositionRoot<WorkerHostRuntimeHandle> {
  const enabledCapabilities = resolveWorkerEnabledCapabilities(input.capabilitySelection);
  const nodeRegistrationCapabilities = resolveWorkerNodeRegistrationCapabilities(
    enabledCapabilities,
    input.nodeRegistrationCapabilities,
  );

  return Object.freeze({
    compositionRootId: "composition-root:host:worker:runtime",
    host: WorkerHostRuntime,
    dependencyBoundary: WorkerHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<WorkerHostRuntimeHandle> {
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:worker:runtime",
        host: WorkerHostRuntime,
        dependencyBoundary: WorkerHostRuntime.startupDependencies,
      }, boot);

      for (const requiredCapability of enabledCapabilities) {
        if (!boot.host.capabilities.includes(requiredCapability)) {
          throw new HostCompositionContractError(
            `Worker host boot does not support required capability '${requiredCapability}'.`,
          );
        }
      }

      const lifecycle = createHostLifecycleCoordinator({ boot });
      const runtimeMetadata = advertiseHostRuntimeMetadata({
        host: boot.host,
        advertisedCapabilities: enabledCapabilities,
        metadata: Object.freeze({
          compositionRootId: "composition-root:host:worker:runtime",
          startupReason: boot.startupReason,
          nodeRegistrationCapabilities: nodeRegistrationCapabilities.join(","),
        }),
      });
      let startedHost: WorkerRuntimeHost | undefined;
      await lifecycle.markComposing("compose-worker-host");

      try {
        const startupConfiguration = resolveHostStartupConfiguration({
          boot,
          startup: {
            deploymentProfile: input.bootstrap?.deploymentProfile,
            environment: input.bootstrap?.environment,
            enabledCapabilities,
          },
        });

        const hostOptions = Object.freeze({ ...(input.hostOptions ?? {}) });
        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact("artifact:host:worker:host-options", context.hostConfiguration);
            context.setArtifact(WorkerEnabledCapabilitiesArtifactKey, enabledCapabilities);
            context.setArtifact(HostRuntimeMetadataArtifactKey, runtimeMetadata);
          },
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composePlan = input.bootstrap?.composeServiceRegistrationPlan
              ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                host: composedBoot.host,
                requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
              }));
            const plan = composePlan(context.boot);
            context.setArtifact(WorkerServiceRegistrationPlanArtifactKey, plan);
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              WorkerServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Worker startup requires a composed host service registration plan.");
            }
            (input.bootstrap?.assertServiceCoverage ?? assertWorkerHostServiceCoverage)(plan);
            const host = await input.startHost(context.hostConfiguration, context.boot, {
              enabledCapabilities,
              nodeRegistrationCapabilities,
            });
            context.setArtifact(StartedHostArtifactKey, host);
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-worker-host");
            }
          },
          onPipelineCompleted: async (event) => {
            if (lifecycle.phase === HostLifecyclePhases.starting) {
              await lifecycle.markStartupCompleted({
                transitionReason: "worker-host-ready",
                completionReason: "worker-host-startup-completed",
                readinessMarker: "worker-host:feature-registration-complete",
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
        startedHost = context.getArtifact<WorkerRuntimeHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Worker bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "worker-host-stop-requested",
            shutdownCompletedReason: "worker-host-stopped",
            shutdownFailureReason: "worker-host-stop-failed",
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
          get enabledCapabilities() {
            return Object.freeze([...enabledCapabilities]);
          },
          get nodeRegistrationCapabilities() {
            return Object.freeze([...nodeRegistrationCapabilities]);
          },
          stop,
        });
      } catch (error) {
        let failure: unknown = error;
        if (startedHost) {
          try {
            await lifecycle.runStartupFailureCleanup({
              cleanupReason: "worker-host-start-failure-cleanup",
              cleanupFailureReason: "worker-host-start-failure-cleanup-failed",
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
        await lifecycle.markStartupFailed("worker-host-start-failed", failure);
        throw failure;
      }
    },
  });
}

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
import { HybridHostRuntime } from "../HostRuntimeCatalog";
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
  assertHybridHostServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";

export const HybridHostControlPlaneSources = Object.freeze({
  remoteAuthoritativeServer: "remote-authoritative-server",
  localAuthoritativeServerDelegated: "local-authoritative-server-delegated",
});

export type HybridHostControlPlaneSource =
  typeof HybridHostControlPlaneSources[keyof typeof HybridHostControlPlaneSources];

export interface HybridCapabilitySelection {
  readonly composeDesktopShell?: boolean;
  readonly composeUserInterface?: boolean;
  readonly composeIpcBridge?: boolean;
  readonly composeLocalPersistence?: boolean;
  readonly enableNodeExecution?: boolean;
  readonly enableWorkerRuntime?: boolean;
}

export interface HybridRuntimeStartContext {
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly controlPlaneSource: HybridHostControlPlaneSource;
}

export interface HybridRuntimeHost {
  close(): Promise<void>;
}

export interface HybridHostRuntimeHandle extends HostRuntimeHandle {
  readonly transitionHistory: ReadonlyArray<HostLifecycleTransition>;
  readonly enabledCapabilities: ReadonlyArray<HostCapabilityFlag>;
  readonly controlPlaneSource: HybridHostControlPlaneSource;
}

export interface HybridCompositionRootOptions {
  readonly hostOptions?: Readonly<Record<string, unknown>>;
  readonly startHost: (
    options: Readonly<Record<string, unknown>>,
    boot: HostBootConfiguration,
    context: HybridRuntimeStartContext,
  ) => Promise<HybridRuntimeHost>;
  readonly capabilitySelection?: HybridCapabilitySelection;
  readonly controlPlaneSource?: HybridHostControlPlaneSource;
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

const StartedHostArtifactKey = "artifact:host:hybrid:runtime";
export const HybridServiceRegistrationPlanArtifactKey =
  "artifact:host:hybrid:service-registration-plan";
export const HybridEnabledCapabilitiesArtifactKey =
  "artifact:host:hybrid:enabled-capabilities";

const RequiredDesktopFacingCapabilities = Object.freeze([
  HostCapabilityFlags.desktopShell,
  HostCapabilityFlags.userInterfaceRendering,
  HostCapabilityFlags.ipcBridge,
  HostCapabilityFlags.localPersistence,
]);
const RequiredNodeRuntimeCapabilities = Object.freeze([
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

export function resolveHybridEnabledCapabilities(
  selection?: HybridCapabilitySelection,
): ReadonlyArray<HostCapabilityFlag> {
  const composeDesktopShell = selection?.composeDesktopShell ?? true;
  const composeUserInterface = selection?.composeUserInterface ?? true;
  const composeIpcBridge = selection?.composeIpcBridge ?? true;
  const composeLocalPersistence = selection?.composeLocalPersistence ?? true;
  const enableNodeExecution = selection?.enableNodeExecution ?? true;
  const enableWorkerRuntime = selection?.enableWorkerRuntime ?? true;

  if (!composeDesktopShell || !composeUserInterface || !composeIpcBridge || !composeLocalPersistence) {
    throw new HostCompositionContractError(
      "Hybrid host must compose desktop shell, UI rendering, IPC bridge, and local persistence features.",
    );
  }
  if (enableNodeExecution !== enableWorkerRuntime) {
    throw new HostCompositionContractError(
      "Hybrid host requires node execution and worker runtime capabilities to be enabled together.",
    );
  }
  if (!enableNodeExecution || !enableWorkerRuntime) {
    throw new HostCompositionContractError(
      "Hybrid host cannot disable node execution or worker runtime capabilities.",
    );
  }

  const enabled = new Set<HostCapabilityFlag>([
    ...RequiredDesktopFacingCapabilities,
    ...RequiredNodeRuntimeCapabilities,
  ]);
  return Object.freeze([...enabled.values()]);
}

function assertHybridControlPlaneSource(
  source: HybridHostControlPlaneSource,
): void {
  if (source === HybridHostControlPlaneSources.localAuthoritativeServerDelegated) {
    throw new HostCompositionContractError(
      "Hybrid composition root cannot claim local authoritative control-plane ownership. " +
      "Use authoritative server host assembly startup for intentional authoritative execution.",
    );
  }
}

export function createHybridCompositionRoot(
  input: HybridCompositionRootOptions,
): ExecutableHostCompositionRoot<HybridHostRuntimeHandle> {
  const controlPlaneSource = input.controlPlaneSource ?? HybridHostControlPlaneSources.remoteAuthoritativeServer;
  const enabledCapabilities = resolveHybridEnabledCapabilities(input.capabilitySelection);
  assertHybridControlPlaneSource(controlPlaneSource);

  return Object.freeze({
    compositionRootId: "composition-root:host:hybrid:desktop-worker",
    host: HybridHostRuntime,
    dependencyBoundary: HybridHostRuntime.startupDependencies,
    async compose(boot: HostBootConfiguration): Promise<HybridHostRuntimeHandle> {
      assertExecutableHostBoundarySatisfiesBootConfiguration({
        compositionRootId: "composition-root:host:hybrid:desktop-worker",
        host: HybridHostRuntime,
        dependencyBoundary: HybridHostRuntime.startupDependencies,
      }, boot);

      for (const requiredCapability of enabledCapabilities) {
        if (!boot.host.capabilities.includes(requiredCapability)) {
          throw new HostCompositionContractError(
            `Hybrid host boot does not support required capability '${requiredCapability}'.`,
          );
        }
      }

      const lifecycle = createHostLifecycleCoordinator({ boot });
      let startedHost: HybridRuntimeHost | undefined;
      await lifecycle.markComposing("compose-hybrid-host");

      try {
        const environment = input.bootstrap?.environment ?? boot.environment;
        const deploymentProfile = createHostDeploymentProfile({
          profileId: input.bootstrap?.deploymentProfile?.profileId ?? "deployment:host:hybrid:desktop-worker",
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
            context.setArtifact("artifact:host:hybrid:host-options", context.hostConfiguration);
            context.setArtifact(HybridEnabledCapabilitiesArtifactKey, enabledCapabilities);
          },
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composePlan = input.bootstrap?.composeServiceRegistrationPlan
              ?? ((composedBoot: HostBootConfiguration) => composeHostServiceRegistrationPlan({
                host: composedBoot.host,
                requiredStartupDependencyIds: composedBoot.requiredDependencyIds,
              }));
            const plan = composePlan(context.boot);
            context.setArtifact(HybridServiceRegistrationPlanArtifactKey, plan);
          },
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              HybridServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Hybrid startup requires a composed host service registration plan.");
            }
            (input.bootstrap?.assertServiceCoverage ?? assertHybridHostServiceCoverage)(plan);
            const host = await input.startHost(context.hostConfiguration, context.boot, {
              enabledCapabilities,
              controlPlaneSource,
            });
            context.setArtifact(StartedHostArtifactKey, host);
          },
        };
        const stageHandlers = combineStageHandlers(defaultStageHandlers, input.bootstrap?.stageHandlers);

        const lifecycleHooks = combineStartupLifecycleHooks({
          onStageStarting: async (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && lifecycle.phase === HostLifecyclePhases.composing) {
              await lifecycle.markStarting("start-hybrid-host");
            }
          },
          onPipelineCompleted: async (event) => {
            if (lifecycle.phase === HostLifecyclePhases.starting) {
              await lifecycle.markStartupCompleted({
                transitionReason: "hybrid-host-ready",
                completionReason: "hybrid-host-startup-completed",
                readinessMarker: "hybrid-host:feature-registration-complete",
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
        startedHost = context.getArtifact<HybridRuntimeHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Hybrid bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "hybrid-host-stop-requested",
            shutdownCompletedReason: "hybrid-host-stopped",
            shutdownFailureReason: "hybrid-host-stop-failed",
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
          controlPlaneSource,
          stop,
        });
      } catch (error) {
        let failure: unknown = error;
        if (startedHost) {
          try {
            await lifecycle.runStartupFailureCleanup({
              cleanupReason: "hybrid-host-start-failure-cleanup",
              cleanupFailureReason: "hybrid-host-start-failure-cleanup-failed",
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
        await lifecycle.markStartupFailed("hybrid-host-start-failed", failure);
        throw failure;
      }
    },
  });
}

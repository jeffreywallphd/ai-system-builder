import {
  HostLifecyclePhases,
  assertExecutableHostBoundarySatisfiesBootConfiguration,
  transitionHostLifecyclePhase,
  type ExecutableHostCompositionRoot,
  type HostBootConfiguration,
  type HostLifecycleTransition,
  type HostRuntimeHandle,
} from "../../application/common/HostCompositionContracts";
import { WebHostRuntime } from "../HostRuntimeCatalog";
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
  assertWebHostServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";

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

      let phase = HostLifecyclePhases.configured;
      const transitionHistory: HostLifecycleTransition[] = [];
      let startedHost: WebRuntimeHost | undefined;
      const recordTransition = (to: typeof HostLifecyclePhases[keyof typeof HostLifecyclePhases], reason: string) => {
        const transition = transitionHostLifecyclePhase({
          hostId: boot.host.hostId,
          from: phase,
          to,
          occurredAt: boot.startedAt,
          reason,
        });
        transitionHistory.push(transition);
        phase = to;
      };

      recordTransition(HostLifecyclePhases.composing, "compose-web-host");

      try {
        const environment = input.bootstrap?.environment ?? boot.environment;
        const deploymentProfile = createHostDeploymentProfile({
          profileId: input.bootstrap?.deploymentProfile?.profileId ?? "deployment:host:web:thin-client",
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
            context.setArtifact("artifact:host:web:host-options", context.hostConfiguration);
            context.setArtifact(WebHostDeliveryArtifactKey, delivery);
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
          onStageStarting: (event) => {
            if (event.stageId === HostBootstrapStageIds.featureRegistration && phase === HostLifecyclePhases.composing) {
              recordTransition(HostLifecyclePhases.starting, "start-web-host");
            }
          },
          onPipelineCompleted: () => {
            if (phase === HostLifecyclePhases.starting) {
              recordTransition(HostLifecyclePhases.ready, "web-host-ready");
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
        startedHost = context.getArtifact<WebRuntimeHost>(StartedHostArtifactKey);
        if (!startedHost) {
          throw new Error("Web bootstrap did not produce a runtime host artifact.");
        }
        const activeHost = startedHost;

        const stop = async () => {
          if (phase === HostLifecyclePhases.stopped || phase === HostLifecyclePhases.failed) {
            return;
          }
          recordTransition(HostLifecyclePhases.stopping, "web-host-stop-requested");
          await activeHost.close();
          recordTransition(HostLifecyclePhases.stopped, "web-host-stopped");
        };

        return Object.freeze({
          host: boot.host,
          get phase() {
            return phase;
          },
          get transitionHistory() {
            return Object.freeze([...transitionHistory]);
          },
          delivery,
          stop,
        });
      } catch (error) {
        if (phase !== HostLifecyclePhases.failed && phase !== HostLifecyclePhases.stopped) {
          const failedTransition = transitionHostLifecyclePhase({
            hostId: boot.host.hostId,
            from: phase,
            to: HostLifecyclePhases.failed,
            occurredAt: boot.startedAt,
            reason: "web-host-start-failed",
          });
          transitionHistory.push(failedTransition);
          phase = HostLifecyclePhases.failed;
        }
        if (startedHost) {
          await startedHost.close();
        }
        throw error;
      }
    },
  });
}

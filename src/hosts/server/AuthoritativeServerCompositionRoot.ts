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
  createHostDeploymentProfile,
  createHostStartupContext,
  composeHostBootstrapPipeline,
  executeHostBootstrapPipeline,
  type HostBootstrapStageId,
  type HostBootstrapReusableStageHandlers,
  type HostSpecificBootstrapStage,
  type HostStartupLifecycleHooks,
} from "../bootstrap/HostBootstrapPipeline";
import {
  assertAuthoritativeControlPlaneServiceCoverage,
  composeHostServiceRegistrationPlan,
} from "../../infrastructure/config/HostServiceRegistrationCatalog";
import type { HostServiceRegistrationPlan } from "../../infrastructure/config/HostServiceRegistration";
import {
  startIdentityServerHost,
  type IdentityServerHost,
  type IdentityServerHostOptions,
} from "../../../hosts/server/IdentityServerHost";
import { createHostLifecycleCoordinator } from "../lifecycle/HostLifecycleCoordinator";

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
    readonly stageHandlers?: HostBootstrapReusableStageHandlers;
    readonly hostSpecificStages?: ReadonlyArray<HostSpecificBootstrapStage>;
    readonly lifecycleHooks?: HostStartupLifecycleHooks;
    readonly composeServiceRegistrationPlan?: (boot: HostBootConfiguration) => HostServiceRegistrationPlan;
    readonly assertServiceCoverage?: (plan: HostServiceRegistrationPlan) => void;
  };
}

const StartedHostArtifactKey = "artifact:host:server:authoritative:runtime";
export const AuthoritativeServerServiceRegistrationPlanArtifactKey =
  "artifact:host:server:authoritative:service-registration-plan";

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
      let startedHost: IdentityServerHost | undefined;
      await lifecycle.markComposing("compose-authoritative-server-host");

      try {
        const environment = input.bootstrap?.environment ?? input.hostOptions.env ?? process.env;
        const deploymentProfile = createHostDeploymentProfile({
          profileId: input.bootstrap?.deploymentProfile?.profileId ?? "deployment:host:server:authoritative",
          environmentName: input.bootstrap?.deploymentProfile?.environmentName
            ?? environment.NODE_ENV
            ?? "development",
          releaseChannel: input.bootstrap?.deploymentProfile?.releaseChannel
            ?? (environment.NODE_ENV === "production" ? "stable" : "development"),
          region: input.bootstrap?.deploymentProfile?.region,
          metadata: input.bootstrap?.deploymentProfile?.metadata,
        });

        const defaultStageHandlers: HostBootstrapReusableStageHandlers = {
          [HostBootstrapStageIds.configuration]: (context) => {
            context.setArtifact(
              "artifact:host:server:authoritative:host-options",
              context.hostConfiguration as IdentityServerHostOptions,
            );
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
          [HostBootstrapStageIds.featureRegistration]: async (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              AuthoritativeServerServiceRegistrationPlanArtifactKey,
            );
            if (!plan) {
              throw new Error("Authoritative server startup requires a composed host service registration plan.");
            }
            (input.bootstrap?.assertServiceCoverage ?? assertAuthoritativeControlPlaneServiceCoverage)(plan);
            const composedHost = await startHost(context.hostConfiguration as IdentityServerHostOptions);
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
          deploymentProfile,
          environment,
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

        const stop = async () => {
          await lifecycle.shutdown({
            shutdownRequestedReason: "authoritative-server-stop-requested",
            shutdownCompletedReason: "authoritative-server-stopped",
            shutdownFailureReason: "authoritative-server-stop-failed",
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
        await lifecycle.markStartupFailed("authoritative-server-start-failed", failure);
        throw failure;
      }
    },
  });
}

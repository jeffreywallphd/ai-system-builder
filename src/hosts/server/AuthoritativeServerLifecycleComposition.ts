import type { HostStartupLifecycleHooks } from "../bootstrap/HostBootstrapPipeline";
import type { HostLifecycleCleanupHook } from "../lifecycle/HostLifecycleCoordinator";
import type { AuthoritativeServerShutdownDisposalPlan } from "./composition/contracts/AuthoritativeServerCompositionModuleContracts";

export interface AuthoritativeServerLifecycleCleanupHookDefinition {
  readonly hookId: string;
  readonly run: HostLifecycleCleanupHook;
}

export function combineStartupLifecycleHooks(
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

export function createLifecycleCleanupHooksFromShutdownPlan(input: {
  readonly plan: AuthoritativeServerShutdownDisposalPlan;
  readonly reason: string;
}): ReadonlyArray<AuthoritativeServerLifecycleCleanupHookDefinition> {
  return input.plan.steps.map((step) => Object.freeze({
    hookId: step.hookId,
    run: () => step.dispose(input.reason),
  }));
}

import type {
  IWorkflowRuntimeSelection,
  IWorkflowRuntimeSelector,
} from "../ports/interfaces/IWorkflowRuntimeSelector";
import type { IWorkflowExecutionInput } from "../ports/interfaces/IWorkflowExecutor";
import type {
  IWorkflowExecutionStrategy,
  IWorkflowExecutionStrategyDescriptor,
} from "../ports/interfaces/IWorkflowExecutionStrategy";
import {
  RuntimeDependencyIds,
  describeRuntimeDependencyResolution,
  type IRuntimeDependencyOrchestrator,
  type RuntimeDependencyResolution,
} from "../runtime/RuntimeDependencyOrchestrator";

export interface WorkflowRuntimeSelectorOptions {
  readonly runtimeDependencyOrchestrator?: Pick<IRuntimeDependencyOrchestrator, "ensureAvailable">;
}

function normalize(value?: string): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

export class WorkflowRuntimeSelector implements IWorkflowRuntimeSelector {
  private readonly runtimeDependencyOrchestrator?: Pick<IRuntimeDependencyOrchestrator, "ensureAvailable">;

  constructor(options: WorkflowRuntimeSelectorOptions = {}) {
    this.runtimeDependencyOrchestrator = options.runtimeDependencyOrchestrator;
  }

  public async selectStrategy(
    input: IWorkflowExecutionInput,
    strategies: ReadonlyArray<IWorkflowExecutionStrategy>
  ): Promise<IWorkflowRuntimeSelection> {
    if (strategies.length === 0) {
      throw new Error("No workflow execution strategies were provided.");
    }

    const requestedRuntime = normalize(
      typeof input.target?.runtime === "string"
        ? input.target.runtime
        : input.workflow.runtimeProfile?.preferredRuntime
    );

    const requestedMode = normalize(
      typeof input.parameters?.executionMode === "string"
        ? input.parameters.executionMode
        : undefined
    );

    const compatibleStrategies = strategies.filter((strategy) => strategy.canHandle(input));
    const explicitMatches = compatibleStrategies.filter((strategy) => {
      const descriptor = strategy.getDescriptor();
      const runtimeMatches = !requestedRuntime || descriptor.runtime.toLowerCase() === requestedRuntime;
      const modeMatches = !requestedMode || descriptor.mode.toLowerCase() === requestedMode;
      return runtimeMatches && modeMatches;
    });

    const blockedReasons: string[] = [];
    const explicitSelection = await this.pickAvailableStrategy(explicitMatches, blockedReasons, "Matched requested runtime/mode.");
    if (explicitSelection) {
      return {
        strategy: explicitSelection.strategy,
        reason: blockedReasons.length > 0
          ? `Matched requested runtime/mode after skipping blocked delegated paths. ${blockedReasons.join(" ")}`.trim()
          : explicitSelection.reason,
      };
    }

    const fallbackSelection = await this.pickAvailableStrategy(compatibleStrategies, blockedReasons, "Fell back to first compatible strategy.");
    if (!fallbackSelection) {
      throw new Error(
        `No workflow execution strategy can handle workflow '${input.workflow.id}'.`
      );
    }

    return {
      strategy: fallbackSelection.strategy,
      reason: blockedReasons.length > 0
        ? `${fallbackSelection.reason} ${blockedReasons.join(" ")}`.trim()
        : fallbackSelection.reason,
    };
  }

  private async pickAvailableStrategy(
    strategies: ReadonlyArray<IWorkflowExecutionStrategy>,
    blockedReasons: string[],
    baseReason: string,
  ): Promise<IWorkflowRuntimeSelection | undefined> {
    let workflowExecutionResolution: RuntimeDependencyResolution | undefined;

    for (const strategy of strategies) {
      const dependencyId = mapStrategyDependencyId(strategy.getDescriptor());
      if (!dependencyId || !this.runtimeDependencyOrchestrator) {
        return {
          strategy,
          reason: baseReason,
        };
      }

      workflowExecutionResolution ??= await this.runtimeDependencyOrchestrator.ensureAvailable(dependencyId);
      if (workflowExecutionResolution.available) {
        const detail = workflowExecutionResolution.degraded
          ? ` Delegated runtime is available but degraded: ${describeRuntimeDependencyResolution(workflowExecutionResolution)}`
          : "";
        return {
          strategy,
          reason: `${baseReason}${detail}`.trim(),
        };
      }

      blockedReasons.push(
        `Skipped ${strategy.getDescriptor().id} because ${describeRuntimeDependencyResolution(workflowExecutionResolution)}`,
      );
    }

    return undefined;
  }
}

function mapStrategyDependencyId(
  descriptor: IWorkflowExecutionStrategyDescriptor,
): typeof RuntimeDependencyIds[keyof typeof RuntimeDependencyIds] | undefined {
  return descriptor.mode === "delegated"
    ? RuntimeDependencyIds.workflowExecutionRuntime
    : undefined;
}

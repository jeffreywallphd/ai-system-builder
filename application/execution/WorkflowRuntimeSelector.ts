import type {
  IWorkflowRuntimeSelection,
  IWorkflowRuntimeSelector,
} from "../ports/interfaces/IWorkflowRuntimeSelector";
import type { IWorkflowExecutionInput } from "../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionStrategy } from "../ports/interfaces/IWorkflowExecutionStrategy";

function normalize(value?: string): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

export class WorkflowRuntimeSelector implements IWorkflowRuntimeSelector {
  public selectStrategy(
    input: IWorkflowExecutionInput,
    strategies: ReadonlyArray<IWorkflowExecutionStrategy>
  ): IWorkflowRuntimeSelection {
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

    const explicitMatch = strategies.find((strategy) => {
      const descriptor = strategy.getDescriptor();
      const runtimeMatches =
        !requestedRuntime || descriptor.runtime.toLowerCase() === requestedRuntime;
      const modeMatches = !requestedMode || descriptor.mode.toLowerCase() === requestedMode;
      return runtimeMatches && modeMatches && strategy.canHandle(input);
    });

    if (explicitMatch) {
      return { strategy: explicitMatch, reason: "Matched requested runtime/mode." };
    }

    const fallback = strategies.find((strategy) => strategy.canHandle(input));
    if (!fallback) {
      throw new Error(
        `No workflow execution strategy can handle workflow '${input.workflow.id}'.`
      );
    }

    return { strategy: fallback, reason: "Fell back to first compatible strategy." };
  }
}

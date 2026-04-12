import type { IWorkflowExecutionInput } from "./IWorkflowExecutor";
import type { IWorkflowExecutionStrategy } from "./IWorkflowExecutionStrategy";

export interface IWorkflowRuntimeSelection {
  readonly strategy: IWorkflowExecutionStrategy;
  readonly reason: string;
}

export interface IWorkflowRuntimeSelector {
  selectStrategy(
    input: IWorkflowExecutionInput,
    strategies: ReadonlyArray<IWorkflowExecutionStrategy>
  ): Promise<IWorkflowRuntimeSelection>;
}

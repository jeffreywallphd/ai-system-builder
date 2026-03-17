import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "./IWorkflowExecutor";

export type WorkflowExecutionMode = "delegated" | "interpreted" | "hybrid";

export interface IWorkflowExecutionStrategyDescriptor {
  readonly id: string;
  readonly runtime: string;
  readonly mode: WorkflowExecutionMode;
  readonly supportsPartialDelegation: boolean;
}

export interface IWorkflowExecutionStrategy {
  getDescriptor(): IWorkflowExecutionStrategyDescriptor;
  canHandle(input: IWorkflowExecutionInput): boolean;
  execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult>;
}

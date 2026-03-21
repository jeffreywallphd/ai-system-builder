import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutionProvenance,
  IWorkflowExecutor,
} from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionStrategy } from "../../application/ports/interfaces/IWorkflowExecutionStrategy";
import type { IWorkflowRuntimeSelector } from "../../application/ports/interfaces/IWorkflowRuntimeSelector";
import { WorkflowRuntimeSelector } from "../../application/execution/WorkflowRuntimeSelector";
import {
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
} from "../../application/ports/WorkflowExecutor";

export interface TruthfulWorkflowExecutorOptions {
  readonly strategies: ReadonlyArray<IWorkflowExecutionStrategy>;
  readonly selector?: IWorkflowRuntimeSelector;
}

export class TruthfulWorkflowExecutor implements IWorkflowExecutor {
  private readonly strategies: ReadonlyArray<IWorkflowExecutionStrategy>;
  private readonly selector: IWorkflowRuntimeSelector;

  constructor(options: TruthfulWorkflowExecutorOptions) {
    this.strategies = Object.freeze([...options.strategies]);
    this.selector = options.selector ?? new WorkflowRuntimeSelector();
  }

  public async startExecution(input: IWorkflowExecutionInput): Promise<IWorkflowExecutionHandle> {
    const selection = this.selector.selectStrategy(input, this.strategies);
    const executionId = `${selection.strategy.getDescriptor().id}-${input.workflow.id}-${Date.now()}`;
    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();

    const completionPromise = this.execute(input, (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    }).then((result) => new WorkflowExecutionResult({
      executionId: result.executionId || executionId,
      status: result.status,
      outputAssets: result.outputAssets,
      messages: result.messages,
      errorMessage: result.errorMessage,
      provenance: result.provenance,
    }));

    return new WorkflowExecutionHandle({
      executionId,
      input,
      initialProgress: new WorkflowExecutionProgress({
        executionId,
        status: "queued",
        percent: 0,
        message: `Queued ${selection.strategy.getDescriptor().id}.`,
      }),
      completionPromise,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void,
  ): Promise<IWorkflowExecutionResult> {
    const selection = this.selector.selectStrategy(input, this.strategies);
    const result = await selection.strategy.execute(input, onEvent);
    const descriptor = selection.strategy.getDescriptor();
    const provenance: IWorkflowExecutionProvenance = result.provenance ?? {
      classification: descriptor.defaultProvenance,
      runtime: descriptor.runtime,
      strategyId: descriptor.id,
      detail: `${descriptor.mode} execution via ${descriptor.id}.`,
      selectionReason: selection.reason,
    };

    return new WorkflowExecutionResult({
      executionId: result.executionId,
      status: result.status,
      outputAssets: result.outputAssets,
      messages: result.messages,
      errorMessage: result.errorMessage,
      provenance,
    });
  }

  public canExecute(input: IWorkflowExecutionInput): boolean {
    return this.strategies.some((strategy) => strategy.canHandle(input));
  }
}

import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "@application/ports/interfaces/IWorkflowExecutor";
import {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
} from "@application/ports/WorkflowExecutor";

export interface IPreviewWorkflowExecutorOptions {
  readonly startDelayMs?: number;
  readonly progressDelayMs?: number;
}

export class PreviewWorkflowExecutor implements IWorkflowExecutor {
  private readonly startDelayMs: number;
  private readonly progressDelayMs: number;

  constructor(options: IPreviewWorkflowExecutorOptions = {}) {
    this.startDelayMs = options.startDelayMs ?? 250;
    this.progressDelayMs = options.progressDelayMs ?? 250;
  }

  public async startExecution(
    input: IWorkflowExecutionInput
  ): Promise<IWorkflowExecutionHandle> {
    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();
    const executionId = `preview-exec-${Date.now()}`;
    let cancelled = false;

    const emit = (event: IWorkflowExecutionEvent): void => {
      for (const listener of listeners) {
        listener(event);
      }
    };

    const completionPromise = (async (): Promise<IWorkflowExecutionResult> => {
      emit(
        new WorkflowExecutionEvent({
          executionId,
          kind: "workflow-started",
          status: "running",
          progress: new WorkflowExecutionProgress({
            executionId,
            status: "running",
            percent: 10,
            message: "Starting workflow execution.",
          }),
          message: "Starting workflow execution.",
        })
      );

      await delay(this.startDelayMs);

      if (cancelled) {
        return new WorkflowExecutionResult({
          executionId,
          status: "cancelled",
          outputAssets: [],
          messages: ["Preview execution cancelled."],
          errorMessage: "Preview execution cancelled.",
        });
      }

      emit(
        new WorkflowExecutionEvent({
          executionId,
          kind: "workflow-progress",
          status: "running",
          progress: new WorkflowExecutionProgress({
            executionId,
            status: "running",
            percent: 70,
            message: "Executing workflow in preview mode.",
          }),
          message: "Executing workflow in preview mode.",
        })
      );

      await delay(this.progressDelayMs);

      if (cancelled) {
        return new WorkflowExecutionResult({
          executionId,
          status: "cancelled",
          outputAssets: [],
          messages: ["Preview execution cancelled."],
          errorMessage: "Preview execution cancelled.",
        });
      }

      const result = new WorkflowExecutionResult({
        executionId,
        status: "completed",
        outputAssets: [],
        messages: [
          "Preview execution completed.",
          "No real execution backend is configured for this runtime mode.",
        ],
      });

      emit(
        new WorkflowExecutionEvent({
          executionId,
          kind: "workflow-completed",
          status: "completed",
          progress: new WorkflowExecutionProgress({
            executionId,
            status: "completed",
            percent: 100,
            message: "Execution finished.",
          }),
          message: "Execution finished.",
        })
      );

      return result;
    })();

    return new WorkflowExecutionHandle({
      executionId,
      input,
      initialProgress: new WorkflowExecutionProgress({
        executionId,
        status: "queued",
        percent: 0,
        message: "Execution queued.",
      }),
      completionPromise,
      cancel: async () => {
        cancelled = true;
      },
      subscribe: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    });
  }

  public async execute(
    input: IWorkflowExecutionInput,
    onEvent?: (event: IWorkflowExecutionEvent) => void
  ): Promise<IWorkflowExecutionResult> {
    const handle = await this.startExecution(input);

    const unsubscribe = handle.subscribe
      ? await handle.subscribe(onEvent ?? (() => undefined))
      : undefined;

    try {
      return await handle.waitForCompletion();
    } finally {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }
  }

  public canExecute(_input: IWorkflowExecutionInput): boolean {
    return true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


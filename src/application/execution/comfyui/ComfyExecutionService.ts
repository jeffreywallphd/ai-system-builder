import {
  WorkflowExecutionEvent,
  WorkflowExecutionHandle,
  WorkflowExecutionProgress,
  WorkflowExecutionResult,
} from "../../ports/WorkflowExecutor";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionHandle,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
} from "../../ports/interfaces/IWorkflowExecutor";
import type {
  IComfyAdapterLifecycleEvent,
  IComfyAdapterRequest,
  IComfyAdapterResult,
  IComfyExecutionAdapter,
} from "./ComfyAdapterContract";
import type { IAsset } from "../../../domain/assets/interfaces/IAsset";

export interface IComfyExecutionServiceMappers {
  toAdapterRequest(input: IWorkflowExecutionInput): IComfyAdapterRequest;
  toWorkflowAssets(input: IWorkflowExecutionInput, result: IComfyAdapterResult): ReadonlyArray<IAsset>;
}

export class ComfyExecutionService {
  constructor(
    private readonly adapter: IComfyExecutionAdapter,
    private readonly mappers: IComfyExecutionServiceMappers,
  ) {}

  public async startExecution(input: IWorkflowExecutionInput): Promise<IWorkflowExecutionHandle> {
    const listeners = new Set<(event: IWorkflowExecutionEvent) => void>();
    let currentProgress = new WorkflowExecutionProgress({
      executionId: input.workflow.id,
      status: "queued",
      percent: 0,
      message: "Preparing ComfyUI execution.",
    });

    const started = await this.adapter.start(
      this.mappers.toAdapterRequest(input),
      (lifecycleEvent) => {
        const workflowEvent = toWorkflowExecutionEvent(lifecycleEvent);
        currentProgress = WorkflowExecutionProgress.from(workflowEvent.progress ?? currentProgress);

        for (const listener of listeners) {
          listener(workflowEvent);
        }
      },
    );

    const completionPromise = (async (): Promise<IWorkflowExecutionResult> => {
      const adapterResult = await started.waitForCompletion();
      const outputAssets = this.mappers.toWorkflowAssets(input, adapterResult);

      if (adapterResult.status === "completed") {
        for (const asset of outputAssets) {
          for (const listener of listeners) {
            listener(
              new WorkflowExecutionEvent({
                executionId: adapterResult.executionId,
                kind: "asset-produced",
                status: "completed",
                asset,
              }),
            );
          }
        }
      }

      return new WorkflowExecutionResult({
        executionId: adapterResult.executionId,
        status: adapterResult.status,
        outputAssets,
        messages: adapterResult.messages,
        errorMessage: adapterResult.error?.message,
        inspection: Object.freeze({
          summary: Object.freeze({
            runtime: this.adapter.capabilities.runtimeId,
            status: adapterResult.status,
            outputCount: adapterResult.outputs.length,
            lifecycleEventCount: adapterResult.lifecycle.length,
            messageCount: adapterResult.messages?.length,
            hasError: !!adapterResult.error,
          }),
          outputs: Object.freeze(adapterResult.outputs.map((output) => Object.freeze({
            nodeId: output.nodeId,
            kind: output.kind,
            reference: output.reference,
            assetId: output.assetRef?.assetId,
            metadata: output.metadata ? Object.freeze({ ...output.metadata }) : undefined,
          }))),
          diagnostics: adapterResult.error
            ? Object.freeze({
                errorCode: adapterResult.error.code,
                errorCategory: adapterResult.error.category,
                errorSeverity: adapterResult.error.severity,
                message: adapterResult.error.message,
                retriable: adapterResult.error.retryable,
                failureClass: typeof adapterResult.error.diagnostics?.failureClass === "string"
                  ? adapterResult.error.diagnostics.failureClass
                  : undefined,
                stage: typeof adapterResult.error.diagnostics?.stage === "string"
                  ? adapterResult.error.diagnostics.stage
                  : undefined,
                details: adapterResult.error.details,
              })
            : adapterResult.inspection?.diagnostics
              ? Object.freeze({ ...adapterResult.inspection.diagnostics })
              : undefined,
        }),
      });
    })();

    return new WorkflowExecutionHandle({
      executionId: started.executionId,
      input,
      initialProgress: currentProgress,
      completionPromise,
      cancel: started.cancel,
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
    const handle = await this.startExecution(input);
    const unsubscribe = onEvent && typeof handle.subscribe === "function"
      ? await handle.subscribe(onEvent)
      : undefined;

    try {
      return await handle.waitForCompletion();
    } finally {
      unsubscribe?.();
    }
  }
}

function toWorkflowExecutionEvent(
  lifecycleEvent: IComfyAdapterLifecycleEvent,
): IWorkflowExecutionEvent {
  return new WorkflowExecutionEvent({
    executionId: lifecycleEvent.executionId,
    kind: "workflow-progress",
    status: lifecycleEvent.status,
    progress: new WorkflowExecutionProgress({
      executionId: lifecycleEvent.executionId,
      status: lifecycleEvent.status,
      percent: lifecycleEvent.percent,
      message: lifecycleEvent.message,
    }),
    message: lifecycleEvent.message,
    payload: lifecycleEvent.queuePosition !== undefined
      ? { queuePosition: lifecycleEvent.queuePosition }
      : undefined,
  });
}

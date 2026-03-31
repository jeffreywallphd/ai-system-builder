import { ExecutionStatuses, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type { IExecutionEngineEvent } from "../../application/execution/ExecutionContracts";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
  IExecutionUnitRunHandle,
} from "../../application/execution/UnifiedExecutionEngine";
import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionInput,
  IWorkflowExecutionResult,
  IWorkflowExecutor,
} from "../../application/ports/interfaces/IWorkflowExecutor";
import type { ExecutionAssetLineageRecorder } from "../../application/assets-system/ExecutionAssetLineageRecorder";
import type { WorkflowRunHistoryService } from "../../application/workflow-run-history/WorkflowRunHistoryService";
import {
  createExecutionArtifact,
  toExecutionProvenance,
  WorkflowExecutionArtifacts,
} from "../../application/execution/WorkflowExecutionAdapter";


function toExecutionStatus(status: "completed" | "failed" | "cancelled"): IExecutionUnitExecutionResult["status"] {
  switch (status) {
    case "completed":
      return ExecutionStatuses.completed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "failed":
    default:
      return ExecutionStatuses.failed;
  }
}

function mapWorkflowEventStatus(status: string): typeof ExecutionStatuses[keyof typeof ExecutionStatuses] {
  switch (status) {
    case "running":
    case "preparing":
    case "validating":
      return ExecutionStatuses.running;
    case "completed":
      return ExecutionStatuses.completed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "failed":
      return ExecutionStatuses.failed;
    case "queued":
    default:
      return ExecutionStatuses.ready;
  }
}

function toUnitResult(unitId: string, workflowResult: IWorkflowExecutionResult): IExecutionUnitExecutionResult {
  return Object.freeze({
    unitId,
    status: toExecutionStatus(workflowResult.status),
    outputMetadata: Object.freeze({
      executionId: workflowResult.executionId,
      outputAssetCount: workflowResult.outputAssets.length,
      workflowStatus: workflowResult.status,
    }),
    outputSummary: Object.freeze({
      headline: workflowResult.status === "completed"
        ? "Workflow run completed"
        : workflowResult.status === "cancelled"
          ? "Workflow run cancelled"
          : "Workflow run failed",
      detail: workflowResult.errorMessage
        ?? workflowResult.messages?.[workflowResult.messages.length - 1]
        ?? (workflowResult.outputAssets.length > 0
          ? `${workflowResult.outputAssets.length} output asset${workflowResult.outputAssets.length === 1 ? "" : "s"} captured.`
          : "No output assets were captured."),
      metadata: Object.freeze({
        outputAssetCount: workflowResult.outputAssets.length,
        executionId: workflowResult.executionId,
      }),
    }),
    errorMessage: workflowResult.errorMessage,
    provenance: toExecutionProvenance(workflowResult.provenance),
    artifacts: Object.freeze([createExecutionArtifact(WorkflowExecutionArtifacts.workflowResult, workflowResult)]),
  });
}

function toExecutionEvent(
  request: IExecutionUnitExecutionRequest,
  workflowEvent: IWorkflowExecutionEvent,
): IExecutionEngineEvent {
  return Object.freeze({
    planId: request.plan.id,
    runId: request.runId,
    unitId: request.unit.id,
    status: mapWorkflowEventStatus(workflowEvent.status),
    message: workflowEvent.message,
    provenance: toExecutionProvenance(workflowEvent.provenance),
    detail: createExecutionArtifact(WorkflowExecutionArtifacts.workflowEvent, workflowEvent),
  });
}

export class WorkflowExecutionUnitHandler implements IExecutionUnitHandler {
  private readonly workflowExecutor: IWorkflowExecutor;

  constructor(
    workflowExecutor: IWorkflowExecutor,
    private readonly executionAssetLineageRecorder?: ExecutionAssetLineageRecorder,
    private readonly workflowRunHistoryService?: WorkflowRunHistoryService,
  ) {
    this.workflowExecutor = workflowExecutor;
  }

  public canHandle(request: IExecutionUnitExecutionRequest["unit"]): boolean {
    return request.kind === ExecutionUnitKinds.workflow;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionUnitExecutionResult> {
    const input = request.unitInputs?.[request.unit.id] as IWorkflowExecutionInput | undefined;

    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing workflow execution input.`);
    }

    await this.workflowRunHistoryService?.recordRunStarted({
      runId: request.runId,
      executionFlowId: this.resolveExecutionFlowId(input),
      input,
    });

    const workflowResult = await this.runWorkflowExecution(request, input, onEvent);

    await this.executionAssetLineageRecorder?.recordWorkflowExecution({
      input,
      result: workflowResult,
    });
    await this.workflowRunHistoryService?.recordRunCompleted({
      runId: request.runId,
      result: workflowResult,
    });

    return toUnitResult(request.unit.id, workflowResult);
  }

  public async startExecution(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IExecutionUnitRunHandle> {
    const input = request.unitInputs?.[request.unit.id] as IWorkflowExecutionInput | undefined;

    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing workflow execution input.`);
    }

    await this.workflowRunHistoryService?.recordRunStarted({
      runId: request.runId,
      executionFlowId: this.resolveExecutionFlowId(input),
      input,
    });

    const workflowHandle = await this.workflowExecutor.startExecution(input);

    return Object.freeze({
      unitId: request.unit.id,
      waitForCompletion: async () => {
        let workflowResult: IWorkflowExecutionResult;
        try {
          workflowResult = await workflowHandle.waitForCompletion();
        } catch (error) {
          await this.workflowRunHistoryService?.recordRunFailed({
            runId: request.runId,
            errorMessage: error instanceof Error ? error.message : "Workflow execution failed.",
          });
          throw error;
        }

        await this.executionAssetLineageRecorder?.recordWorkflowExecution({
          input,
          result: workflowResult,
        });
        await this.workflowRunHistoryService?.recordRunCompleted({
          runId: request.runId,
          result: workflowResult,
        });
        return toUnitResult(request.unit.id, workflowResult);
      },
      cancel: async () => {
        await workflowHandle.cancel();
      },
      subscribe: typeof workflowHandle.subscribe === "function"
        ? async (listener: (event: IExecutionEngineEvent) => void) => {
            const unsubscribe = await workflowHandle.subscribe?.((workflowEvent) => {
              listener(toExecutionEvent(request, workflowEvent));
            });
            return typeof unsubscribe === "function" ? unsubscribe : () => undefined;
          }
        : undefined,
    });
  }

  private async runWorkflowExecution(
    request: IExecutionUnitExecutionRequest,
    input: IWorkflowExecutionInput,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IWorkflowExecutionResult> {
    try {
      return await this.workflowExecutor.execute(input, (workflowEvent) => {
        onEvent?.(toExecutionEvent(request, workflowEvent));
      });
    } catch (error) {
      await this.workflowRunHistoryService?.recordRunFailed({
        runId: request.runId,
        errorMessage: error instanceof Error ? error.message : "Workflow execution failed.",
      });
      throw error;
    }
  }

  private resolveExecutionFlowId(input: IWorkflowExecutionInput): string | undefined {
    const fromParameters = typeof input.parameters?.executionFlowId === "string"
      ? input.parameters.executionFlowId
      : undefined;
    const fromMetadata = typeof input.executionMetadata?.executionFlowId === "string"
      ? input.executionMetadata.executionFlowId
      : undefined;
    return fromParameters ?? fromMetadata;
  }
}

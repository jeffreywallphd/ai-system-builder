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

  constructor(workflowExecutor: IWorkflowExecutor) {
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

    const workflowResult = await this.workflowExecutor.execute(input, (workflowEvent) => {
      onEvent?.(toExecutionEvent(request, workflowEvent));
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

    const workflowHandle = await this.workflowExecutor.startExecution(input);

    return Object.freeze({
      unitId: request.unit.id,
      waitForCompletion: async () => {
        const workflowResult = await workflowHandle.waitForCompletion();
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
}

import { ExecutionStatuses, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type {
  IExecutionEngineEvent,
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
} from "../../application/execution/UnifiedExecutionEngine";
import type {
  IWorkflowExecutionInput,
  IWorkflowExecutor,
} from "../../application/ports/interfaces/IWorkflowExecutor";

function toExecutionStatus(status: "completed" | "failed" | "cancelled"): IExecutionUnitExecutionResult["status"] {
  switch (status) {
    case "completed":
      return ExecutionStatuses.completed;
    case "cancelled":
      return ExecutionStatuses.skipped;
    case "failed":
    default:
      return ExecutionStatuses.failed;
  }
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
      onEvent?.({
        planId: request.plan.id,
        unitId: request.unit.id,
        status: mapWorkflowEventStatus(workflowEvent.status),
        message: workflowEvent.message,
        provenance: workflowEvent.provenance,
        workflowEvent,
      });
    });

    return Object.freeze({
      unitId: request.unit.id,
      status: toExecutionStatus(workflowResult.status),
      outputMetadata: Object.freeze({
        executionId: workflowResult.executionId,
        outputAssetCount: workflowResult.outputAssets.length,
      }),
      errorMessage: workflowResult.errorMessage,
      provenance: workflowResult.provenance,
      workflowResult,
    });
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
      return ExecutionStatuses.skipped;
    case "failed":
      return ExecutionStatuses.failed;
    case "queued":
    default:
      return ExecutionStatuses.ready;
  }
}

import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import { createUnifiedExecutionEngine } from "./createUnifiedExecutionEngine";

export function createWorkflowUnifiedExecutionEngine(
  workflowExecutor: IWorkflowExecutor,
  executionRunRepository?: IExecutionRunRepository,
) {
  return createUnifiedExecutionEngine({
    workflowExecutor,
    executionRunRepository,
  });
}

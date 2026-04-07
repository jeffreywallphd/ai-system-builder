import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import { createUnifiedExecutionInfrastructure } from "./createExecutionInfrastructure";

export function createWorkflowUnifiedExecutionEngine(
  workflowExecutor: IWorkflowExecutor,
  executionRunRepository?: IExecutionRunRepository,
) {
  return createUnifiedExecutionInfrastructure({
    workflowExecutor,
    executionRunRepository,
  });
}

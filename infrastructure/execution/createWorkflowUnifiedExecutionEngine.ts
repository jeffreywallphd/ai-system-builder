import { UnifiedExecutionEngine } from "../../application/execution/UnifiedExecutionEngine";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import { WorkflowExecutionUnitHandler } from "./WorkflowExecutionUnitHandler";

export function createWorkflowUnifiedExecutionEngine(
  workflowExecutor: IWorkflowExecutor,
): UnifiedExecutionEngine {
  return new UnifiedExecutionEngine([
    new WorkflowExecutionUnitHandler(workflowExecutor),
  ]);
}

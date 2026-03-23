import { ExecutionPlan, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type { IWorkflowExecutionInput, IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IExecutionPlanResult } from "./UnifiedExecutionEngine";

export interface IWorkflowExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
}

export function createWorkflowExecutionPlan(
  input: IWorkflowExecutionInput,
): IWorkflowExecutionPlanEnvelope {
  const unitId = `workflow:${input.workflow.id}`;

  return Object.freeze({
    unitId,
    plan: new ExecutionPlan({
      id: `workflow-run:${input.workflow.id}`,
      units: [
        {
          id: unitId,
          kind: ExecutionUnitKinds.workflow,
          label: input.workflow.metadata.name,
        },
      ],
    }),
    unitInputs: Object.freeze({
      [unitId]: input,
    }),
  });
}

export function requireWorkflowExecutionResult(
  planResult: IExecutionPlanResult,
  unitId: string,
): IWorkflowExecutionResult {
  const workflowResult = planResult.unitResults[unitId]?.workflowResult;

  if (!workflowResult) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a workflow execution result.`);
  }

  return workflowResult;
}

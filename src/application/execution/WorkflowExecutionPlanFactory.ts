import { ExecutionPlan, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { IWorkflowExecutionEvent, IWorkflowExecutionInput, IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { IExecutionEngineEvent } from "./ExecutionContracts";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getWorkflowExecutionEvent, getWorkflowExecutionResult } from "./WorkflowExecutionAdapter";
import { ExecutionRuntimeCapabilityProfiles, toExecutionRuntimeCapabilityMetadata } from "./ExecutionRuntimeCapabilities";

export interface IWorkflowExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
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
    metadata: Object.freeze({
      executionKind: "workflow",
      workflowId: input.workflow.id,
      workflowName: input.workflow.metadata.name,
      runtimeCapabilities: toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.workflow),
      ...toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.workflow),
    }),
  });
}

export function requireWorkflowExecutionResult(
  planResult: IExecutionPlanResult,
  unitId: string,
): IWorkflowExecutionResult {
  const workflowResult = getWorkflowExecutionResult(planResult.unitResults[unitId]);

  if (!workflowResult) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a workflow execution result.`);
  }

  return workflowResult;
}

export function requireWorkflowExecutionResultFromUnitResult(
  result: IExecutionUnitExecutionResult,
): IWorkflowExecutionResult {
  const workflowResult = getWorkflowExecutionResult(result);

  if (!workflowResult) {
    throw new Error(`Execution unit '${result.unitId}' did not produce a workflow execution result.`);
  }

  return workflowResult;
}

export function getWorkflowExecutionEventFromEngineEvent(
  event: IExecutionEngineEvent,
): IWorkflowExecutionEvent | undefined {
  return getWorkflowExecutionEvent(event);
}


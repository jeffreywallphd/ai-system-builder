import type {
  IWorkflowExecutionEvent,
  IWorkflowExecutionProvenance,
  IWorkflowExecutionResult,
} from "../ports/interfaces/IWorkflowExecutor";
import type {
  IExecutionArtifact,
  IExecutionEngineEvent,
  IExecutionProvenance,
} from "./ExecutionContracts";
import type { IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";

export const WorkflowExecutionArtifacts = Object.freeze({
  workflowEvent: "workflow-event",
  workflowResult: "workflow-result",
});

export function toExecutionProvenance(
  provenance?: IWorkflowExecutionProvenance,
): IExecutionProvenance | undefined {
  return provenance
    ? Object.freeze({
        classification: provenance.classification,
        runtime: provenance.runtime,
        executorId: provenance.strategyId,
        detail: provenance.detail,
        selectionReason: provenance.selectionReason,
        fallback: provenance.fallback ? Object.freeze({ ...provenance.fallback }) : undefined,
        metadata: Object.freeze({
          nodeCounts: provenance.nodeCounts ? { ...provenance.nodeCounts } : undefined,
          mcp: provenance.mcp ? { ...provenance.mcp } : undefined,
          nodeProvenance: provenance.nodeProvenance ? { ...provenance.nodeProvenance } : undefined,
        }),
        sourceKind: "workflow",
      })
    : undefined;
}

export function createExecutionArtifact<TValue>(kind: string, value: TValue): IExecutionArtifact<TValue> {
  return Object.freeze({ kind, value });
}

export function getWorkflowExecutionArtifact<TValue>(
  artifacts: ReadonlyArray<IExecutionArtifact> | undefined,
  kind: string,
): TValue | undefined {
  return artifacts?.find((artifact) => artifact.kind === kind)?.value as TValue | undefined;
}

export function getWorkflowExecutionEvent(
  event: IExecutionEngineEvent,
): IWorkflowExecutionEvent | undefined {
  return event.detail?.kind === WorkflowExecutionArtifacts.workflowEvent
    ? (event.detail.value as IWorkflowExecutionEvent)
    : undefined;
}

export function getWorkflowExecutionResult(
  result: IExecutionUnitExecutionResult | undefined,
): IWorkflowExecutionResult | undefined {
  return result
    ? getWorkflowExecutionArtifact<IWorkflowExecutionResult>(result.artifacts, WorkflowExecutionArtifacts.workflowResult)
    : undefined;
}

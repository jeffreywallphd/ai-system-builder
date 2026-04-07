import type { ExecutionUnitKind } from "../../domain/execution/ExecutionPlan";
import type { IExecutionRunProvenance, IExecutionRunRecord } from "../../domain/execution/ExecutionRun";

export interface IExecutionRunQueryIndex {
  readonly executionKind?: string;
  readonly primaryUnitKind?: ExecutionUnitKind;
  readonly primaryProvenanceClassification?: IExecutionRunProvenance["classification"];
  readonly primaryExecutorId?: string;
  readonly primaryRuntime?: string;
  readonly executionFlowId?: string;
  readonly supportsCancellation?: boolean;
  readonly supportsProgressEvents?: boolean;
  readonly supportsPollingProgress?: boolean;
  readonly supportsMultiUnitComposition?: boolean;
}

export function deriveExecutionRunQueryIndex(run: IExecutionRunRecord): IExecutionRunQueryIndex {
  const primaryUnit = run.unitIds[0] ? run.units[run.unitIds[0]] : undefined;
  const primaryProvenance = primaryUnit?.provenance ?? findFirstProvenance(run);

  return Object.freeze({
    executionKind: typeof run.metadata?.executionKind === "string" ? run.metadata.executionKind : undefined,
    primaryUnitKind: primaryUnit?.kind,
    primaryProvenanceClassification: primaryProvenance?.classification,
    primaryExecutorId: primaryProvenance?.executorId,
    primaryRuntime: primaryProvenance?.runtime,
    executionFlowId: typeof run.metadata?.executionFlowId === "string" ? run.metadata.executionFlowId : undefined,
    supportsCancellation: run.metadata?.supportsCancellation === true || run.cancellationSupported,
    supportsProgressEvents: run.metadata?.supportsProgressEvents === true,
    supportsPollingProgress: run.metadata?.supportsPollingProgress === true,
    supportsMultiUnitComposition: run.metadata?.supportsMultiUnitComposition === true,
  });
}

function findFirstProvenance(run: IExecutionRunRecord): IExecutionRunProvenance | undefined {
  for (const unitId of run.unitIds) {
    const provenance = run.units[unitId]?.provenance;
    if (provenance) {
      return provenance;
    }
  }
  return undefined;
}

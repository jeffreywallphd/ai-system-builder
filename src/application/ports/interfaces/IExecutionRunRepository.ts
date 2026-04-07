import type { ExecutionStatus, ExecutionUnitKind } from "@domain/execution/ExecutionPlan";
import type { IExecutionRunProvenance } from "@domain/execution/ExecutionRun";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";

export interface IExecutionRunRepositoryListCriteria {
  readonly planId?: string;
  readonly status?: ExecutionStatus;
  readonly executionKind?: string;
  readonly unitKind?: ExecutionUnitKind;
  readonly provenanceClassification?: IExecutionRunProvenance["classification"];
  readonly startedAfter?: string;
  readonly startedBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly flowId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  readonly limit?: number;
}

export interface IExecutionRunRepository {
  saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord>;
  getRunById(runId: string): Promise<IExecutionRunRecord | undefined>;
  listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>>;
}


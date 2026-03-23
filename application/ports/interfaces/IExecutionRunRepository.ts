import type { ExecutionStatus } from "../../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";

export interface IExecutionRunRepositoryListCriteria {
  readonly planId?: string;
  readonly status?: ExecutionStatus;
  readonly executionKind?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  readonly limit?: number;
}

export interface IExecutionRunRepository {
  saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord>;
  getRunById(runId: string): Promise<IExecutionRunRecord | undefined>;
  listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>>;
}

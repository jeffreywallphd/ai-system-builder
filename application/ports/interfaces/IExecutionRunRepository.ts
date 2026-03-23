import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";

export interface IExecutionRunRepositoryListCriteria {
  readonly planId?: string;
  readonly limit?: number;
}

export interface IExecutionRunRepository {
  saveRun(run: IExecutionRunRecord): Promise<IExecutionRunRecord>;
  getRunById(runId: string): Promise<IExecutionRunRecord | undefined>;
  listRuns(criteria?: IExecutionRunRepositoryListCriteria): Promise<ReadonlyArray<IExecutionRunRecord>>;
}

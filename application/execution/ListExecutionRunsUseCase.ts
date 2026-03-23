import type { ExecutionStatus } from "../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../domain/execution/ExecutionRun";
import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";

export interface IListExecutionRunsQuery {
  readonly planId?: string;
  readonly status?: ExecutionStatus;
  readonly executionKind?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  readonly limit?: number;
}

export class ListExecutionRunsUseCase {
  constructor(private readonly executionRunRepository: IExecutionRunRepository) {}

  public async execute(query: IListExecutionRunsQuery = {}): Promise<ReadonlyArray<IExecutionRunRecord>> {
    return this.executionRunRepository.listRuns({
      planId: query.planId,
      status: query.status,
      executionKind: query.executionKind,
      metadata: query.metadata,
      limit: query.limit,
    });
  }
}

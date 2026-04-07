import type { ExecutionStatus, ExecutionUnitKind } from "@domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";
import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunProvenance } from "@domain/execution/ExecutionRun";

export interface IListExecutionRunsQuery {
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

export class ListExecutionRunsUseCase {
  constructor(private readonly executionRunRepository: IExecutionRunRepository) {}

  public async execute(query: IListExecutionRunsQuery = {}): Promise<ReadonlyArray<IExecutionRunRecord>> {
    return this.executionRunRepository.listRuns({
      planId: query.planId,
      status: query.status,
      executionKind: query.executionKind,
      unitKind: query.unitKind,
      provenanceClassification: query.provenanceClassification,
      startedAfter: query.startedAfter,
      startedBefore: query.startedBefore,
      updatedAfter: query.updatedAfter,
      updatedBefore: query.updatedBefore,
      flowId: query.flowId,
      metadata: query.metadata,
      limit: query.limit,
    });
  }
}


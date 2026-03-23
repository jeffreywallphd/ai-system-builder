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
    const runs = await this.executionRunRepository.listRuns({ planId: query.planId, limit: undefined });
    const filtered = runs
      .filter((run) => !query.status || run.status === query.status)
      .filter((run) => !query.executionKind || run.metadata?.executionKind === query.executionKind)
      .filter((run) => this.matchesMetadata(run, query.metadata));

    return Object.freeze(query.limit ? filtered.slice(0, query.limit) : filtered);
  }

  private matchesMetadata(
    run: IExecutionRunRecord,
    metadata?: Readonly<Record<string, string | number | boolean>>,
  ): boolean {
    if (!metadata) {
      return true;
    }

    return Object.entries(metadata).every(([key, value]) => run.metadata?.[key] === value);
  }
}

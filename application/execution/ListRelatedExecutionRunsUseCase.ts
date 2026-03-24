import type { IExecutionRunRecord } from "../../domain/execution/ExecutionRun";
import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";

export interface IListRelatedExecutionRunsQuery {
  readonly runId: string;
  readonly limit?: number;
}

export class ListRelatedExecutionRunsUseCase {
  constructor(private readonly executionRunRepository: IExecutionRunRepository) {}

  public async execute(query: IListRelatedExecutionRunsQuery): Promise<ReadonlyArray<IExecutionRunRecord>> {
    const runId = query.runId.trim();
    if (!runId) {
      return Object.freeze([]);
    }

    const anchorRun = await this.executionRunRepository.getRunById(runId);
    if (!anchorRun) {
      return Object.freeze([]);
    }

    const flowId = typeof anchorRun.metadata?.executionFlowId === "string"
      ? anchorRun.metadata.executionFlowId
      : undefined;

    if (flowId) {
      return this.executionRunRepository.listRuns({
        flowId,
        limit: query.limit,
      });
    }

    return this.executionRunRepository.listRuns({
      planId: anchorRun.planId,
      limit: query.limit,
    });
  }
}

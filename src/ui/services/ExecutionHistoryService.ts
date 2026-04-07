import type { ExecutionRunDetailProjection } from "@application/execution/ExecutionRunDetailProjectionService";
import { GetExecutionRunDetailUseCase } from "@application/execution/GetExecutionRunDetailUseCase";
import {
  ExecutionRelatedRunClusterProjectionService,
  type ExecutionRelatedRunClusterProjection,
} from "@application/execution/ExecutionRelatedRunClusterProjectionService";
import { ExecutionRunProjectionService, type ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import { ListExecutionRunsUseCase, type IListExecutionRunsQuery } from "@application/execution/ListExecutionRunsUseCase";
import { ListRelatedExecutionRunsUseCase } from "@application/execution/ListRelatedExecutionRunsUseCase";

export class ExecutionHistoryService {
  constructor(
    private readonly listExecutionRunsUseCase: ListExecutionRunsUseCase,
    private readonly projectionService: ExecutionRunProjectionService,
    private readonly listRelatedExecutionRunsUseCase?: ListRelatedExecutionRunsUseCase,
    private readonly getExecutionRunDetailUseCase?: GetExecutionRunDetailUseCase,
    private readonly relatedRunClusterProjectionService: ExecutionRelatedRunClusterProjectionService = new ExecutionRelatedRunClusterProjectionService(),
  ) {}

  public async listHistory(query: IListExecutionRunsQuery = {}): Promise<ReadonlyArray<ExecutionRunProjection>> {
    const runs = await this.listExecutionRunsUseCase.execute(query);
    return this.projectionService.projectMany(runs);
  }

  public async getRunDetail(runId: string): Promise<ExecutionRunDetailProjection | undefined> {
    return this.getExecutionRunDetailUseCase?.execute(runId);
  }

  public async listRelatedRuns(runId: string, limit = 20): Promise<ReadonlyArray<ExecutionRunProjection>> {
    if (!this.listRelatedExecutionRunsUseCase) {
      return Object.freeze([]);
    }
    const runs = await this.listRelatedExecutionRunsUseCase.execute({ runId, limit });
    return this.projectionService.projectMany(runs);
  }

  public async getRelatedRunCluster(
    runId: string,
    limit = 20,
  ): Promise<ExecutionRelatedRunClusterProjection | undefined> {
    const relatedRuns = await this.listRelatedRuns(runId, limit);
    if (relatedRuns.length === 0) {
      return undefined;
    }
    return this.relatedRunClusterProjectionService.project(runId, relatedRuns);
  }
}


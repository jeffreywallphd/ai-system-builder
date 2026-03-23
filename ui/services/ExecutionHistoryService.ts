import type { ExecutionRunDetailProjection } from "../../application/execution/ExecutionRunDetailProjectionService";
import { GetExecutionRunDetailUseCase } from "../../application/execution/GetExecutionRunDetailUseCase";
import { ExecutionRunProjectionService, type ExecutionRunProjection } from "../../application/execution/ExecutionRunProjectionService";
import { ListExecutionRunsUseCase, type IListExecutionRunsQuery } from "../../application/execution/ListExecutionRunsUseCase";

export class ExecutionHistoryService {
  constructor(
    private readonly listExecutionRunsUseCase: ListExecutionRunsUseCase,
    private readonly projectionService: ExecutionRunProjectionService,
    private readonly getExecutionRunDetailUseCase?: GetExecutionRunDetailUseCase,
  ) {}

  public async listHistory(query: IListExecutionRunsQuery = {}): Promise<ReadonlyArray<ExecutionRunProjection>> {
    const runs = await this.listExecutionRunsUseCase.execute(query);
    return this.projectionService.projectMany(runs);
  }

  public async getRunDetail(runId: string): Promise<ExecutionRunDetailProjection | undefined> {
    return this.getExecutionRunDetailUseCase?.execute(runId);
  }
}

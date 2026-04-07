import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";
import { ExecutionRunDetailProjectionService, type ExecutionRunDetailProjection } from "./ExecutionRunDetailProjectionService";

export class GetExecutionRunDetailUseCase {
  constructor(
    private readonly executionRunRepository: IExecutionRunRepository,
    private readonly projectionService: ExecutionRunDetailProjectionService,
  ) {}

  public async execute(runId: string): Promise<ExecutionRunDetailProjection | undefined> {
    const run = await this.executionRunRepository.getRunById(runId);
    return run ? this.projectionService.project(run) : undefined;
  }
}

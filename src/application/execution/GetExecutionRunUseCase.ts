import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";

export class GetExecutionRunUseCase {
  constructor(private readonly executionRunRepository: IExecutionRunRepository) {}

  public async execute(runId: string): Promise<IExecutionRunRecord | undefined> {
    return this.executionRunRepository.getRunById(runId.trim());
  }
}


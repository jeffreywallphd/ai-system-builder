import type { WorkflowRunDetailRecord } from "@domain/workflow-studio/WorkflowRunHistoryDomain";
import type { IWorkflowRunSummaryRepository } from "../ports/interfaces/IWorkflowRunSummaryRepository";
import { toWorkflowRunHistoryError } from "./WorkflowRunHistoryErrors";

export class GetWorkflowRunDetailUseCase {
  constructor(private readonly repository: IWorkflowRunSummaryRepository) {}

  public async execute(runId: string): Promise<WorkflowRunDetailRecord | undefined> {
    try {
      const normalizedRunId = runId.trim();
      if (!normalizedRunId) {
        return undefined;
      }
      return await this.repository.getDetailByRunId(normalizedRunId);
    } catch (error) {
      throw toWorkflowRunHistoryError("get-detail", error);
    }
  }
}


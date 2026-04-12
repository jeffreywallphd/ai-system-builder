import type {
  WorkflowRunSummaryListQuery,
  WorkflowRunSummaryRecord,
} from "@domain/workflow-studio/WorkflowRunHistoryDomain";
import type { IWorkflowRunSummaryRepository } from "../ports/interfaces/IWorkflowRunSummaryRepository";
import { toWorkflowRunHistoryError } from "./WorkflowRunHistoryErrors";

export class ListWorkflowRunSummariesUseCase {
  constructor(private readonly repository: IWorkflowRunSummaryRepository) {}

  public async execute(query?: WorkflowRunSummaryListQuery): Promise<ReadonlyArray<WorkflowRunSummaryRecord>> {
    try {
      return await this.repository.list(query);
    } catch (error) {
      throw toWorkflowRunHistoryError("list-summaries", error);
    }
  }
}


import type { PersistedWorkflowSummary } from "@domain/workflow-studio/WorkflowPersistenceDomain";
import type {
  IWorkflowPersistenceRepository,
  WorkflowPersistenceListQuery,
} from "../ports/interfaces/IWorkflowPersistenceRepository";
import { toWorkflowPersistenceFailureError } from "./WorkflowPersistenceErrors";

export class ListPersistedWorkflowsUseCase {
  constructor(private readonly repository: IWorkflowPersistenceRepository) {}

  public async execute(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    try {
      return await this.repository.list(query);
    } catch (error) {
      throw toWorkflowPersistenceFailureError("list:query", error);
    }
  }
}


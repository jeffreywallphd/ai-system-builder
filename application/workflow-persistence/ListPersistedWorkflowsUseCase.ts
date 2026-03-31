import type { PersistedWorkflowSummary } from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import type {
  IWorkflowPersistenceRepository,
  WorkflowPersistenceListQuery,
} from "../ports/interfaces/IWorkflowPersistenceRepository";

export class ListPersistedWorkflowsUseCase {
  constructor(private readonly repository: IWorkflowPersistenceRepository) {}

  public async execute(query?: WorkflowPersistenceListQuery): Promise<ReadonlyArray<PersistedWorkflowSummary>> {
    return this.repository.list(query);
  }
}

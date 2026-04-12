import type { PersistedWorkflowRecord } from "@domain/workflow-studio/WorkflowPersistenceDomain";
import type { IWorkflowPersistenceRepository } from "../ports/interfaces/IWorkflowPersistenceRepository";
import { toWorkflowPersistenceFailureError } from "./WorkflowPersistenceErrors";
import { normalizeRequired } from "./WorkflowPersistenceValidation";

export class GetPersistedWorkflowUseCase {
  constructor(private readonly repository: IWorkflowPersistenceRepository) {}

  public async execute(id: string): Promise<PersistedWorkflowRecord | undefined> {
    const normalizedId = normalizeRequired(id, "Persisted workflow id");
    try {
      return await this.repository.getById(normalizedId);
    } catch (error) {
      throw toWorkflowPersistenceFailureError("get:load-by-id", error);
    }
  }
}


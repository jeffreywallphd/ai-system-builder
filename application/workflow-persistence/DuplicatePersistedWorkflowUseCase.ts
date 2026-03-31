import {
  createPersistedWorkflowRecord,
  type PersistedWorkflowRecord,
  type WorkflowPersistenceOwnershipContext,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import { WorkflowLifecycleStates } from "../../domain/workflow-studio/WorkflowStudioDomain";
import type { IWorkflowPersistenceRepository } from "../ports/interfaces/IWorkflowPersistenceRepository";
import {
  WorkflowPersistenceConflictError,
  WorkflowPersistenceNotFoundError,
} from "./WorkflowPersistenceErrors";
import { normalizeRequired } from "./WorkflowPersistenceValidation";

export interface DuplicatePersistedWorkflowRequest {
  readonly sourceWorkflowId: string;
  readonly duplicatedWorkflowId: string;
  readonly duplicatedWorkflowName?: string;
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly versionLabel?: string;
}

export class DuplicatePersistedWorkflowUseCase {
  constructor(
    private readonly repository: IWorkflowPersistenceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async execute(request: DuplicatePersistedWorkflowRequest): Promise<PersistedWorkflowRecord> {
    const sourceWorkflowId = normalizeRequired(request.sourceWorkflowId, "Source workflow id");
    const duplicatedWorkflowId = normalizeRequired(request.duplicatedWorkflowId, "Duplicated workflow id");
    const source = await this.repository.getById(sourceWorkflowId);
    if (!source) {
      throw new WorkflowPersistenceNotFoundError(sourceWorkflowId);
    }

    const existing = await this.repository.getById(duplicatedWorkflowId);
    if (existing) {
      throw new WorkflowPersistenceConflictError(duplicatedWorkflowId);
    }

    const duplicate = createPersistedWorkflowRecord({
      id: duplicatedWorkflowId,
      name: request.duplicatedWorkflowName?.trim() || `${source.name} Copy`,
      draft: source.definition.draft,
      metadata: source.metadata,
      lifecycleState: WorkflowLifecycleStates.draft,
      ownershipContext: request.ownershipContext ?? source.ownershipContext,
      versionLabel: request.versionLabel ?? source.revision.versionLabel,
      duplicatedFromWorkflowId: source.id,
      now: this.now(),
    });

    return this.repository.duplicate(source.id, duplicate);
  }
}

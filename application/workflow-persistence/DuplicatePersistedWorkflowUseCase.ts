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
  readonly duplicatedWorkflowId?: string;
  readonly duplicatedWorkflowName?: string;
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly versionLabel?: string;
}

export class DuplicatePersistedWorkflowUseCase {
  constructor(
    private readonly repository: IWorkflowPersistenceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async resolveDuplicatedWorkflowId(
    sourceWorkflowId: string,
    requestedWorkflowId?: string,
  ): Promise<string> {
    const explicitId = requestedWorkflowId?.trim();
    if (explicitId) {
      if (explicitId === sourceWorkflowId) {
        throw new WorkflowPersistenceConflictError(explicitId);
      }
      return explicitId;
    }

    const baseCopyId = `${sourceWorkflowId}:copy`;
    const first = await this.repository.getById(baseCopyId);
    if (!first) {
      return baseCopyId;
    }

    let attempt = 2;
    while (attempt < 10_000) {
      const candidate = `${sourceWorkflowId}:copy-${attempt}`;
      const existing = await this.repository.getById(candidate);
      if (!existing) {
        return candidate;
      }
      attempt += 1;
    }

    throw new WorkflowPersistenceConflictError(sourceWorkflowId);
  }

  public async execute(request: DuplicatePersistedWorkflowRequest): Promise<PersistedWorkflowRecord> {
    const sourceWorkflowId = normalizeRequired(request.sourceWorkflowId, "Source workflow id");
    const source = await this.repository.getById(sourceWorkflowId);
    if (!source) {
      throw new WorkflowPersistenceNotFoundError(sourceWorkflowId);
    }

    const duplicatedWorkflowId = await this.resolveDuplicatedWorkflowId(sourceWorkflowId, request.duplicatedWorkflowId);
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
      versionLabel: request.versionLabel,
      duplicatedFromWorkflowId: source.id,
      now: this.now(),
    });

    return this.repository.duplicate(source.id, duplicate);
  }
}

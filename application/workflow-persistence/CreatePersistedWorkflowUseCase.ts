import type { WorkflowEntityMetadata, WorkflowLifecycleState } from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createPersistedWorkflowRecord,
  type PersistedWorkflowRecord,
  type WorkflowPersistenceOwnershipContext,
} from "../../domain/workflow-studio/WorkflowPersistenceDomain";
import type { IWorkflowPersistenceRepository } from "../ports/interfaces/IWorkflowPersistenceRepository";
import { WorkflowPersistenceConflictError, toWorkflowPersistenceFailureError } from "./WorkflowPersistenceErrors";
import { assertWorkflowDraftValid, normalizeRequired } from "./WorkflowPersistenceValidation";
import type { WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";

export interface CreatePersistedWorkflowRequest {
  readonly id: string;
  readonly name: string;
  readonly draft: WorkflowDraft;
  readonly metadata?: WorkflowEntityMetadata;
  readonly lifecycleState?: WorkflowLifecycleState;
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly versionLabel?: string;
}

export class CreatePersistedWorkflowUseCase {
  constructor(
    private readonly repository: IWorkflowPersistenceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async execute(request: CreatePersistedWorkflowRequest): Promise<PersistedWorkflowRecord> {
    const id = normalizeRequired(request.id, "Persisted workflow id");
    const name = normalizeRequired(request.name, "Persisted workflow name");
    assertWorkflowDraftValid(request.draft, "Persisted workflow creation");

    const existing = await this.tryRepository("create:lookup-existing", () => this.repository.getById(id));
    if (existing) {
      throw new WorkflowPersistenceConflictError(id);
    }

    const created = createPersistedWorkflowRecord({
      id,
      name,
      draft: request.draft,
      metadata: request.metadata,
      lifecycleState: request.lifecycleState,
      ownershipContext: request.ownershipContext,
      versionLabel: request.versionLabel,
      now: this.now(),
    });
    return this.tryRepository("create:write-record", () => this.repository.create(created));
  }

  private async tryRepository<T>(operationLabel: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toWorkflowPersistenceFailureError(operationLabel, error);
    }
  }
}

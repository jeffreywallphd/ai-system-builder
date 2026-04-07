import type {
  WorkflowDraft,
  WorkflowEntity,
  WorkflowEntityMetadata,
  WorkflowLifecycleState,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { transitionWorkflowEntityLifecycle } from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  createPersistedWorkflowRecord,
  type PersistedWorkflowRecord,
  type WorkflowPersistenceOwnershipContext,
} from "@domain/workflow-studio/WorkflowPersistenceDomain";
import type { IWorkflowPersistenceRepository } from "../ports/interfaces/IWorkflowPersistenceRepository";
import {
  WorkflowPersistenceConflictError,
  WorkflowPersistenceInvalidRequestError,
  WorkflowPersistenceNotFoundError,
  toWorkflowPersistenceFailureError,
} from "./WorkflowPersistenceErrors";
import { assertWorkflowDraftValid, normalizeRequired } from "./WorkflowPersistenceValidation";

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = tag.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

export interface UpdatePersistedWorkflowRequest {
  readonly id: string;
  readonly changes: {
    readonly name?: string;
    readonly metadata?: WorkflowEntityMetadata;
    readonly draft?: WorkflowDraft;
    readonly lifecycleState?: WorkflowLifecycleState;
    readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
    readonly versionLabel?: string;
    readonly expectedPersistenceRevision?: number;
  };
}

export class UpdatePersistedWorkflowUseCase {
  constructor(
    private readonly repository: IWorkflowPersistenceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async execute(request: UpdatePersistedWorkflowRequest): Promise<PersistedWorkflowRecord> {
    const id = normalizeRequired(request.id, "Persisted workflow id");
    const current = await this.tryRepository("update:load-existing", () => this.repository.getById(id));
    if (!current) {
      throw new WorkflowPersistenceNotFoundError(id);
    }

    if (request.changes.draft) {
      assertWorkflowDraftValid(request.changes.draft, "Persisted workflow update");
    }
    if (request.changes.name !== undefined && !request.changes.name.trim()) {
      throw new WorkflowPersistenceInvalidRequestError("Persisted workflow name cannot be empty when provided.");
    }
    if (request.changes.expectedPersistenceRevision !== undefined) {
      if (
        !Number.isInteger(request.changes.expectedPersistenceRevision)
        || request.changes.expectedPersistenceRevision < 1
      ) {
        throw new WorkflowPersistenceInvalidRequestError(
          "Expected persisted workflow revision must be a positive integer when provided.",
        );
      }
      if (current.revision.persistenceRevision !== request.changes.expectedPersistenceRevision) {
        throw new WorkflowPersistenceConflictError(
          id,
          `Persisted workflow '${id}' is stale and cannot be updated. Expected revision ${request.changes.expectedPersistenceRevision}, current revision is ${current.revision.persistenceRevision}.`,
        );
      }
    }

    const now = this.now();
    const nowIso = now.toISOString();
    let definition: WorkflowEntity = Object.freeze({
      ...current.definition,
      name: request.changes.name?.trim() || current.definition.name,
      metadata: request.changes.metadata
        ? Object.freeze({
            summary: request.changes.metadata.summary?.trim() || undefined,
            tags: normalizeTags(request.changes.metadata.tags),
          })
        : current.definition.metadata,
      draft: request.changes.draft ?? current.definition.draft,
      draftRevision: request.changes.draft ? current.definition.draftRevision + 1 : current.definition.draftRevision,
      updatedAt: nowIso,
    });

    if (request.changes.lifecycleState && request.changes.lifecycleState !== definition.lifecycleState) {
      definition = transitionWorkflowEntityLifecycle(definition, request.changes.lifecycleState, now);
    }

    const updated = createPersistedWorkflowRecord({
      id: definition.id,
      name: definition.name,
      draft: definition.draft,
      metadata: definition.metadata,
      lifecycleState: definition.lifecycleState,
      ownershipContext: request.changes.ownershipContext ?? current.ownershipContext,
      versionLabel: request.changes.versionLabel ?? current.revision.versionLabel,
      duplicatedFromWorkflowId: current.revision.duplicatedFromWorkflowId,
      persistenceRevision: current.revision.persistenceRevision + 1,
      now: new Date(definition.createdAt),
    });

    const record: PersistedWorkflowRecord = Object.freeze({
      ...updated,
      definition: Object.freeze({
        ...definition,
        createdAt: current.definition.createdAt,
        updatedAt: definition.updatedAt,
      }),
      timestamps: Object.freeze({
        createdAt: current.timestamps.createdAt,
        updatedAt: definition.updatedAt,
        savedAt: updated.status === "saved" ? definition.updatedAt : undefined,
      }),
      revision: Object.freeze({
        ...updated.revision,
        workflowRevision: definition.draftRevision,
      }),
    });

    return this.tryRepository("update:write-record", () => this.repository.update(record));
  }

  private async tryRepository<T>(operationLabel: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toWorkflowPersistenceFailureError(operationLabel, error);
    }
  }
}


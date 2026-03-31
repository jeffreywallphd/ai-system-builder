import {
  createWorkflowEntity,
  type WorkflowDraft,
  type WorkflowEntity,
  type WorkflowEntityMetadata,
  type WorkflowLifecycleState,
  WorkflowLifecycleStates,
} from "./WorkflowStudioDomain";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

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

function normalizeOwnershipContext(
  ownershipContext?: WorkflowPersistenceOwnershipContext,
): WorkflowPersistenceOwnershipContext | undefined {
  if (!ownershipContext) {
    return undefined;
  }

  const normalized: WorkflowPersistenceOwnershipContext = Object.freeze({
    ownerId: normalizeOptional(ownershipContext.ownerId),
    tenantId: normalizeOptional(ownershipContext.tenantId),
    studioId: normalizeOptional(ownershipContext.studioId),
    sessionId: normalizeOptional(ownershipContext.sessionId),
  });

  if (!normalized.ownerId && !normalized.tenantId && !normalized.studioId && !normalized.sessionId) {
    return undefined;
  }

  return normalized;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function determineStatus(lifecycleState: WorkflowLifecycleState): WorkflowPersistenceStatus {
  return lifecycleState === WorkflowLifecycleStates.draft
    ? WorkflowPersistenceStatuses.draft
    : WorkflowPersistenceStatuses.saved;
}

export const WorkflowPersistenceStatuses = Object.freeze({
  draft: "draft",
  saved: "saved",
});

export type WorkflowPersistenceStatus = typeof WorkflowPersistenceStatuses[keyof typeof WorkflowPersistenceStatuses];

export const WorkflowPersistencePayloadKinds = Object.freeze({
  workflowEntity: "workflow-entity",
});

export interface WorkflowPersistencePayloadReference {
  readonly kind: typeof WorkflowPersistencePayloadKinds.workflowEntity;
  readonly schemaVersion: "ai-loom.workflow-entity.v1";
}

export interface WorkflowPersistenceOwnershipContext {
  readonly ownerId?: string;
  readonly tenantId?: string;
  readonly studioId?: string;
  readonly sessionId?: string;
}

export interface WorkflowPersistenceRevisionMetadata {
  readonly persistenceRevision: number;
  readonly workflowRevision: number;
  readonly versionLabel?: string;
  readonly duplicatedFromWorkflowId?: string;
}

export interface WorkflowPersistenceTimestamps {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly savedAt?: string;
}

export interface PersistedWorkflowSummary {
  readonly id: string;
  readonly name: string;
  readonly metadata: WorkflowEntityMetadata;
  readonly status: WorkflowPersistenceStatus;
  readonly lifecycleState: WorkflowLifecycleState;
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly revision: WorkflowPersistenceRevisionMetadata;
  readonly timestamps: WorkflowPersistenceTimestamps;
}

export interface PersistedWorkflowRecord extends PersistedWorkflowSummary {
  readonly payload: WorkflowPersistencePayloadReference;
  readonly definition: WorkflowEntity;
}

export interface CreatePersistedWorkflowInput {
  readonly id: string;
  readonly name: string;
  readonly draft: WorkflowDraft;
  readonly metadata?: WorkflowEntityMetadata;
  readonly lifecycleState?: WorkflowLifecycleState;
  readonly ownershipContext?: WorkflowPersistenceOwnershipContext;
  readonly versionLabel?: string;
  readonly duplicatedFromWorkflowId?: string;
  readonly persistenceRevision?: number;
  readonly now?: Date;
}

export function createPersistedWorkflowRecord(input: CreatePersistedWorkflowInput): PersistedWorkflowRecord {
  const now = input.now ?? new Date();
  const workflowEntity = createWorkflowEntity({
    id: normalizeRequired(input.id, "Persisted workflow id"),
    name: normalizeRequired(input.name, "Persisted workflow name"),
    metadata: {
      summary: normalizeOptional(input.metadata?.summary),
      tags: normalizeTags(input.metadata?.tags),
    },
    draft: input.draft,
    lifecycleState: input.lifecycleState ?? WorkflowLifecycleStates.draft,
    now,
  });
  const persistenceRevision = input.persistenceRevision ?? 1;
  assertPositiveInteger(persistenceRevision, "Workflow persistence revision");

  const status = determineStatus(workflowEntity.lifecycleState);
  const timestamps = Object.freeze({
    createdAt: workflowEntity.createdAt,
    updatedAt: workflowEntity.updatedAt,
    savedAt: status === WorkflowPersistenceStatuses.saved ? workflowEntity.updatedAt : undefined,
  } satisfies WorkflowPersistenceTimestamps);
  const revision = Object.freeze({
    persistenceRevision,
    workflowRevision: workflowEntity.draftRevision,
    versionLabel: normalizeOptional(input.versionLabel),
    duplicatedFromWorkflowId: normalizeOptional(input.duplicatedFromWorkflowId),
  } satisfies WorkflowPersistenceRevisionMetadata);

  return Object.freeze({
    id: workflowEntity.id,
    name: workflowEntity.name,
    metadata: workflowEntity.metadata,
    status,
    lifecycleState: workflowEntity.lifecycleState,
    ownershipContext: normalizeOwnershipContext(input.ownershipContext),
    revision,
    timestamps,
    payload: Object.freeze({
      kind: WorkflowPersistencePayloadKinds.workflowEntity,
      schemaVersion: "ai-loom.workflow-entity.v1",
    } satisfies WorkflowPersistencePayloadReference),
    definition: workflowEntity,
  });
}

export function toPersistedWorkflowSummary(record: PersistedWorkflowRecord): PersistedWorkflowSummary {
  return Object.freeze({
    id: record.id,
    name: record.name,
    metadata: record.metadata,
    status: record.status,
    lifecycleState: record.lifecycleState,
    ownershipContext: record.ownershipContext,
    revision: record.revision,
    timestamps: record.timestamps,
  });
}

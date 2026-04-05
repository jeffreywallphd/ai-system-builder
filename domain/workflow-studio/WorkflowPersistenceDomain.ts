import {
  createWorkflowEntity,
  deserializeWorkflowEntity,
  serializeWorkflowEntity,
  type WorkflowDraft,
  type WorkflowEntity,
  type WorkflowEntityMetadata,
  type WorkflowLifecycleState,
  WorkflowLifecycleStates,
} from "./WorkflowStudioDomain";
import {
  rehydrateWorkspaceOwnershipMetadata,
  type WorkspaceOwnershipMetadata,
} from "../../src/shared/workspaces/WorkspaceOwnership";

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

  const workspaceId = normalizeOptional(ownershipContext.workspaceId);
  const workspaceOwnership = ownershipContext.workspaceOwnership
    ? rehydrateWorkspaceOwnershipMetadata(ownershipContext.workspaceOwnership)
    : undefined;
  if (workspaceId && workspaceOwnership && workspaceId !== workspaceOwnership.workspaceId) {
    throw new Error("Workflow persistence ownership workspaceId must match workspaceOwnership.workspaceId.");
  }
  const resolvedWorkspaceId = workspaceId ?? workspaceOwnership?.workspaceId;

  const normalized: WorkflowPersistenceOwnershipContext = Object.freeze({
    ownerId: normalizeOptional(ownershipContext.ownerId),
    tenantId: normalizeOptional(ownershipContext.tenantId),
    studioId: normalizeOptional(ownershipContext.studioId),
    sessionId: normalizeOptional(ownershipContext.sessionId),
    workspaceId: resolvedWorkspaceId,
    workspaceOwnership,
  });

  if (
    !normalized.ownerId
    && !normalized.tenantId
    && !normalized.studioId
    && !normalized.sessionId
    && !normalized.workspaceId
    && !normalized.workspaceOwnership
  ) {
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
  readonly workspaceId?: string;
  readonly workspaceOwnership?: WorkspaceOwnershipMetadata;
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

function normalizeTimestamp(value: string, label: string): string {
  const normalized = normalizeRequired(value, label);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

export function normalizePersistedWorkflowRecord(record: PersistedWorkflowRecord): PersistedWorkflowRecord {
  const normalizedId = normalizeRequired(record.id, "Persisted workflow id");
  const normalizedName = normalizeRequired(record.name, "Persisted workflow name");
  const normalizedDefinition = deserializeWorkflowEntity(serializeWorkflowEntity(record.definition));
  if (normalizedDefinition.id !== normalizedId) {
    throw new Error("Persisted workflow record id must match workflow definition id.");
  }
  if (normalizedDefinition.name !== normalizedName) {
    throw new Error("Persisted workflow record name must match workflow definition name.");
  }

  const expectedStatus = determineStatus(normalizedDefinition.lifecycleState);
  if (record.status !== expectedStatus) {
    throw new Error("Persisted workflow status is inconsistent with workflow lifecycle state.");
  }
  if (record.lifecycleState !== normalizedDefinition.lifecycleState) {
    throw new Error("Persisted workflow lifecycle state is inconsistent with workflow definition state.");
  }

  const createdAt = normalizeTimestamp(record.timestamps.createdAt, "Persisted workflow createdAt");
  const updatedAt = normalizeTimestamp(record.timestamps.updatedAt, "Persisted workflow updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error("Persisted workflow updatedAt must be at or after createdAt.");
  }

  const savedAt = record.timestamps.savedAt
    ? normalizeTimestamp(record.timestamps.savedAt, "Persisted workflow savedAt")
    : undefined;
  if (expectedStatus === WorkflowPersistenceStatuses.saved && !savedAt) {
    throw new Error("Saved persisted workflows must include savedAt.");
  }
  if (expectedStatus === WorkflowPersistenceStatuses.draft && savedAt) {
    throw new Error("Draft persisted workflows cannot include savedAt.");
  }

  assertPositiveInteger(record.revision.persistenceRevision, "Workflow persistence revision");
  assertPositiveInteger(record.revision.workflowRevision, "Workflow definition revision");
  if (record.revision.workflowRevision !== normalizedDefinition.draftRevision) {
    throw new Error("Persisted workflow revision metadata is inconsistent with workflow definition draft revision.");
  }

  if (
    record.payload.kind !== WorkflowPersistencePayloadKinds.workflowEntity
    || record.payload.schemaVersion !== "ai-loom.workflow-entity.v1"
  ) {
    throw new Error("Persisted workflow payload reference is not supported.");
  }

  return Object.freeze({
    id: normalizedId,
    name: normalizedName,
    metadata: normalizedDefinition.metadata,
    status: expectedStatus,
    lifecycleState: normalizedDefinition.lifecycleState,
    ownershipContext: normalizeOwnershipContext(record.ownershipContext),
    revision: Object.freeze({
      persistenceRevision: record.revision.persistenceRevision,
      workflowRevision: normalizedDefinition.draftRevision,
      versionLabel: normalizeOptional(record.revision.versionLabel),
      duplicatedFromWorkflowId: normalizeOptional(record.revision.duplicatedFromWorkflowId),
    }),
    timestamps: Object.freeze({
      createdAt,
      updatedAt,
      savedAt,
    }),
    payload: Object.freeze({
      kind: WorkflowPersistencePayloadKinds.workflowEntity,
      schemaVersion: "ai-loom.workflow-entity.v1",
    } satisfies WorkflowPersistencePayloadReference),
    definition: normalizedDefinition,
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

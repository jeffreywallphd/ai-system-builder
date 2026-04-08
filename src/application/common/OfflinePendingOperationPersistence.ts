import { createHash } from "node:crypto";
import {
  type OfflineQueuedMutationEnvelope,
  type OfflineResourceClass,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  createOfflinePendingRunSubmissionRecord,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { toOfflinePendingOperationEnvelopeDto } from "@shared/dto/runtime/OfflineSynchronizationDtos";
import { OfflinePendingOperationEnvelopeDtoSchema } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";

export class OfflinePendingOperationPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflinePendingOperationPersistenceError";
  }
}

export const OfflinePendingOperationLocalStateScopes = Object.freeze({
  unsyncedLocalPending: "unsynced-local-pending",
});

export type OfflinePendingOperationLocalStateScope =
  typeof OfflinePendingOperationLocalStateScopes[keyof typeof OfflinePendingOperationLocalStateScopes];

export const OfflinePendingOperationDependencyKinds = Object.freeze({
  replayAfterDependencyApplied: "replay-after-dependency-applied",
});

export type OfflinePendingOperationDependencyKind =
  typeof OfflinePendingOperationDependencyKinds[keyof typeof OfflinePendingOperationDependencyKinds];

export interface OfflinePendingOperationDependency {
  readonly operationId: string;
  readonly kind: OfflinePendingOperationDependencyKind;
}

export interface OfflinePendingOperationResourceBaseVersion {
  readonly resourceClass: OfflineResourceClass;
  readonly resourceId: string;
  readonly baseAuthoritativeRevision: string;
  readonly authoritativeSnapshotRevision?: string;
}

export interface OfflinePendingOperationActorWorkspaceContext {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
}

export const OfflinePendingOperationRetryBackoffPolicies = Object.freeze({
  none: "none",
  fixed: "fixed",
  exponential: "exponential",
});

export type OfflinePendingOperationRetryBackoffPolicy =
  typeof OfflinePendingOperationRetryBackoffPolicies[keyof typeof OfflinePendingOperationRetryBackoffPolicies];

export interface OfflinePendingOperationRetryabilityMetadata {
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly maxRetryCount: number;
  readonly backoffPolicy: OfflinePendingOperationRetryBackoffPolicy;
  readonly nextEligibleReplayAt?: string;
  readonly lastAttemptedAt?: string;
  readonly nonRetryableReasonCode?: string;
}

export interface OfflinePendingRunSubmissionMetadata {
  readonly submissionId: string;
  readonly workflowDefinitionId: string;
  readonly inputDigest: string;
  readonly requestedAt: string;
  readonly requestedByActorUserIdentityId: string;
}

export interface OfflinePendingOperationRecord {
  readonly operation: OfflineQueuedMutationEnvelope;
  readonly actorWorkspaceContext: OfflinePendingOperationActorWorkspaceContext;
  readonly dependencies: ReadonlyArray<OfflinePendingOperationDependency>;
  readonly resourceBaseVersions: ReadonlyArray<OfflinePendingOperationResourceBaseVersion>;
  readonly retryability: OfflinePendingOperationRetryabilityMetadata;
  readonly localStateScope: OfflinePendingOperationLocalStateScope;
  readonly canonicalReplayPayloadJson: string;
  readonly canonicalReplayPayloadDigest: string;
  readonly pendingRunSubmission?: OfflinePendingRunSubmissionMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfflinePendingOperationSerializedRecord {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly operationEnvelopeJson: string;
  readonly dependenciesJson: string;
  readonly resourceBaseVersionsJson: string;
  readonly retryabilityJson: string;
  readonly localStateScope: OfflinePendingOperationLocalStateScope;
  readonly canonicalReplayPayloadJson: string;
  readonly canonicalReplayPayloadDigest: string;
  readonly pendingRunSubmissionJson?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IOfflinePendingOperationSerializer {
  serialize(record: OfflinePendingOperationRecord): OfflinePendingOperationSerializedRecord;
  deserialize(record: OfflinePendingOperationSerializedRecord): OfflinePendingOperationRecord;
}

export interface IOfflinePendingOperationRepository {
  upsertOperation(record: OfflinePendingOperationRecord): Promise<void>;
  findOperation(workspaceId: string, operationId: string): Promise<OfflinePendingOperationRecord | undefined>;
  listOperationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflinePendingOperationRecord>>;
  deleteOperation(workspaceId: string, operationId: string): Promise<boolean>;
}

export interface PrepareOfflineReplayOperation {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly targetResourceClass: OfflineResourceClass;
  readonly targetResourceId: string;
  readonly dependencies: ReadonlyArray<OfflinePendingOperationDependency>;
  readonly resourceBaseVersions: ReadonlyArray<OfflinePendingOperationResourceBaseVersion>;
  readonly retryability: OfflinePendingOperationRetryabilityMetadata;
  readonly divergenceDisclosureToken: string;
  readonly replayRequest: {
    readonly method: OfflineQueuedMutationEnvelope["replayDescriptor"]["method"];
    readonly path: string;
    readonly idempotencyKey: string;
    readonly payloadContentType?: string;
    readonly payload: Readonly<Record<string, unknown>>;
  };
  readonly canonicalReplayPayloadJson: string;
  readonly canonicalReplayPayloadDigest: string;
  readonly pendingRunSubmission?: OfflinePendingRunSubmissionMetadata;
  readonly queuedAt: string;
}

export interface OfflineReplayPreparationBlockedOperation {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly reasonCode:
    | "operation-not-pending"
    | "retry-not-eligible"
    | "retry-exhausted"
    | "non-retryable"
    | "dependency-not-ready";
  readonly message: string;
  readonly blockingDependencyOperationIds?: ReadonlyArray<string>;
}

export interface OfflineReplayPreparationResult {
  readonly prepared: ReadonlyArray<PrepareOfflineReplayOperation>;
  readonly blocked: ReadonlyArray<OfflineReplayPreparationBlockedOperation>;
  readonly preparedAt: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflinePendingOperationPersistenceError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflinePendingOperationPersistenceError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeRetryabilityMetadata(
  retryability: OfflinePendingOperationRetryabilityMetadata,
): OfflinePendingOperationRetryabilityMetadata {
  const retryCount = Math.max(0, Math.floor(retryability.retryCount));
  const maxRetryCount = Math.max(0, Math.floor(retryability.maxRetryCount));
  const backoffPolicy = Object.values(OfflinePendingOperationRetryBackoffPolicies)
    .includes(retryability.backoffPolicy)
    ? retryability.backoffPolicy
    : OfflinePendingOperationRetryBackoffPolicies.none;

  if (!retryability.retryable && retryability.nonRetryableReasonCode?.trim() !== retryability.nonRetryableReasonCode) {
    throw new OfflinePendingOperationPersistenceError(
      "retryability nonRetryableReasonCode must not include leading or trailing whitespace.",
    );
  }

  return Object.freeze({
    retryable: retryability.retryable,
    retryCount,
    maxRetryCount,
    backoffPolicy,
    nextEligibleReplayAt: retryability.nextEligibleReplayAt
      ? normalizeIsoTimestamp(retryability.nextEligibleReplayAt, "retryability nextEligibleReplayAt")
      : undefined,
    lastAttemptedAt: retryability.lastAttemptedAt
      ? normalizeIsoTimestamp(retryability.lastAttemptedAt, "retryability lastAttemptedAt")
      : undefined,
    nonRetryableReasonCode: retryability.nonRetryableReasonCode?.trim()
      ? retryability.nonRetryableReasonCode.trim()
      : undefined,
  });
}

function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeJson(entryValue)}`).join(",")}}`;
}

function computePayloadDigest(payloadCanonicalJson: string): string {
  return createHash("sha256").update(payloadCanonicalJson, "utf8").digest("hex");
}

function normalizeDependencies(
  dependencies: ReadonlyArray<OfflinePendingOperationDependency>,
  operationId: string,
): ReadonlyArray<OfflinePendingOperationDependency> {
  const uniqueById = new Map<string, OfflinePendingOperationDependency>();
  for (const dependency of dependencies) {
    const dependencyOperationId = normalizeRequired(
      dependency.operationId,
      "Pending operation dependency operationId",
    );
    if (dependencyOperationId === operationId) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${operationId}' cannot depend on itself.`,
      );
    }
    if (!Object.values(OfflinePendingOperationDependencyKinds).includes(dependency.kind)) {
      throw new OfflinePendingOperationPersistenceError(
        `Pending operation dependency kind '${String(dependency.kind)}' is invalid.`,
      );
    }
    uniqueById.set(dependencyOperationId, Object.freeze({
      operationId: dependencyOperationId,
      kind: dependency.kind,
    }));
  }

  return Object.freeze(
    [...uniqueById.values()].sort((left, right) => left.operationId.localeCompare(right.operationId)),
  );
}

function normalizeResourceBaseVersions(
  versions: ReadonlyArray<OfflinePendingOperationResourceBaseVersion>,
): ReadonlyArray<OfflinePendingOperationResourceBaseVersion> {
  const byKey = new Map<string, OfflinePendingOperationResourceBaseVersion>();
  for (const version of versions) {
    const resourceId = normalizeRequired(version.resourceId, "Pending operation resourceBaseVersion resourceId");
    const baseAuthoritativeRevision = normalizeRequired(
      version.baseAuthoritativeRevision,
      "Pending operation resourceBaseVersion baseAuthoritativeRevision",
    );
    const authoritativeSnapshotRevision = version.authoritativeSnapshotRevision?.trim()
      ? version.authoritativeSnapshotRevision.trim()
      : undefined;

    const key = `${version.resourceClass}::${resourceId}`;
    byKey.set(key, Object.freeze({
      resourceClass: version.resourceClass,
      resourceId,
      baseAuthoritativeRevision,
      authoritativeSnapshotRevision,
    }));
  }

  return Object.freeze([...byKey.values()].sort((left, right) => {
    const classCompare = left.resourceClass.localeCompare(right.resourceClass);
    return classCompare !== 0 ? classCompare : left.resourceId.localeCompare(right.resourceId);
  }));
}

function toCanonicalPendingRunSubmission(
  pendingRunSubmission: OfflinePendingRunSubmissionMetadata,
  envelope: OfflineQueuedMutationEnvelope,
): OfflinePendingRunSubmissionMetadata {
  const domainRecord = createOfflinePendingRunSubmissionRecord({
    submissionId: pendingRunSubmission.submissionId,
    queuedMutation: envelope,
    requestedAt: pendingRunSubmission.requestedAt,
    requestedByActorUserIdentityId: pendingRunSubmission.requestedByActorUserIdentityId,
    workflowDefinitionId: pendingRunSubmission.workflowDefinitionId,
    inputDigest: pendingRunSubmission.inputDigest,
  });

  return Object.freeze({
    submissionId: domainRecord.submissionId,
    workflowDefinitionId: domainRecord.workflowDefinitionId,
    inputDigest: domainRecord.inputDigest,
    requestedAt: domainRecord.requestedAt,
    requestedByActorUserIdentityId: domainRecord.requestedByActorUserIdentityId,
  });
}

export function createOfflinePendingOperationRecord(input: {
  readonly operation: OfflineQueuedMutationEnvelope;
  readonly actorWorkspaceContext: OfflinePendingOperationActorWorkspaceContext;
  readonly dependencies?: ReadonlyArray<OfflinePendingOperationDependency>;
  readonly resourceBaseVersions?: ReadonlyArray<OfflinePendingOperationResourceBaseVersion>;
  readonly retryability?: OfflinePendingOperationRetryabilityMetadata;
  readonly pendingRunSubmission?: OfflinePendingRunSubmissionMetadata;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}): OfflinePendingOperationRecord {
  const dto = toOfflinePendingOperationEnvelopeDto(input.operation, {
    retryCount: input.retryability?.retryCount,
    lastAttemptedAt: input.retryability?.lastAttemptedAt,
  });
  OfflinePendingOperationEnvelopeDtoSchema.parse(dto);

  if (input.operation.userVisibleSyncStatus === OfflineQueuedMutationStatuses.syncApplied) {
    throw new OfflinePendingOperationPersistenceError(
      "Pending operation records cannot include sync-applied operations because those are authoritative outcomes.",
    );
  }

  const operationId = normalizeRequired(input.operation.mutationId, "Pending operation mutationId");
  const workspaceId = normalizeRequired(
    input.actorWorkspaceContext.workspaceId,
    "Pending operation actorWorkspaceContext workspaceId",
  );
  const actorUserIdentityId = normalizeRequired(
    input.actorWorkspaceContext.actorUserIdentityId,
    "Pending operation actorWorkspaceContext actorUserIdentityId",
  );

  const canonicalReplayPayloadJson = canonicalizeJson(input.operation.replayDescriptor.payload);
  const canonicalReplayPayloadDigest = computePayloadDigest(canonicalReplayPayloadJson);

  const resourceBaseVersions = normalizeResourceBaseVersions([
    ...(input.resourceBaseVersions ?? []),
    {
      resourceClass: input.operation.targetResourceClass,
      resourceId: input.operation.targetResourceId,
      baseAuthoritativeRevision: input.operation.baseAuthoritativeRevision,
    },
  ]);

  const dependencies = normalizeDependencies(input.dependencies ?? [], operationId);
  const retryability = normalizeRetryabilityMetadata(input.retryability ?? {
    retryable: true,
    retryCount: 0,
    maxRetryCount: 5,
    backoffPolicy: OfflinePendingOperationRetryBackoffPolicies.exponential,
  });

  const pendingRunSubmission = input.operation.targetResourceClass === OfflineResourceClasses.runSubmissionIntent
    ? toCanonicalPendingRunSubmission(
      input.pendingRunSubmission ?? {
        submissionId: operationId,
        workflowDefinitionId: input.operation.targetResourceId,
        inputDigest: canonicalReplayPayloadDigest,
        requestedAt: input.operation.queuedAt,
        requestedByActorUserIdentityId: actorUserIdentityId,
      },
      input.operation,
    )
    : undefined;

  if (input.operation.targetResourceClass !== OfflineResourceClasses.runSubmissionIntent && input.pendingRunSubmission) {
    throw new OfflinePendingOperationPersistenceError(
      "pendingRunSubmission metadata is only valid for run-submission-intent operations.",
    );
  }

  const createdAt = normalizeIsoTimestamp(input.createdAt ?? input.operation.queuedAt, "Pending operation createdAt");
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? createdAt, "Pending operation updatedAt");

  return Object.freeze({
    operation: input.operation,
    actorWorkspaceContext: Object.freeze({
      workspaceId,
      actorUserIdentityId,
    }),
    dependencies,
    resourceBaseVersions,
    retryability,
    localStateScope: OfflinePendingOperationLocalStateScopes.unsyncedLocalPending,
    canonicalReplayPayloadJson,
    canonicalReplayPayloadDigest,
    pendingRunSubmission,
    createdAt,
    updatedAt,
  });
}

export class JsonOfflinePendingOperationSerializer implements IOfflinePendingOperationSerializer {
  public serialize(record: OfflinePendingOperationRecord): OfflinePendingOperationSerializedRecord {
    const canonical = createOfflinePendingOperationRecord(record);
    return Object.freeze({
      operationId: canonical.operation.mutationId,
      workspaceId: canonical.actorWorkspaceContext.workspaceId,
      actorUserIdentityId: canonical.actorWorkspaceContext.actorUserIdentityId,
      operationEnvelopeJson: JSON.stringify(canonical.operation),
      dependenciesJson: JSON.stringify(canonical.dependencies),
      resourceBaseVersionsJson: JSON.stringify(canonical.resourceBaseVersions),
      retryabilityJson: JSON.stringify(canonical.retryability),
      localStateScope: canonical.localStateScope,
      canonicalReplayPayloadJson: canonical.canonicalReplayPayloadJson,
      canonicalReplayPayloadDigest: canonical.canonicalReplayPayloadDigest,
      pendingRunSubmissionJson: canonical.pendingRunSubmission
        ? JSON.stringify(canonical.pendingRunSubmission)
        : undefined,
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
    });
  }

  public deserialize(serialized: OfflinePendingOperationSerializedRecord): OfflinePendingOperationRecord {
    if (serialized.localStateScope !== OfflinePendingOperationLocalStateScopes.unsyncedLocalPending) {
      throw new OfflinePendingOperationPersistenceError(
        `Unsupported localStateScope '${serialized.localStateScope}' for pending operation '${serialized.operationId}'.`,
      );
    }

    const operation = JSON.parse(serialized.operationEnvelopeJson) as OfflineQueuedMutationEnvelope;
    const actorWorkspaceContext = {
      workspaceId: serialized.workspaceId,
      actorUserIdentityId: serialized.actorUserIdentityId,
    };

    const record = createOfflinePendingOperationRecord({
      operation,
      actorWorkspaceContext,
      dependencies: JSON.parse(serialized.dependenciesJson) as ReadonlyArray<OfflinePendingOperationDependency>,
      resourceBaseVersions: JSON.parse(serialized.resourceBaseVersionsJson)
        as ReadonlyArray<OfflinePendingOperationResourceBaseVersion>,
      retryability: JSON.parse(serialized.retryabilityJson) as OfflinePendingOperationRetryabilityMetadata,
      pendingRunSubmission: serialized.pendingRunSubmissionJson
        ? (JSON.parse(serialized.pendingRunSubmissionJson) as OfflinePendingRunSubmissionMetadata)
        : undefined,
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
    });

    if (record.canonicalReplayPayloadJson !== serialized.canonicalReplayPayloadJson) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${record.operation.mutationId}' replay payload canonical JSON is not stable.`,
      );
    }
    if (record.canonicalReplayPayloadDigest !== serialized.canonicalReplayPayloadDigest) {
      throw new OfflinePendingOperationPersistenceError(
        `Operation '${record.operation.mutationId}' replay payload digest is not stable.`,
      );
    }

    return record;
  }
}

function dependencyCompare(left: OfflinePendingOperationRecord, right: OfflinePendingOperationRecord): number {
  const queuedAtCompare = left.operation.queuedAt.localeCompare(right.operation.queuedAt);
  if (queuedAtCompare !== 0) {
    return queuedAtCompare;
  }
  return left.operation.mutationId.localeCompare(right.operation.mutationId);
}

export class OfflinePendingOperationService {
  constructor(
    private readonly repository: IOfflinePendingOperationRepository,
    private readonly serializer: IOfflinePendingOperationSerializer = new JsonOfflinePendingOperationSerializer(),
  ) {}

  public async queueOperation(input: {
    readonly operation: OfflineQueuedMutationEnvelope;
    readonly actorWorkspaceContext: OfflinePendingOperationActorWorkspaceContext;
    readonly dependencies?: ReadonlyArray<OfflinePendingOperationDependency>;
    readonly resourceBaseVersions?: ReadonlyArray<OfflinePendingOperationResourceBaseVersion>;
    readonly retryability?: OfflinePendingOperationRetryabilityMetadata;
    readonly pendingRunSubmission?: OfflinePendingRunSubmissionMetadata;
    readonly createdAt?: string;
    readonly updatedAt?: string;
  }): Promise<OfflinePendingOperationRecord> {
    const record = createOfflinePendingOperationRecord(input);
    const roundTrip = this.serializer.deserialize(this.serializer.serialize(record));
    await this.repository.upsertOperation(roundTrip);
    return roundTrip;
  }

  public async findQueuedOperation(
    workspaceId: string,
    operationId: string,
  ): Promise<OfflinePendingOperationRecord | undefined> {
    return this.repository.findOperation(
      normalizeRequired(workspaceId, "workspaceId"),
      normalizeRequired(operationId, "operationId"),
    );
  }

  public async removeQueuedOperation(workspaceId: string, operationId: string): Promise<boolean> {
    return this.repository.deleteOperation(
      normalizeRequired(workspaceId, "workspaceId"),
      normalizeRequired(operationId, "operationId"),
    );
  }

  public async prepareReplayOperations(input: {
    readonly workspaceId: string;
    readonly preparedAt?: string;
  }): Promise<OfflineReplayPreparationResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "prepareReplayOperations workspaceId");
    const preparedAt = normalizeIsoTimestamp(input.preparedAt ?? new Date().toISOString(), "prepareReplayOperations preparedAt");

    const operations = [...await this.repository.listOperationsByWorkspace(workspaceId)]
      .sort(dependencyCompare);

    const pendingOperations = new Map<string, OfflinePendingOperationRecord>();
    for (const operation of operations) {
      pendingOperations.set(operation.operation.mutationId, operation);
    }

    const prepared: PrepareOfflineReplayOperation[] = [];
    const blocked: OfflineReplayPreparationBlockedOperation[] = [];
    const preparedOperationIds = new Set<string>();

    for (const operation of operations) {
      const operationId = operation.operation.mutationId;
      if (operation.localStateScope !== OfflinePendingOperationLocalStateScopes.unsyncedLocalPending) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "operation-not-pending",
          message: `Operation '${operationId}' is not marked as local unsynced pending state.`,
        }));
        continue;
      }

      if (operation.operation.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.queuedPendingSync) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "operation-not-pending",
          message: `Operation '${operationId}' is '${operation.operation.userVisibleSyncStatus}' and is not replay-ready.`,
        }));
        continue;
      }

      if (!operation.retryability.retryable) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "non-retryable",
          message: operation.retryability.nonRetryableReasonCode
            ? `Operation '${operationId}' is not retryable (${operation.retryability.nonRetryableReasonCode}).`
            : `Operation '${operationId}' is marked non-retryable.`,
        }));
        continue;
      }

      if (operation.retryability.retryCount >= operation.retryability.maxRetryCount) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "retry-exhausted",
          message: `Operation '${operationId}' exceeded maxRetryCount=${operation.retryability.maxRetryCount}.`,
        }));
        continue;
      }

      if (
        operation.retryability.nextEligibleReplayAt
        && new Date(operation.retryability.nextEligibleReplayAt).getTime() > new Date(preparedAt).getTime()
      ) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "retry-not-eligible",
          message: `Operation '${operationId}' is not eligible for replay before '${operation.retryability.nextEligibleReplayAt}'.`,
        }));
        continue;
      }

      const blockingDependencyOperationIds = operation.dependencies
        .map((dependency) => dependency.operationId)
        .filter((dependencyOperationId) => {
          if (preparedOperationIds.has(dependencyOperationId)) {
            return false;
          }
          const dependency = pendingOperations.get(dependencyOperationId);
          if (!dependency) {
            return true;
          }
          return dependency.operation.userVisibleSyncStatus !== OfflineQueuedMutationStatuses.syncApplied;
        });

      if (blockingDependencyOperationIds.length > 0) {
        blocked.push(Object.freeze({
          operationId,
          workspaceId,
          reasonCode: "dependency-not-ready",
          message: `Operation '${operationId}' is blocked by ${blockingDependencyOperationIds.length} dependency operation(s).`,
          blockingDependencyOperationIds: Object.freeze(blockingDependencyOperationIds),
        }));
        continue;
      }

      prepared.push(Object.freeze({
        operationId,
        workspaceId,
        actorUserIdentityId: operation.actorWorkspaceContext.actorUserIdentityId,
        targetResourceClass: operation.operation.targetResourceClass,
        targetResourceId: operation.operation.targetResourceId,
        dependencies: operation.dependencies,
        resourceBaseVersions: operation.resourceBaseVersions,
        retryability: operation.retryability,
        divergenceDisclosureToken: operation.operation.divergenceDisclosureToken,
        replayRequest: Object.freeze({
          method: operation.operation.replayDescriptor.method,
          path: operation.operation.replayDescriptor.path,
          idempotencyKey: operation.operation.replayDescriptor.idempotencyKey,
          payloadContentType: operation.operation.replayDescriptor.payloadContentType,
          payload: operation.operation.replayDescriptor.payload,
        }),
        canonicalReplayPayloadJson: operation.canonicalReplayPayloadJson,
        canonicalReplayPayloadDigest: operation.canonicalReplayPayloadDigest,
        pendingRunSubmission: operation.pendingRunSubmission,
        queuedAt: operation.operation.queuedAt,
      }));
      preparedOperationIds.add(operationId);
    }

    return Object.freeze({
      prepared: Object.freeze(prepared),
      blocked: Object.freeze(blocked),
      preparedAt,
    });
  }
}

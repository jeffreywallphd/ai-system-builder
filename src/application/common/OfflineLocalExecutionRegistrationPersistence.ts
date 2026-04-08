import { createHash } from "node:crypto";
import {
  type OfflineLocalExecutionRegistrationEnvelope,
  type OfflineResourceClass,
  createOfflineLocalExecutionRegistrationEnvelope,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { toOfflineLocalExecutionRegistrationEnvelopeDto } from "@shared/dto/runtime/OfflineSynchronizationDtos";
import {
  OfflineLocalExecutionRegistrationStatuses,
  transitionOfflineLocalExecutionRegistrationStatus,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { OfflineSyncQueueStateDtoSchema } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";

export class OfflineLocalExecutionRegistrationPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineLocalExecutionRegistrationPersistenceError";
  }
}

export const OfflineLocalExecutionRegistrationLocalStateScopes = Object.freeze({
  unsyncedLocalRegistrationPending: "unsynced-local-registration-pending",
});

export type OfflineLocalExecutionRegistrationLocalStateScope =
  typeof OfflineLocalExecutionRegistrationLocalStateScopes[keyof typeof OfflineLocalExecutionRegistrationLocalStateScopes];

export const OfflineLocalExecutionRegistrationRetryBackoffPolicies = Object.freeze({
  none: "none",
  fixed: "fixed",
  exponential: "exponential",
});

export type OfflineLocalExecutionRegistrationRetryBackoffPolicy =
  typeof OfflineLocalExecutionRegistrationRetryBackoffPolicies[keyof typeof OfflineLocalExecutionRegistrationRetryBackoffPolicies];

export interface OfflineLocalExecutionRegistrationActorWorkspaceContext {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
}

export interface OfflineLocalExecutionRegistrationRetryabilityMetadata {
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly maxRetryCount: number;
  readonly backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicy;
  readonly nextEligibleReplayAt?: string;
  readonly lastAttemptedAt?: string;
  readonly nonRetryableReasonCode?: string;
}

export interface OfflineLocalExecutionRegistrationRecord {
  readonly registration: OfflineLocalExecutionRegistrationEnvelope;
  readonly actorWorkspaceContext: OfflineLocalExecutionRegistrationActorWorkspaceContext;
  readonly retryability: OfflineLocalExecutionRegistrationRetryabilityMetadata;
  readonly localStateScope: OfflineLocalExecutionRegistrationLocalStateScope;
  readonly canonicalExecutionMetadataJson: string;
  readonly canonicalExecutionMetadataDigest: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfflineLocalExecutionRegistrationSerializedRecord {
  readonly registrationId: string;
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly registrationEnvelopeJson: string;
  readonly retryabilityJson: string;
  readonly localStateScope: OfflineLocalExecutionRegistrationLocalStateScope;
  readonly canonicalExecutionMetadataJson: string;
  readonly canonicalExecutionMetadataDigest: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IOfflineLocalExecutionRegistrationSerializer {
  serialize(record: OfflineLocalExecutionRegistrationRecord): OfflineLocalExecutionRegistrationSerializedRecord;
  deserialize(record: OfflineLocalExecutionRegistrationSerializedRecord): OfflineLocalExecutionRegistrationRecord;
}

export interface IOfflineLocalExecutionRegistrationRepository {
  upsertRegistration(record: OfflineLocalExecutionRegistrationRecord): Promise<void>;
  findRegistration(
    workspaceId: string,
    registrationId: string,
  ): Promise<OfflineLocalExecutionRegistrationRecord | undefined>;
  listRegistrationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>>;
  deleteRegistration(workspaceId: string, registrationId: string): Promise<boolean>;
}

export interface PrepareOfflineReplayLocalExecutionRegistration {
  readonly registrationId: string;
  readonly executionId: string;
  readonly executionClass: OfflineLocalExecutionRegistrationEnvelope["executionClass"];
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly registrationEnvelope: OfflineLocalExecutionRegistrationEnvelope;
  readonly targetResourceClass: OfflineResourceClass;
  readonly targetResourceId: string;
  readonly retryability: OfflineLocalExecutionRegistrationRetryabilityMetadata;
  readonly divergenceDisclosureToken: string;
  readonly replayRequest: {
    readonly method: OfflineLocalExecutionRegistrationEnvelope["replayDescriptor"]["method"];
    readonly path: string;
    readonly idempotencyKey: string;
    readonly payloadContentType?: string;
    readonly payload: Readonly<Record<string, unknown>>;
  };
  readonly canonicalExecutionMetadataJson: string;
  readonly canonicalExecutionMetadataDigest: string;
  readonly queuedAt: string;
}

export interface OfflineReplayPreparationBlockedLocalExecutionRegistration {
  readonly registrationId: string;
  readonly workspaceId: string;
  readonly reasonCode:
    | "registration-not-pending"
    | "retry-not-eligible"
    | "retry-exhausted"
    | "non-retryable";
  readonly message: string;
}

export interface OfflineReplayPreparationLocalExecutionRegistrationResult {
  readonly prepared: ReadonlyArray<PrepareOfflineReplayLocalExecutionRegistration>;
  readonly blocked: ReadonlyArray<OfflineReplayPreparationBlockedLocalExecutionRegistration>;
  readonly preparedAt: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OfflineLocalExecutionRegistrationPersistenceError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const parsed = new Date(normalizeRequired(value, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new OfflineLocalExecutionRegistrationPersistenceError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeRetryabilityMetadata(
  retryability: OfflineLocalExecutionRegistrationRetryabilityMetadata,
): OfflineLocalExecutionRegistrationRetryabilityMetadata {
  const retryCount = Math.max(0, Math.floor(retryability.retryCount));
  const maxRetryCount = Math.max(0, Math.floor(retryability.maxRetryCount));
  const backoffPolicy = Object.values(OfflineLocalExecutionRegistrationRetryBackoffPolicies)
    .includes(retryability.backoffPolicy)
    ? retryability.backoffPolicy
    : OfflineLocalExecutionRegistrationRetryBackoffPolicies.none;

  if (!retryability.retryable && retryability.nonRetryableReasonCode?.trim() !== retryability.nonRetryableReasonCode) {
    throw new OfflineLocalExecutionRegistrationPersistenceError(
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

export function createOfflineLocalExecutionRegistrationRecord(input: {
  readonly registration: OfflineLocalExecutionRegistrationEnvelope;
  readonly actorWorkspaceContext: OfflineLocalExecutionRegistrationActorWorkspaceContext;
  readonly retryability?: OfflineLocalExecutionRegistrationRetryabilityMetadata;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}): OfflineLocalExecutionRegistrationRecord {
  const dto = toOfflineLocalExecutionRegistrationEnvelopeDto(input.registration, {
    retryCount: input.retryability?.retryCount,
    lastAttemptedAt: input.retryability?.lastAttemptedAt,
  });
  OfflineSyncQueueStateDtoSchema.parse({
    queueId: "queue-validation",
    operations: [],
    localExecutionRegistrations: [dto],
    pendingRunSubmissions: [],
    outcomes: [],
    updatedAt: input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
  });

  if (
    input.registration.userVisibleRegistrationStatus
    === OfflineLocalExecutionRegistrationStatuses.registrationApplied
  ) {
    throw new OfflineLocalExecutionRegistrationPersistenceError(
      "Local execution registration records cannot include registration-applied entries because those are authoritative outcomes.",
    );
  }

  const registrationId = normalizeRequired(input.registration.registrationId, "Local execution registrationId");
  const workspaceId = normalizeRequired(
    input.actorWorkspaceContext.workspaceId,
    "Local execution actorWorkspaceContext workspaceId",
  );
  const actorUserIdentityId = normalizeRequired(
    input.actorWorkspaceContext.actorUserIdentityId,
    "Local execution actorWorkspaceContext actorUserIdentityId",
  );

  const canonicalExecutionMetadataJson = canonicalizeJson({
    execution: input.registration.execution,
    replayDescriptor: input.registration.replayDescriptor,
  });
  const canonicalExecutionMetadataDigest = computePayloadDigest(canonicalExecutionMetadataJson);
  const retryability = normalizeRetryabilityMetadata(input.retryability ?? {
    retryable: true,
    retryCount: 0,
    maxRetryCount: 5,
    backoffPolicy: OfflineLocalExecutionRegistrationRetryBackoffPolicies.exponential,
  });
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? input.registration.queuedAt, "Local execution createdAt");
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? createdAt, "Local execution updatedAt");

  return Object.freeze({
    registration: input.registration,
    actorWorkspaceContext: Object.freeze({
      workspaceId,
      actorUserIdentityId,
    }),
    retryability,
    localStateScope: OfflineLocalExecutionRegistrationLocalStateScopes.unsyncedLocalRegistrationPending,
    canonicalExecutionMetadataJson,
    canonicalExecutionMetadataDigest,
    createdAt,
    updatedAt,
  });
}

export class JsonOfflineLocalExecutionRegistrationSerializer implements IOfflineLocalExecutionRegistrationSerializer {
  public serialize(record: OfflineLocalExecutionRegistrationRecord): OfflineLocalExecutionRegistrationSerializedRecord {
    const canonical = createOfflineLocalExecutionRegistrationRecord(record);
    return Object.freeze({
      registrationId: canonical.registration.registrationId,
      workspaceId: canonical.actorWorkspaceContext.workspaceId,
      actorUserIdentityId: canonical.actorWorkspaceContext.actorUserIdentityId,
      registrationEnvelopeJson: JSON.stringify(canonical.registration),
      retryabilityJson: JSON.stringify(canonical.retryability),
      localStateScope: canonical.localStateScope,
      canonicalExecutionMetadataJson: canonical.canonicalExecutionMetadataJson,
      canonicalExecutionMetadataDigest: canonical.canonicalExecutionMetadataDigest,
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
    });
  }

  public deserialize(serialized: OfflineLocalExecutionRegistrationSerializedRecord): OfflineLocalExecutionRegistrationRecord {
    if (
      serialized.localStateScope
      !== OfflineLocalExecutionRegistrationLocalStateScopes.unsyncedLocalRegistrationPending
    ) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Unsupported localStateScope '${serialized.localStateScope}' for registration '${serialized.registrationId}'.`,
      );
    }

    const registration = JSON.parse(serialized.registrationEnvelopeJson) as OfflineLocalExecutionRegistrationEnvelope;
    const record = createOfflineLocalExecutionRegistrationRecord({
      registration,
      actorWorkspaceContext: {
        workspaceId: serialized.workspaceId,
        actorUserIdentityId: serialized.actorUserIdentityId,
      },
      retryability: JSON.parse(serialized.retryabilityJson) as OfflineLocalExecutionRegistrationRetryabilityMetadata,
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
    });

    if (record.canonicalExecutionMetadataJson !== serialized.canonicalExecutionMetadataJson) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${record.registration.registrationId}' canonical execution metadata JSON is not stable.`,
      );
    }
    if (record.canonicalExecutionMetadataDigest !== serialized.canonicalExecutionMetadataDigest) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${record.registration.registrationId}' canonical execution metadata digest is not stable.`,
      );
    }

    return record;
  }
}

function registrationCompare(
  left: OfflineLocalExecutionRegistrationRecord,
  right: OfflineLocalExecutionRegistrationRecord,
): number {
  const queuedAtCompare = left.registration.queuedAt.localeCompare(right.registration.queuedAt);
  if (queuedAtCompare !== 0) {
    return queuedAtCompare;
  }
  return left.registration.registrationId.localeCompare(right.registration.registrationId);
}

export class OfflineLocalExecutionRegistrationService {
  constructor(
    private readonly repository: IOfflineLocalExecutionRegistrationRepository,
    private readonly serializer: IOfflineLocalExecutionRegistrationSerializer
      = new JsonOfflineLocalExecutionRegistrationSerializer(),
  ) {}

  public async queueRegistration(input: {
    readonly registration: OfflineLocalExecutionRegistrationEnvelope;
    readonly actorWorkspaceContext: OfflineLocalExecutionRegistrationActorWorkspaceContext;
    readonly retryability?: OfflineLocalExecutionRegistrationRetryabilityMetadata;
    readonly createdAt?: string;
    readonly updatedAt?: string;
  }): Promise<OfflineLocalExecutionRegistrationRecord> {
    const record = createOfflineLocalExecutionRegistrationRecord(input);
    const roundTrip = this.serializer.deserialize(this.serializer.serialize(record));
    await this.repository.upsertRegistration(roundTrip);
    return roundTrip;
  }

  public async findQueuedRegistration(
    workspaceId: string,
    registrationId: string,
  ): Promise<OfflineLocalExecutionRegistrationRecord | undefined> {
    return this.repository.findRegistration(
      normalizeRequired(workspaceId, "workspaceId"),
      normalizeRequired(registrationId, "registrationId"),
    );
  }

  public async removeQueuedRegistration(workspaceId: string, registrationId: string): Promise<boolean> {
    return this.repository.deleteRegistration(
      normalizeRequired(workspaceId, "workspaceId"),
      normalizeRequired(registrationId, "registrationId"),
    );
  }

  public async listQueuedRegistrations(
    workspaceId: string,
  ): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>> {
    return this.repository.listRegistrationsByWorkspace(normalizeRequired(workspaceId, "workspaceId"));
  }

  public async markRegistrationAsApplied(workspaceId: string, registrationId: string): Promise<boolean> {
    return this.removeQueuedRegistration(workspaceId, registrationId);
  }

  public async markRegistrationReplayOutcome(input: {
    readonly workspaceId: string;
    readonly registrationId: string;
    readonly nextStatus:
      | typeof OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
      | typeof OfflineLocalExecutionRegistrationStatuses.registrationConflict
      | typeof OfflineLocalExecutionRegistrationStatuses.registrationRejected;
    readonly attemptedAt?: string;
    readonly incrementRetryCount?: boolean;
    readonly nextEligibleReplayAt?: string;
    readonly nonRetryableReasonCode?: string;
    readonly retryable?: boolean;
  }): Promise<OfflineLocalExecutionRegistrationRecord> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const registrationId = normalizeRequired(input.registrationId, "registrationId");
    const record = await this.repository.findRegistration(workspaceId, registrationId);
    if (!record) {
      throw new OfflineLocalExecutionRegistrationPersistenceError(
        `Registration '${registrationId}' was not found in workspace '${workspaceId}'.`,
      );
    }

    const attemptedAt = normalizeIsoTimestamp(input.attemptedAt ?? new Date().toISOString(), "attemptedAt");
    const registrationDto = toOfflineLocalExecutionRegistrationEnvelopeDto(record.registration, {
      retryCount: record.retryability.retryCount,
      lastAttemptedAt: record.retryability.lastAttemptedAt,
    });

    const transitioned = transitionOfflineLocalExecutionRegistrationStatus({
      registration: registrationDto,
      nextStatus: input.nextStatus,
      lastAttemptedAt: attemptedAt,
      retryCount: input.incrementRetryCount === true
        ? record.retryability.retryCount + 1
        : record.retryability.retryCount,
    });

    const updatedRegistration = createOfflineLocalExecutionRegistrationEnvelope({
      registrationId: record.registration.registrationId,
      execution: record.registration.execution,
      queuedAt: record.registration.queuedAt,
      userVisibleRegistrationStatus: transitioned.userVisibleRegistrationStatus,
      divergenceDisclosureToken: record.registration.divergenceDisclosureToken,
      replayDescriptor: record.registration.replayDescriptor,
    });

    const updatedRetryability = Object.freeze({
      ...record.retryability,
      retryable: input.retryable ?? record.retryability.retryable,
      retryCount: transitioned.retryCount,
      lastAttemptedAt: transitioned.lastAttemptedAt,
      nextEligibleReplayAt: input.nextEligibleReplayAt ?? record.retryability.nextEligibleReplayAt,
      nonRetryableReasonCode: input.nonRetryableReasonCode ?? record.retryability.nonRetryableReasonCode,
    });

    return this.queueRegistration({
      registration: updatedRegistration,
      actorWorkspaceContext: record.actorWorkspaceContext,
      retryability: updatedRetryability,
      createdAt: record.createdAt,
      updatedAt: attemptedAt,
    });
  }

  public async prepareReplayRegistrations(input: {
    readonly workspaceId: string;
    readonly preparedAt?: string;
  }): Promise<OfflineReplayPreparationLocalExecutionRegistrationResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "prepareReplayRegistrations workspaceId");
    const preparedAt = normalizeIsoTimestamp(input.preparedAt ?? new Date().toISOString(), "prepareReplayRegistrations preparedAt");
    const registrations = [...await this.repository.listRegistrationsByWorkspace(workspaceId)]
      .sort(registrationCompare);

    const prepared: PrepareOfflineReplayLocalExecutionRegistration[] = [];
    const blocked: OfflineReplayPreparationBlockedLocalExecutionRegistration[] = [];

    for (const registration of registrations) {
      const registrationId = registration.registration.registrationId;
      if (
        registration.localStateScope
        !== OfflineLocalExecutionRegistrationLocalStateScopes.unsyncedLocalRegistrationPending
      ) {
        blocked.push(Object.freeze({
          registrationId,
          workspaceId,
          reasonCode: "registration-not-pending",
          message: `Registration '${registrationId}' is not marked as local unsynced pending state.`,
        }));
        continue;
      }

      if (
        registration.registration.userVisibleRegistrationStatus
        !== OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
      ) {
        blocked.push(Object.freeze({
          registrationId,
          workspaceId,
          reasonCode: "registration-not-pending",
          message: `Registration '${registrationId}' is '${registration.registration.userVisibleRegistrationStatus}' and is not replay-ready.`,
        }));
        continue;
      }

      if (!registration.retryability.retryable) {
        blocked.push(Object.freeze({
          registrationId,
          workspaceId,
          reasonCode: "non-retryable",
          message: registration.retryability.nonRetryableReasonCode
            ? `Registration '${registrationId}' is not retryable (${registration.retryability.nonRetryableReasonCode}).`
            : `Registration '${registrationId}' is marked non-retryable.`,
        }));
        continue;
      }

      if (registration.retryability.retryCount >= registration.retryability.maxRetryCount) {
        blocked.push(Object.freeze({
          registrationId,
          workspaceId,
          reasonCode: "retry-exhausted",
          message: `Registration '${registrationId}' exceeded maxRetryCount=${registration.retryability.maxRetryCount}.`,
        }));
        continue;
      }

      if (
        registration.retryability.nextEligibleReplayAt
        && new Date(registration.retryability.nextEligibleReplayAt).getTime() > new Date(preparedAt).getTime()
      ) {
        blocked.push(Object.freeze({
          registrationId,
          workspaceId,
          reasonCode: "retry-not-eligible",
          message: `Registration '${registrationId}' is not eligible for replay before '${registration.retryability.nextEligibleReplayAt}'.`,
        }));
        continue;
      }

      prepared.push(Object.freeze({
        registrationId,
        executionId: registration.registration.executionId,
        executionClass: registration.registration.executionClass,
        workspaceId,
        actorUserIdentityId: registration.actorWorkspaceContext.actorUserIdentityId,
        registrationEnvelope: registration.registration,
        targetResourceClass: registration.registration.resourceClass,
        targetResourceId: registration.registration.resourceId,
        retryability: registration.retryability,
        divergenceDisclosureToken: registration.registration.divergenceDisclosureToken,
        replayRequest: Object.freeze({
          method: registration.registration.replayDescriptor.method,
          path: registration.registration.replayDescriptor.path,
          idempotencyKey: registration.registration.replayDescriptor.idempotencyKey,
          payloadContentType: registration.registration.replayDescriptor.payloadContentType,
          payload: registration.registration.replayDescriptor.payload,
        }),
        canonicalExecutionMetadataJson: registration.canonicalExecutionMetadataJson,
        canonicalExecutionMetadataDigest: registration.canonicalExecutionMetadataDigest,
        queuedAt: registration.registration.queuedAt,
      }));
    }

    return Object.freeze({
      prepared: Object.freeze(prepared),
      blocked: Object.freeze(blocked),
      preparedAt,
    });
  }
}

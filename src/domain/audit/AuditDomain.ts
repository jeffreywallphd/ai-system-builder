export class AuditDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditDomainError";
  }
}

export const AuditRecordKinds = Object.freeze({
  auditRecord: "audit-record",
  operationalLog: "operational-log",
});

export type AuditRecordKind = typeof AuditRecordKinds[keyof typeof AuditRecordKinds];

export const AuditEventCategories = Object.freeze({
  securitySensitive: "security-sensitive",
  administrative: "administrative",
  sharing: "sharing",
  policy: "policy",
  orchestration: "orchestration",
  protectedData: "protected-data",
});

export type AuditEventCategory = typeof AuditEventCategories[keyof typeof AuditEventCategories];

export const AuditEventOutcomes = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  failed: "failed",
  rejected: "rejected",
});

export type AuditEventOutcome = typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes];

export const AuditActorKinds = Object.freeze({
  user: "user",
  service: "service",
  system: "system",
});

export type AuditActorKind = typeof AuditActorKinds[keyof typeof AuditActorKinds];

export const AuditScopeKinds = Object.freeze({
  global: "global",
  workspace: "workspace",
});

export type AuditScopeKind = typeof AuditScopeKinds[keyof typeof AuditScopeKinds];

export const AuditResourceSensitivityClasses = Object.freeze({
  standard: "standard",
  sensitive: "sensitive",
  protected: "protected",
});

export type AuditResourceSensitivityClass =
  typeof AuditResourceSensitivityClasses[keyof typeof AuditResourceSensitivityClasses];

export const AuditRetentionPostures = Object.freeze({
  operational: "operational",
  governance: "governance",
  legalHold: "legal-hold",
});

export type AuditRetentionPosture = typeof AuditRetentionPostures[keyof typeof AuditRetentionPostures];

export const AuditRetentionAnchorKinds = Object.freeze({
  occurredAt: "occurred-at",
  recordedAt: "recorded-at",
});

export type AuditRetentionAnchorKind = typeof AuditRetentionAnchorKinds[keyof typeof AuditRetentionAnchorKinds];

export const AuditLifecycleStates = Object.freeze({
  active: "active",
  retentionHold: "retention-hold",
  archiveCandidate: "archive-candidate",
  archived: "archived",
});

export type AuditLifecycleState = typeof AuditLifecycleStates[keyof typeof AuditLifecycleStates];

export const AuditImmutabilityPostures = Object.freeze({
  appendOnly: "append-only",
  appendOnlyHashChained: "append-only-hash-chained",
});

export type AuditImmutabilityPosture =
  typeof AuditImmutabilityPostures[keyof typeof AuditImmutabilityPostures];

export const AuditRedactionReasons = Object.freeze({
  secretMaterial: "secret-material",
  token: "token",
  credential: "credential",
  personalData: "personal-data",
  internalOnlyDiagnostic: "internal-only-diagnostic",
});

export type AuditRedactionReason = typeof AuditRedactionReasons[keyof typeof AuditRedactionReasons];

export interface AuditActorIdentity {
  readonly actorId: string;
  readonly actorKind: AuditActorKind;
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly actorSessionId?: string;
}

export interface AuditScope {
  readonly kind: AuditScopeKind;
  readonly workspaceId?: string;
}

export interface AuditProtectedResourceReference {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly sensitivityClass: AuditResourceSensitivityClass;
  readonly workspaceId?: string;
}

export interface AuditRelatedResourceReference {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly relationship: string;
  readonly workspaceId?: string;
}

export interface AuditEventLinkageMetadata {
  readonly eventGroupId?: string;
  readonly parentEventId?: string;
  readonly rootEventId?: string;
  readonly workflowId?: string;
  readonly sessionRef?: string;
  readonly runId?: string;
  readonly governanceActionId?: string;
  readonly relatedResources?: ReadonlyArray<AuditRelatedResourceReference>;
}

export interface AuditIntegrityEvidence {
  readonly schemaVersion: string;
  readonly hashAlgorithm: string;
  readonly eventDigest?: string;
  readonly previousEventDigest?: string;
}

export interface AuditEventPayloadBoundary {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<AuditRedactionReason>;
}

export interface AuditRetentionLifecycleMetadata {
  readonly policyKey?: string;
  readonly policyVersion?: string;
  readonly retentionAnchor: AuditRetentionAnchorKind;
  readonly retainUntil?: string;
  readonly archiveAfter?: string;
  readonly lifecycleState: AuditLifecycleState;
  readonly lifecycleUpdatedAt?: string;
}

export interface CanonicalAuditEvent {
  readonly recordKind: typeof AuditRecordKinds.auditRecord;
  readonly eventId: string;
  readonly eventType: string;
  readonly category: AuditEventCategory;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly actor: AuditActorIdentity;
  readonly scope: AuditScope;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly payload: AuditEventPayloadBoundary;
  readonly integrity: AuditIntegrityEvidence;
  readonly retention: AuditRetentionPosture;
  readonly retentionMetadata?: AuditRetentionLifecycleMetadata;
  readonly immutability: AuditImmutabilityPosture;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly linkage?: AuditEventLinkageMetadata;
}

export interface UserSafeAuditEventView {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: AuditEventCategory;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly actorId: string;
  readonly actorKind: AuditActorKind;
  readonly scope: AuditScope;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly linkage?: AuditEventLinkageMetadata;
  readonly retentionMetadata?: AuditRetentionLifecycleMetadata;
  readonly details?: Readonly<Record<string, unknown>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuditDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string | Date, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new AuditDomainError(`${field} must be a valid timestamp.`);
  }
  return date.toISOString();
}

function normalizeOptionalTimestamp(value: string | Date | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return normalizeTimestamp(value, field);
}

function freezeRecord(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...input });
}

function normalizeOptionalArray<TInput, TOutput>(
  values: ReadonlyArray<TInput> | undefined,
  mapValue: (value: TInput) => TOutput | undefined,
): ReadonlyArray<TOutput> | undefined {
  if (!values || values.length < 1) {
    return undefined;
  }

  const normalized: TOutput[] = [];
  for (const value of values) {
    const mapped = mapValue(value);
    if (mapped) {
      normalized.push(mapped);
    }
  }

  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function isKnownValue<TValue extends string>(
  dictionary: Readonly<Record<string, TValue>>,
  value: string,
): value is TValue {
  return Object.values(dictionary).includes(value as TValue);
}

export function createAuditActorIdentity(input: AuditActorIdentity): AuditActorIdentity {
  const actorKind = input.actorKind;
  if (!isKnownValue(AuditActorKinds, actorKind)) {
    throw new AuditDomainError(`Audit actor kind '${String(actorKind)}' is invalid.`);
  }

  const actorId = normalizeRequired(input.actorId, "Audit actorId");
  const actorUserIdentityId = normalizeOptional(input.actorUserIdentityId);
  const actorServiceId = normalizeOptional(input.actorServiceId);
  const actorSessionId = normalizeOptional(input.actorSessionId);

  if (actorKind === AuditActorKinds.user && !actorUserIdentityId) {
    throw new AuditDomainError("User audit actor kind requires actorUserIdentityId.");
  }
  if (actorKind === AuditActorKinds.service && !actorServiceId) {
    throw new AuditDomainError("Service audit actor kind requires actorServiceId.");
  }

  if (!actorUserIdentityId && !actorServiceId && actorKind !== AuditActorKinds.system) {
    throw new AuditDomainError("Audit actor identity requires actorUserIdentityId or actorServiceId.");
  }

  return Object.freeze({
    actorId,
    actorKind,
    actorUserIdentityId,
    actorServiceId,
    actorSessionId,
  });
}

export function createAuditScope(input: AuditScope): AuditScope {
  const kind = input.kind;
  if (!isKnownValue(AuditScopeKinds, kind)) {
    throw new AuditDomainError(`Audit scope kind '${String(kind)}' is invalid.`);
  }

  const workspaceId = normalizeOptional(input.workspaceId);
  if (kind === AuditScopeKinds.workspace && !workspaceId) {
    throw new AuditDomainError("Workspace audit scope requires workspaceId.");
  }
  if (kind === AuditScopeKinds.global && workspaceId) {
    throw new AuditDomainError("Global audit scope cannot include workspaceId.");
  }

  return Object.freeze({
    kind,
    workspaceId,
  });
}

export function createAuditProtectedResourceReference(
  input: AuditProtectedResourceReference,
): AuditProtectedResourceReference {
  const sensitivityClass = input.sensitivityClass;
  if (!isKnownValue(AuditResourceSensitivityClasses, sensitivityClass)) {
    throw new AuditDomainError(`Audit sensitivity class '${String(sensitivityClass)}' is invalid.`);
  }

  return Object.freeze({
    resourceType: normalizeRequired(input.resourceType, "Audit protected resource type"),
    resourceId: normalizeRequired(input.resourceId, "Audit protected resource id"),
    resourceRef: normalizeRequired(input.resourceRef, "Audit protected resource ref"),
    sensitivityClass,
    workspaceId: normalizeOptional(input.workspaceId),
  });
}

export function createAuditIntegrityEvidence(input: AuditIntegrityEvidence): AuditIntegrityEvidence {
  return Object.freeze({
    schemaVersion: normalizeRequired(input.schemaVersion, "Audit integrity schemaVersion"),
    hashAlgorithm: normalizeRequired(input.hashAlgorithm, "Audit integrity hashAlgorithm"),
    eventDigest: normalizeOptional(input.eventDigest),
    previousEventDigest: normalizeOptional(input.previousEventDigest),
  });
}

export function createAuditRelatedResourceReference(
  input: AuditRelatedResourceReference,
): AuditRelatedResourceReference {
  return Object.freeze({
    resourceType: normalizeRequired(input.resourceType, "Audit related resource type"),
    resourceId: normalizeRequired(input.resourceId, "Audit related resource id"),
    resourceRef: normalizeRequired(input.resourceRef, "Audit related resource ref"),
    relationship: normalizeRequired(input.relationship, "Audit related resource relationship"),
    workspaceId: normalizeOptional(input.workspaceId),
  });
}

export function createAuditEventLinkageMetadata(
  input?: AuditEventLinkageMetadata,
): AuditEventLinkageMetadata | undefined {
  if (!input) {
    return undefined;
  }

  const eventGroupId = normalizeOptional(input.eventGroupId);
  const parentEventId = normalizeOptional(input.parentEventId);
  const rootEventId = normalizeOptional(input.rootEventId);
  const workflowId = normalizeOptional(input.workflowId);
  const sessionRef = normalizeOptional(input.sessionRef);
  const runId = normalizeOptional(input.runId);
  const governanceActionId = normalizeOptional(input.governanceActionId);
  const relatedResources = normalizeOptionalArray(
    input.relatedResources,
    (value) => createAuditRelatedResourceReference(value),
  );

  if (
    !eventGroupId
    && !parentEventId
    && !rootEventId
    && !workflowId
    && !sessionRef
    && !runId
    && !governanceActionId
    && !relatedResources
  ) {
    return undefined;
  }

  if (rootEventId && rootEventId === parentEventId) {
    throw new AuditDomainError("Audit linkage rootEventId and parentEventId cannot be identical.");
  }

  return Object.freeze({
    eventGroupId,
    parentEventId,
    rootEventId,
    workflowId,
    sessionRef,
    runId,
    governanceActionId,
    relatedResources,
  });
}

export function createAuditEventPayloadBoundary(input?: {
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData?: boolean;
  readonly redactionReasons?: ReadonlyArray<AuditRedactionReason>;
}): AuditEventPayloadBoundary {
  const userSafeDetails = input?.userSafeDetails ? freezeRecord(input.userSafeDetails) : undefined;
  const adminOnlyDetails = input?.adminOnlyDetails ? freezeRecord(input.adminOnlyDetails) : undefined;

  const duplicateKeys = new Set<string>();
  if (userSafeDetails && adminOnlyDetails) {
    for (const key of Object.keys(userSafeDetails)) {
      if (Object.prototype.hasOwnProperty.call(adminOnlyDetails, key)) {
        duplicateKeys.add(key);
      }
    }
  }

  if (duplicateKeys.size > 0) {
    throw new AuditDomainError(
      `Audit payload boundaries cannot reuse keys between userSafeDetails and adminOnlyDetails: ${[...duplicateKeys].join(", ")}`,
    );
  }

  const redactionReasons = (input?.redactionReasons ?? [])
    .map((reason) => reason)
    .filter((reason, index, values) => values.indexOf(reason) === index);

  for (const reason of redactionReasons) {
    if (!isKnownValue(AuditRedactionReasons, reason)) {
      throw new AuditDomainError(`Audit redaction reason '${String(reason)}' is invalid.`);
    }
  }

  const hasProtectedData = input?.hasProtectedData ?? Boolean(adminOnlyDetails && Object.keys(adminOnlyDetails).length > 0);
  if (hasProtectedData && redactionReasons.length === 0) {
    throw new AuditDomainError("Audit payload with protected data requires at least one redaction reason.");
  }

  return Object.freeze({
    userSafeDetails,
    adminOnlyDetails,
    hasProtectedData,
    redactionReasons: Object.freeze(redactionReasons),
  });
}

export function createAuditRetentionLifecycleMetadata(input: {
  readonly policyKey?: string;
  readonly policyVersion?: string;
  readonly retentionAnchor?: AuditRetentionAnchorKind;
  readonly retainUntil?: string | Date;
  readonly archiveAfter?: string | Date;
  readonly lifecycleState?: AuditLifecycleState;
  readonly lifecycleUpdatedAt?: string | Date;
  readonly retentionPosture?: AuditRetentionPosture;
  readonly occurredAt?: string | Date;
  readonly recordedAt?: string | Date;
}): AuditRetentionLifecycleMetadata | undefined {
  const policyKey = normalizeOptional(input.policyKey);
  const policyVersion = normalizeOptional(input.policyVersion);
  const retentionAnchor = input.retentionAnchor ?? AuditRetentionAnchorKinds.occurredAt;
  if (!isKnownValue(AuditRetentionAnchorKinds, retentionAnchor)) {
    throw new AuditDomainError(`Audit retention anchor '${String(retentionAnchor)}' is invalid.`);
  }

  const retainUntil = normalizeOptionalTimestamp(input.retainUntil, "Audit retentionMetadata.retainUntil");
  const archiveAfter = normalizeOptionalTimestamp(input.archiveAfter, "Audit retentionMetadata.archiveAfter");
  if (retainUntil && archiveAfter && Date.parse(archiveAfter) < Date.parse(retainUntil)) {
    throw new AuditDomainError("Audit retentionMetadata.archiveAfter cannot be earlier than retainUntil.");
  }

  const defaultLifecycleState = input.retentionPosture === AuditRetentionPostures.legalHold
    ? AuditLifecycleStates.retentionHold
    : AuditLifecycleStates.active;
  const lifecycleState = input.lifecycleState ?? defaultLifecycleState;
  if (!isKnownValue(AuditLifecycleStates, lifecycleState)) {
    throw new AuditDomainError(`Audit lifecycle state '${String(lifecycleState)}' is invalid.`);
  }

  const lifecycleUpdatedAt = normalizeOptionalTimestamp(
    input.lifecycleUpdatedAt,
    "Audit retentionMetadata.lifecycleUpdatedAt",
  );

  if (!policyKey && !policyVersion && !retainUntil && !archiveAfter && !lifecycleUpdatedAt) {
    if (
      lifecycleState === defaultLifecycleState
      && (input.retentionAnchor === undefined || retentionAnchor === AuditRetentionAnchorKinds.occurredAt)
    ) {
      return undefined;
    }
  }

  return Object.freeze({
    policyKey,
    policyVersion,
    retentionAnchor,
    retainUntil,
    archiveAfter,
    lifecycleState,
    lifecycleUpdatedAt: lifecycleUpdatedAt
      ?? normalizeOptionalTimestamp(input.recordedAt, "Audit recordedAt")
      ?? normalizeOptionalTimestamp(input.occurredAt, "Audit occurredAt"),
  });
}

export function createCanonicalAuditEvent(input: {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: AuditEventCategory;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string | Date;
  readonly recordedAt?: string | Date;
  readonly actor: AuditActorIdentity;
  readonly scope: AuditScope;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly payload?: {
    readonly userSafeDetails?: Readonly<Record<string, unknown>>;
    readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
    readonly hasProtectedData?: boolean;
    readonly redactionReasons?: ReadonlyArray<AuditRedactionReason>;
  };
  readonly integrity: AuditIntegrityEvidence;
  readonly retention?: AuditRetentionPosture;
  readonly retentionMetadata?: {
    readonly policyKey?: string;
    readonly policyVersion?: string;
    readonly retentionAnchor?: AuditRetentionAnchorKind;
    readonly retainUntil?: string | Date;
    readonly archiveAfter?: string | Date;
    readonly lifecycleState?: AuditLifecycleState;
    readonly lifecycleUpdatedAt?: string | Date;
  };
  readonly immutability?: AuditImmutabilityPosture;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly linkage?: AuditEventLinkageMetadata;
}): CanonicalAuditEvent {
  const category = input.category;
  if (!isKnownValue(AuditEventCategories, category)) {
    throw new AuditDomainError(`Audit category '${String(category)}' is invalid.`);
  }

  const outcome = input.outcome;
  if (!isKnownValue(AuditEventOutcomes, outcome)) {
    throw new AuditDomainError(`Audit outcome '${String(outcome)}' is invalid.`);
  }

  const occurredAt = normalizeTimestamp(input.occurredAt, "Audit occurredAt");
  const recordedAt = normalizeTimestamp(input.recordedAt ?? occurredAt, "Audit recordedAt");
  if (Date.parse(recordedAt) < Date.parse(occurredAt)) {
    throw new AuditDomainError("Audit recordedAt cannot be earlier than occurredAt.");
  }

  const scope = createAuditScope(input.scope);
  const actor = createAuditActorIdentity(input.actor);
  const protectedResource = input.protectedResource
    ? createAuditProtectedResourceReference(input.protectedResource)
    : undefined;

  if (
    protectedResource?.workspaceId
    && scope.kind === AuditScopeKinds.workspace
    && protectedResource.workspaceId !== scope.workspaceId
  ) {
    throw new AuditDomainError("Audit protected resource workspaceId must match event scope workspaceId.");
  }

  const payload = createAuditEventPayloadBoundary(input.payload);
  const integrity = createAuditIntegrityEvidence(input.integrity);
  const linkage = createAuditEventLinkageMetadata(input.linkage);

  const retention = input.retention ?? AuditRetentionPostures.governance;
  if (!isKnownValue(AuditRetentionPostures, retention)) {
    throw new AuditDomainError(`Audit retention posture '${String(retention)}' is invalid.`);
  }
  const retentionMetadata = createAuditRetentionLifecycleMetadata({
    ...input.retentionMetadata,
    retentionPosture: retention,
    occurredAt,
    recordedAt,
  });

  const immutability = input.immutability ?? AuditImmutabilityPostures.appendOnly;
  if (!isKnownValue(AuditImmutabilityPostures, immutability)) {
    throw new AuditDomainError(`Audit immutability posture '${String(immutability)}' is invalid.`);
  }

  return Object.freeze({
    recordKind: AuditRecordKinds.auditRecord,
    eventId: normalizeRequired(input.eventId, "Audit eventId"),
    eventType: normalizeRequired(input.eventType, "Audit eventType"),
    category,
    action: normalizeRequired(input.action, "Audit action"),
    outcome,
    occurredAt,
    recordedAt,
    actor,
    scope,
    protectedResource,
    payload,
    integrity,
    retention,
    retentionMetadata,
    immutability,
    correlationId: normalizeOptional(input.correlationId),
    requestId: normalizeOptional(input.requestId),
    linkage,
  });
}

export function toUserSafeAuditEventView(event: CanonicalAuditEvent): UserSafeAuditEventView {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    category: event.category,
    action: event.action,
    outcome: event.outcome,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    actorId: event.actor.actorId,
    actorKind: event.actor.actorKind,
    scope: event.scope,
    protectedResource: event.protectedResource,
    linkage: event.linkage,
    retentionMetadata: event.retentionMetadata,
    details: event.payload.userSafeDetails,
  });
}

export function isCanonicalAuditRecordKind(value: string): value is typeof AuditRecordKinds.auditRecord {
  return value === AuditRecordKinds.auditRecord;
}

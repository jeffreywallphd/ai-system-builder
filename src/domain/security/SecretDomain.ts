export class SecretDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretDomainError";
  }
}

export const SecretScopes = Object.freeze({
  server: "server",
  workspace: "workspace",
  user: "user",
});

export type SecretScope = typeof SecretScopes[keyof typeof SecretScopes];

export const SecretKinds = Object.freeze({
  apiKey: "api-key",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  password: "password",
  privateKey: "private-key",
  certificate: "certificate",
  connectionString: "connection-string",
  generic: "generic",
});

export type SecretKind = typeof SecretKinds[keyof typeof SecretKinds];

export const SecretRecordStates = Object.freeze({
  active: "active",
  disabled: "disabled",
  revoked: "revoked",
  deleted: "deleted",
});

export type SecretRecordState = typeof SecretRecordStates[keyof typeof SecretRecordStates];

export const SecretVersionStates = Object.freeze({
  active: "active",
  superseded: "superseded",
  revoked: "revoked",
});

export type SecretVersionState = typeof SecretVersionStates[keyof typeof SecretVersionStates];

export interface SecretScopeOwner {
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretProtectionPolicy {
  readonly keyEncryptionRequired: boolean;
  readonly envelopeAlgorithm: string;
  readonly encryptedAtRest: boolean;
  readonly requireRotation: boolean;
  readonly maxVersionAgeDays?: number;
  readonly allowRuntimePlaintextRetrieval: boolean;
}

export interface KeyEncryptionContext {
  readonly keyId: string;
  readonly algorithm: string;
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly keyVersion?: string;
}

export interface SecretReferenceMetadata {
  readonly displayName?: string;
  readonly description?: string;
  readonly tags: ReadonlyArray<string>;
  readonly labels: Readonly<Record<string, string>>;
}

export interface SecretVersion {
  readonly versionId: string;
  readonly secretId: string;
  readonly version: number;
  readonly state: SecretVersionState;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly supersededByVersionId?: string;
  readonly previousVersionId?: string;
  readonly encryptedPayloadRef: string;
  readonly payloadDigestSha256: string;
  readonly payloadByteLength: number;
  readonly keyEncryptionContext: KeyEncryptionContext;
}

export interface SecretRecord {
  readonly secretId: string;
  readonly reference: SecretReference;
  readonly owner: SecretScopeOwner;
  readonly kind: SecretKind;
  readonly state: SecretRecordState;
  readonly protectionPolicy: SecretProtectionPolicy;
  readonly versions: ReadonlyArray<SecretVersion>;
  readonly currentVersionId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly disabledAt?: string;
  readonly disabledBy?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface SecretReference {
  readonly secretId: string;
  readonly name: string;
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly kind: SecretKind;
  readonly state: SecretRecordState;
  readonly currentVersionId?: string;
  readonly metadata: SecretReferenceMetadata;
  readonly updatedAt: string;
}

export const SecretAccessActions = Object.freeze({
  create: "create",
  readMetadata: "read-metadata",
  retrievePlaintext: "retrieve-plaintext",
  rotate: "rotate",
  disable: "disable",
  delete: "delete",
  list: "list",
});

export type SecretAccessAction = typeof SecretAccessActions[keyof typeof SecretAccessActions];

export const SecretActorTypes = Object.freeze({
  serverRuntime: "server-runtime",
  serverAdmin: "server-admin",
  workspaceService: "workspace-service",
  workspaceMember: "workspace-member",
  user: "user",
});

export type SecretActorType = typeof SecretActorTypes[keyof typeof SecretActorTypes];

export interface SecretAccessActor {
  readonly actorId: string;
  readonly actorType: SecretActorType;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly grantedActions: ReadonlyArray<SecretAccessAction>;
}

export const SecretAccessDecisionReasons = Object.freeze({
  allowed: "allowed",
  missingPermission: "missing-permission",
  scopeMismatch: "scope-mismatch",
  recordDisabled: "record-disabled",
  recordRevoked: "record-revoked",
  recordDeleted: "record-deleted",
  plaintextRetrievalDisabled: "plaintext-retrieval-disabled",
  runtimeAccessRequired: "runtime-access-required",
  administrativeAccessRequired: "administrative-access-required",
  actorTypeNotAllowed: "actor-type-not-allowed",
});

export type SecretAccessDecisionReason =
  typeof SecretAccessDecisionReasons[keyof typeof SecretAccessDecisionReasons];

export interface SecretAccessDecision {
  readonly allowed: boolean;
  readonly reason: SecretAccessDecisionReason;
  readonly action: SecretAccessAction;
  readonly actorId: string;
  readonly secretId?: string;
  readonly scope: SecretScope;
  readonly occurredAt: string;
  readonly auditEvent: "secret-access-allowed" | "secret-access-denied";
}

const SecretNamePattern = /^[a-z][a-z0-9._-]{1,126}$/;
const SensitiveMetadataKeyPattern = /(secret|password|token|credential|private|key|pem|csr)/i;
const PemLikeValuePattern = /-----BEGIN\s+[A-Z0-9\s-]+-----/i;

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new SecretDomainError(`${field} is required.`);
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
    throw new SecretDomainError(`${field} must be a valid timestamp.`);
  }
  return date.toISOString();
}

function assertScopeOwnerValidity(owner: SecretScopeOwner): void {
  if (!Object.values(SecretScopes).includes(owner.scope)) {
    throw new SecretDomainError(`Secret scope '${String(owner.scope)}' is invalid.`);
  }

  const workspaceId = normalizeOptional(owner.workspaceId);
  const userIdentityId = normalizeOptional(owner.userIdentityId);

  if (owner.scope === SecretScopes.server) {
    if (workspaceId || userIdentityId) {
      throw new SecretDomainError("Server-scoped secrets cannot include workspaceId or userIdentityId.");
    }
    return;
  }

  if (owner.scope === SecretScopes.workspace) {
    if (!workspaceId) {
      throw new SecretDomainError("Workspace-scoped secrets require workspaceId.");
    }
    if (userIdentityId) {
      throw new SecretDomainError("Workspace-scoped secrets cannot include userIdentityId.");
    }
    return;
  }

  if (!userIdentityId) {
    throw new SecretDomainError("User-scoped secrets require userIdentityId.");
  }
}

function normalizeSecretName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SecretNamePattern.test(normalized)) {
    throw new SecretDomainError(
      "Secret name must start with a lowercase letter and contain only lowercase letters, numbers, '.', '_' or '-'.",
    );
  }
  return normalized;
}

function normalizeMetadata(input?: {
  readonly displayName?: string;
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly labels?: Readonly<Record<string, string>>;
}): SecretReferenceMetadata {
  const tags = new Set<string>();
  for (const tag of input?.tags ?? []) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) {
      tags.add(normalized);
    }
  }

  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(input?.labels ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    if (SensitiveMetadataKeyPattern.test(normalizedKey)) {
      throw new SecretDomainError(`Metadata label key '${normalizedKey}' is not redaction-safe.`);
    }
    if (PemLikeValuePattern.test(normalizedValue)) {
      throw new SecretDomainError(`Metadata label '${normalizedKey}' contains secret-like content.`);
    }
    labels[normalizedKey] = normalizedValue;
  }

  return Object.freeze({
    displayName: normalizeOptional(input?.displayName),
    description: normalizeOptional(input?.description),
    tags: Object.freeze([...tags.values()]),
    labels: Object.freeze(labels),
  });
}

function normalizeProtectionPolicy(input?: Partial<SecretProtectionPolicy>): SecretProtectionPolicy {
  const maxVersionAgeDays = input?.maxVersionAgeDays;
  if (maxVersionAgeDays !== undefined && (!Number.isInteger(maxVersionAgeDays) || maxVersionAgeDays < 1)) {
    throw new SecretDomainError("Secret protection policy maxVersionAgeDays must be an integer >= 1 when provided.");
  }

  const envelopeAlgorithm = normalizeRequired(
    input?.envelopeAlgorithm ?? "aes-256-gcm",
    "Secret protection policy envelopeAlgorithm",
  );

  return Object.freeze({
    keyEncryptionRequired: input?.keyEncryptionRequired ?? true,
    envelopeAlgorithm,
    encryptedAtRest: input?.encryptedAtRest ?? true,
    requireRotation: input?.requireRotation ?? true,
    maxVersionAgeDays,
    allowRuntimePlaintextRetrieval: input?.allowRuntimePlaintextRetrieval ?? true,
  });
}

function normalizeKeyEncryptionContext(
  input: KeyEncryptionContext,
  owner: SecretScopeOwner,
): KeyEncryptionContext {
  const scope: SecretScopeOwner = Object.freeze({
    scope: input.scope,
    workspaceId: normalizeOptional(input.workspaceId),
    userIdentityId: normalizeOptional(input.userIdentityId),
  });
  assertScopeOwnerValidity(scope);

  if (scope.scope !== owner.scope) {
    throw new SecretDomainError("Key encryption context scope must match secret owner scope.");
  }
  if ((scope.workspaceId ?? undefined) !== (normalizeOptional(owner.workspaceId) ?? undefined)) {
    throw new SecretDomainError("Key encryption context workspaceId must match secret owner workspaceId.");
  }
  if ((scope.userIdentityId ?? undefined) !== (normalizeOptional(owner.userIdentityId) ?? undefined)) {
    throw new SecretDomainError("Key encryption context userIdentityId must match secret owner userIdentityId.");
  }

  return Object.freeze({
    keyId: normalizeRequired(input.keyId, "Key encryption context keyId"),
    algorithm: normalizeRequired(input.algorithm, "Key encryption context algorithm"),
    scope: scope.scope,
    workspaceId: scope.workspaceId,
    userIdentityId: scope.userIdentityId,
    keyVersion: normalizeOptional(input.keyVersion),
  });
}

function normalizeVersionState(state?: SecretVersionState): SecretVersionState {
  const resolved = state ?? SecretVersionStates.active;
  if (!Object.values(SecretVersionStates).includes(resolved)) {
    throw new SecretDomainError(`Secret version state '${String(state)}' is invalid.`);
  }
  return resolved;
}

function normalizeRecordState(state?: SecretRecordState): SecretRecordState {
  const resolved = state ?? SecretRecordStates.active;
  if (!Object.values(SecretRecordStates).includes(resolved)) {
    throw new SecretDomainError(`Secret record state '${String(state)}' is invalid.`);
  }
  return resolved;
}

function normalizeSecretKind(kind: SecretKind): SecretKind {
  if (!Object.values(SecretKinds).includes(kind)) {
    throw new SecretDomainError(`Secret kind '${String(kind)}' is invalid.`);
  }
  return kind;
}

function sortVersions(versions: ReadonlyArray<SecretVersion>): ReadonlyArray<SecretVersion> {
  return Object.freeze([...versions].sort((left, right) => left.version - right.version));
}

function assertVersionLineage(versions: ReadonlyArray<SecretVersion>): void {
  const ordered = sortVersions(versions);
  const byId = new Map(ordered.map((version) => [version.versionId, version]));

  for (const version of ordered) {
    if (!Number.isInteger(version.version) || version.version < 1) {
      throw new SecretDomainError(`Secret version '${version.versionId}' must have version >= 1.`);
    }

    if (version.version === 1 && version.previousVersionId) {
      throw new SecretDomainError("First secret version cannot define previousVersionId.");
    }

    if (version.version > 1 && !version.previousVersionId) {
      throw new SecretDomainError(`Secret version '${version.versionId}' must reference previousVersionId.`);
    }

    if (version.previousVersionId) {
      if (version.previousVersionId === version.versionId) {
        throw new SecretDomainError("Secret version previousVersionId cannot self-reference versionId.");
      }
      if (!byId.has(version.previousVersionId)) {
        throw new SecretDomainError(`Secret version '${version.versionId}' references unknown previousVersionId.`);
      }
    }
  }

  const active = ordered.filter((version) => version.state === SecretVersionStates.active);
  if (active.length > 1) {
    throw new SecretDomainError("Secret records may contain at most one active version.");
  }
}

export function createSecretScopeOwner(input: SecretScopeOwner): SecretScopeOwner {
  const owner: SecretScopeOwner = Object.freeze({
    scope: input.scope,
    workspaceId: normalizeOptional(input.workspaceId),
    userIdentityId: normalizeOptional(input.userIdentityId),
  });
  assertScopeOwnerValidity(owner);
  return owner;
}

export function createSecretProtectionPolicy(input?: Partial<SecretProtectionPolicy>): SecretProtectionPolicy {
  return normalizeProtectionPolicy(input);
}

export function createSecretVersion(input: {
  readonly versionId: string;
  readonly secretId: string;
  readonly version: number;
  readonly state?: SecretVersionState;
  readonly createdAt?: string | Date;
  readonly createdBy: string;
  readonly supersededByVersionId?: string;
  readonly previousVersionId?: string;
  readonly encryptedPayloadRef: string;
  readonly payloadDigestSha256: string;
  readonly payloadByteLength: number;
  readonly keyEncryptionContext: KeyEncryptionContext;
  readonly owner: SecretScopeOwner;
}): SecretVersion {
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new SecretDomainError("Secret version number must be an integer >= 1.");
  }

  if (!Number.isInteger(input.payloadByteLength) || input.payloadByteLength < 0) {
    throw new SecretDomainError("Secret version payloadByteLength must be a non-negative integer.");
  }

  return Object.freeze({
    versionId: normalizeRequired(input.versionId, "Secret versionId"),
    secretId: normalizeRequired(input.secretId, "Secret version secretId"),
    version: input.version,
    state: normalizeVersionState(input.state),
    createdAt: normalizeTimestamp(input.createdAt ?? new Date(), "Secret version createdAt"),
    createdBy: normalizeRequired(input.createdBy, "Secret version createdBy"),
    supersededByVersionId: normalizeOptional(input.supersededByVersionId),
    previousVersionId: normalizeOptional(input.previousVersionId),
    encryptedPayloadRef: normalizeRequired(input.encryptedPayloadRef, "Secret encryptedPayloadRef"),
    payloadDigestSha256: normalizeRequired(input.payloadDigestSha256, "Secret payloadDigestSha256"),
    payloadByteLength: input.payloadByteLength,
    keyEncryptionContext: normalizeKeyEncryptionContext(input.keyEncryptionContext, input.owner),
  });
}

export function createSecretRecord(input: {
  readonly secretId: string;
  readonly name: string;
  readonly owner: SecretScopeOwner;
  readonly kind: SecretKind;
  readonly protectionPolicy?: Partial<SecretProtectionPolicy>;
  readonly metadata?: {
    readonly displayName?: string;
    readonly description?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly labels?: Readonly<Record<string, string>>;
  };
  readonly initialVersion: Omit<Parameters<typeof createSecretVersion>[0], "secretId" | "version" | "owner" | "previousVersionId">;
  readonly createdAt?: string | Date;
  readonly createdBy: string;
}): SecretRecord {
  const owner = createSecretScopeOwner(input.owner);
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Secret record createdAt");
  const secretId = normalizeRequired(input.secretId, "Secret record secretId");

  const version = createSecretVersion({
    ...input.initialVersion,
    secretId,
    version: 1,
    owner,
    previousVersionId: undefined,
  });

  const kind = normalizeSecretKind(input.kind);
  const metadata = normalizeMetadata(input.metadata);

  const record: SecretRecord = Object.freeze({
    secretId,
    reference: Object.freeze({
      secretId,
      name: normalizeSecretName(input.name),
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      kind,
      state: SecretRecordStates.active,
      currentVersionId: version.versionId,
      metadata,
      updatedAt: createdAt,
    }),
    owner,
    kind,
    state: SecretRecordStates.active,
    protectionPolicy: normalizeProtectionPolicy(input.protectionPolicy),
    versions: Object.freeze([version]),
    currentVersionId: version.versionId,
    createdAt,
    createdBy: normalizeRequired(input.createdBy, "Secret record createdBy"),
    lastModifiedAt: createdAt,
    lastModifiedBy: normalizeRequired(input.createdBy, "Secret record lastModifiedBy"),
  });

  assertVersionLineage(record.versions);
  return record;
}

export function rotateSecretRecord(input: {
  readonly record: SecretRecord;
  readonly nextVersion: Omit<Parameters<typeof createSecretVersion>[0], "secretId" | "version" | "owner" | "previousVersionId">;
  readonly rotatedBy: string;
  readonly rotatedAt?: string | Date;
}): SecretRecord {
  if (input.record.state !== SecretRecordStates.active) {
    throw new SecretDomainError(`Secret '${input.record.secretId}' cannot rotate while state is '${input.record.state}'.`);
  }

  const nextVersionNumber = input.record.versions.length + 1;
  const nextVersion = createSecretVersion({
    ...input.nextVersion,
    secretId: input.record.secretId,
    version: nextVersionNumber,
    owner: input.record.owner,
    previousVersionId: input.record.currentVersionId,
  });

  const rotatedAt = normalizeTimestamp(input.rotatedAt ?? new Date(), "Secret rotation rotatedAt");
  const priorVersions = input.record.versions.map((version) => {
    if (version.versionId !== input.record.currentVersionId) {
      return version;
    }

    return Object.freeze({
      ...version,
      state: SecretVersionStates.superseded,
      supersededByVersionId: nextVersion.versionId,
    });
  });

  const versions = Object.freeze([...priorVersions, nextVersion]);
  assertVersionLineage(versions);

  return Object.freeze({
    ...input.record,
    versions,
    currentVersionId: nextVersion.versionId,
    lastModifiedAt: rotatedAt,
    lastModifiedBy: normalizeRequired(input.rotatedBy, "Secret rotation rotatedBy"),
    reference: Object.freeze({
      ...input.record.reference,
      state: input.record.state,
      currentVersionId: nextVersion.versionId,
      updatedAt: rotatedAt,
    }),
  });
}

export function disableSecretRecord(input: {
  readonly record: SecretRecord;
  readonly disabledBy: string;
  readonly disabledAt?: string | Date;
}): SecretRecord {
  if (input.record.state === SecretRecordStates.deleted) {
    throw new SecretDomainError("Deleted secrets cannot be disabled.");
  }

  const disabledAt = normalizeTimestamp(input.disabledAt ?? new Date(), "Secret disable disabledAt");
  return Object.freeze({
    ...input.record,
    state: SecretRecordStates.disabled,
    disabledAt,
    disabledBy: normalizeRequired(input.disabledBy, "Secret disable disabledBy"),
    lastModifiedAt: disabledAt,
    lastModifiedBy: normalizeRequired(input.disabledBy, "Secret disable lastModifiedBy"),
    reference: Object.freeze({
      ...input.record.reference,
      state: SecretRecordStates.disabled,
      updatedAt: disabledAt,
    }),
  });
}

export function revokeSecretRecord(input: {
  readonly record: SecretRecord;
  readonly revokedBy: string;
  readonly revokedAt?: string | Date;
}): SecretRecord {
  if (input.record.state === SecretRecordStates.deleted) {
    throw new SecretDomainError("Deleted secrets cannot be revoked.");
  }

  const revokedAt = normalizeTimestamp(input.revokedAt ?? new Date(), "Secret revoke revokedAt");
  const versions = Object.freeze(input.record.versions.map((version) => Object.freeze({
    ...version,
    state: version.state === SecretVersionStates.active ? SecretVersionStates.revoked : version.state,
  })));

  return Object.freeze({
    ...input.record,
    state: SecretRecordStates.revoked,
    versions,
    revokedAt,
    revokedBy: normalizeRequired(input.revokedBy, "Secret revoke revokedBy"),
    lastModifiedAt: revokedAt,
    lastModifiedBy: normalizeRequired(input.revokedBy, "Secret revoke lastModifiedBy"),
    reference: Object.freeze({
      ...input.record.reference,
      state: SecretRecordStates.revoked,
      updatedAt: revokedAt,
    }),
  });
}

export function deleteSecretRecord(input: {
  readonly record: SecretRecord;
  readonly deletedBy: string;
  readonly deletedAt?: string | Date;
}): SecretRecord {
  const deletedAt = normalizeTimestamp(input.deletedAt ?? new Date(), "Secret delete deletedAt");

  return Object.freeze({
    ...input.record,
    state: SecretRecordStates.deleted,
    deletedAt,
    deletedBy: normalizeRequired(input.deletedBy, "Secret delete deletedBy"),
    lastModifiedAt: deletedAt,
    lastModifiedBy: normalizeRequired(input.deletedBy, "Secret delete lastModifiedBy"),
    reference: Object.freeze({
      ...input.record.reference,
      state: SecretRecordStates.deleted,
      updatedAt: deletedAt,
    }),
  });
}

function canActorAccessScope(actor: SecretAccessActor, owner: SecretScopeOwner): boolean {
  if (owner.scope === SecretScopes.server) {
    return actor.actorType === SecretActorTypes.serverAdmin || actor.actorType === SecretActorTypes.serverRuntime;
  }

  if (owner.scope === SecretScopes.workspace) {
    return Boolean(actor.workspaceId && actor.workspaceId === owner.workspaceId);
  }

  const userMatches = Boolean(actor.userIdentityId && actor.userIdentityId === owner.userIdentityId);
  if (!userMatches) {
    return false;
  }

  if (!owner.workspaceId) {
    return true;
  }

  return actor.workspaceId === owner.workspaceId;
}

export function evaluateSecretAccessDecision(input: {
  readonly action: SecretAccessAction;
  readonly actor: SecretAccessActor;
  readonly owner: SecretScopeOwner;
  readonly record?: Pick<SecretRecord, "secretId" | "state" | "protectionPolicy">;
  readonly occurredAt?: string | Date;
}): SecretAccessDecision {
  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Secret access occurredAt");
  const action = input.action;

  if (!Object.values(SecretAccessActions).includes(action)) {
    throw new SecretDomainError(`Secret access action '${String(action)}' is invalid.`);
  }

  if (!input.actor.grantedActions.includes(action)) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.missingPermission,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record?.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  if (!canActorAccessScope(input.actor, input.owner)) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.scopeMismatch,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record?.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  if (input.record?.state === SecretRecordStates.disabled) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.recordDisabled,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  if (input.record?.state === SecretRecordStates.revoked) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.recordRevoked,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  if (input.record?.state === SecretRecordStates.deleted) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.recordDeleted,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  if (
    action === SecretAccessActions.retrievePlaintext
    && input.record
    && !input.record.protectionPolicy.allowRuntimePlaintextRetrieval
  ) {
    return Object.freeze({
      allowed: false,
      reason: SecretAccessDecisionReasons.plaintextRetrievalDisabled,
      action,
      actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
      secretId: input.record.secretId,
      scope: input.owner.scope,
      occurredAt,
      auditEvent: "secret-access-denied",
    });
  }

  return Object.freeze({
    allowed: true,
    reason: SecretAccessDecisionReasons.allowed,
    action,
    actorId: normalizeRequired(input.actor.actorId, "Secret access actorId"),
    secretId: input.record?.secretId,
    scope: input.owner.scope,
    occurredAt,
    auditEvent: "secret-access-allowed",
  });
}

export function toSecretReference(record: SecretRecord): SecretReference {
  return Object.freeze({
    secretId: record.secretId,
    name: record.reference.name,
    scope: record.owner.scope,
    workspaceId: record.owner.workspaceId,
    userIdentityId: record.owner.userIdentityId,
    kind: record.kind,
    state: record.state,
    currentVersionId: record.currentVersionId,
    metadata: record.reference.metadata,
    updatedAt: record.lastModifiedAt,
  });
}

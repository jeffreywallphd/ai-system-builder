import {
  SecretKinds,
  SecretRecordStates,
  SecretScopes,
  SecretVersionStates,
  createSecretProtectionPolicy,
  createSecretScopeOwner,
  type KeyEncryptionContext,
  type SecretKind,
  type SecretRecord,
  type SecretRecordState,
  type SecretReference,
  type SecretScope,
  type SecretScopeOwner,
  type SecretVersion,
  type SecretVersionState,
} from "../../../domain/security/SecretDomain";

export interface SecretRecordRow {
  readonly secret_id: string;
  readonly scope_type: SecretScope;
  readonly scope_id: string;
  readonly workspace_id: string | null;
  readonly user_identity_id: string | null;
  readonly machine_key_name: string;
  readonly display_name: string | null;
  readonly metadata_description: string | null;
  readonly metadata_tags_json: string;
  readonly metadata_labels_json: string;
  readonly sensitivity_markers_json: string;
  readonly secret_kind: SecretKind;
  readonly status: SecretRecordState;
  readonly active_version_id: string | null;
  readonly protection_policy_json: string;
  readonly created_at: string;
  readonly created_by: string;
  readonly updated_at: string;
  readonly last_modified_by: string;
  readonly disabled_at: string | null;
  readonly disabled_by: string | null;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
  readonly deleted_at: string | null;
  readonly deleted_by: string | null;
}

export interface SecretVersionRow {
  readonly version_id: string;
  readonly secret_id: string;
  readonly version_number: number;
  readonly state: SecretVersionState;
  readonly created_at: string;
  readonly created_by: string;
  readonly previous_version_id: string | null;
  readonly superseded_by_version_id: string | null;
  readonly encrypted_payload_ref: string;
  readonly payload_digest_sha256: string;
  readonly payload_byte_length: number;
  readonly key_encryption_context_json: string;
}

export interface SecretMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: "create-secret" | "save-secret" | "delete-secret";
  readonly mutation_snapshot_json: string;
  readonly created_at: string;
}

export function mapSecretRecordRowAndVersionsToDomain(
  recordRow: SecretRecordRow,
  versionRows: ReadonlyArray<SecretVersionRow>,
): SecretRecord {
  const owner = createSecretScopeOwner({
    scope: assertSecretScope(recordRow.scope_type),
    workspaceId: normalizeLookup(recordRow.workspace_id),
    userIdentityId: normalizeLookup(recordRow.user_identity_id),
  });

  const kind = assertSecretKind(recordRow.secret_kind);
  const state = assertSecretRecordState(recordRow.status);
  const tags = parseStringArray(recordRow.metadata_tags_json);
  const labels = parseStringMap(recordRow.metadata_labels_json);
  const versions = Object.freeze(versionRows
    .map((versionRow) => mapSecretVersionRowToDomain(versionRow, owner))
    .sort((left, right) => left.version - right.version));

  const metadata = Object.freeze({
    displayName: normalizeLookup(recordRow.display_name),
    description: normalizeLookup(recordRow.metadata_description),
    tags,
    labels,
  });

  const updatedAt = recordRow.updated_at;
  const record: SecretRecord = Object.freeze({
    secretId: recordRow.secret_id,
    reference: Object.freeze({
      secretId: recordRow.secret_id,
      name: recordRow.machine_key_name,
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      kind,
      state,
      currentVersionId: normalizeLookup(recordRow.active_version_id),
      metadata,
      updatedAt,
    }),
    owner,
    kind,
    state,
    protectionPolicy: createSecretProtectionPolicy(parseProtectionPolicyInput(recordRow.protection_policy_json)),
    versions,
    currentVersionId: normalizeLookup(recordRow.active_version_id),
    createdAt: recordRow.created_at,
    createdBy: recordRow.created_by,
    lastModifiedAt: updatedAt,
    lastModifiedBy: recordRow.last_modified_by,
    disabledAt: normalizeLookup(recordRow.disabled_at),
    disabledBy: normalizeLookup(recordRow.disabled_by),
    revokedAt: normalizeLookup(recordRow.revoked_at),
    revokedBy: normalizeLookup(recordRow.revoked_by),
    deletedAt: normalizeLookup(recordRow.deleted_at),
    deletedBy: normalizeLookup(recordRow.deleted_by),
  });

  return record;
}

export function mapSecretRecordToRowValues(record: SecretRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    record.secretId,
    record.owner.scope,
    toScopeId(record.owner),
    record.owner.workspaceId ?? null,
    record.owner.userIdentityId ?? null,
    record.reference.name,
    record.reference.metadata.displayName ?? null,
    record.reference.metadata.description ?? null,
    JSON.stringify(record.reference.metadata.tags),
    JSON.stringify(record.reference.metadata.labels),
    JSON.stringify(buildSensitivityMarkers(record)),
    record.kind,
    record.state,
    record.currentVersionId ?? null,
    JSON.stringify(record.protectionPolicy),
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.disabledAt ?? null,
    record.disabledBy ?? null,
    record.revokedAt ?? null,
    record.revokedBy ?? null,
    record.deletedAt ?? null,
    record.deletedBy ?? null,
  ]);
}

export function mapSecretVersionToRowValues(version: SecretVersion): ReadonlyArray<unknown> {
  return Object.freeze([
    version.versionId,
    version.secretId,
    version.version,
    version.state,
    version.createdAt,
    version.createdBy,
    version.previousVersionId ?? null,
    version.supersededByVersionId ?? null,
  ]);
}

export function mapSecretVersionMaterialToRowValues(version: SecretVersion): ReadonlyArray<unknown> {
  return Object.freeze([
    version.versionId,
    version.encryptedPayloadRef,
    null,
    version.payloadDigestSha256,
    version.payloadByteLength,
    JSON.stringify(version.keyEncryptionContext),
    version.createdAt,
  ]);
}

export function mapSecretRecordRowToReference(row: SecretRecordRow): SecretReference {
  const owner = createSecretScopeOwner({
    scope: assertSecretScope(row.scope_type),
    workspaceId: normalizeLookup(row.workspace_id),
    userIdentityId: normalizeLookup(row.user_identity_id),
  });

  return Object.freeze({
    secretId: row.secret_id,
    name: row.machine_key_name,
    scope: owner.scope,
    workspaceId: owner.workspaceId,
    userIdentityId: owner.userIdentityId,
    kind: assertSecretKind(row.secret_kind),
    state: assertSecretRecordState(row.status),
    currentVersionId: normalizeLookup(row.active_version_id),
    metadata: Object.freeze({
      displayName: normalizeLookup(row.display_name),
      description: normalizeLookup(row.metadata_description),
      tags: parseStringArray(row.metadata_tags_json),
      labels: parseStringMap(row.metadata_labels_json),
    }),
    updatedAt: row.updated_at,
  });
}

export function parseSecretMutationReplayRecord<TRecord>(row: SecretMutationReplayRow): TRecord {
  try {
    return JSON.parse(row.mutation_snapshot_json) as TRecord;
  } catch {
    throw new Error(`Secret mutation replay snapshot for operation '${row.operation_key}' is malformed.`);
  }
}

export function normalizeSecretLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function toScopeId(owner: SecretScopeOwner): string {
  if (owner.scope === SecretScopes.server) {
    return "server";
  }
  if (owner.scope === SecretScopes.workspace) {
    return `workspace:${owner.workspaceId}`;
  }
  if (owner.workspaceId) {
    return `workspace:${owner.workspaceId}:user:${owner.userIdentityId}`;
  }
  return `user:${owner.userIdentityId}`;
}

function mapSecretVersionRowToDomain(versionRow: SecretVersionRow, owner: SecretScopeOwner): SecretVersion {
  const parsedContext = parseKeyEncryptionContext(versionRow.key_encryption_context_json, owner);
  return Object.freeze({
    versionId: versionRow.version_id,
    secretId: versionRow.secret_id,
    version: versionRow.version_number,
    state: assertSecretVersionState(versionRow.state),
    createdAt: versionRow.created_at,
    createdBy: versionRow.created_by,
    supersededByVersionId: normalizeLookup(versionRow.superseded_by_version_id),
    previousVersionId: normalizeLookup(versionRow.previous_version_id),
    encryptedPayloadRef: versionRow.encrypted_payload_ref,
    payloadDigestSha256: versionRow.payload_digest_sha256,
    payloadByteLength: versionRow.payload_byte_length,
    keyEncryptionContext: Object.freeze({
      keyId: parsedContext.keyId,
      algorithm: parsedContext.algorithm,
      scope: owner.scope,
      workspaceId: owner.workspaceId,
      userIdentityId: owner.userIdentityId,
      keyVersion: parsedContext.keyVersion,
    }),
  });
}

function buildSensitivityMarkers(record: SecretRecord): ReadonlyArray<string> {
  const markers = new Set<string>();
  if (record.protectionPolicy.encryptedAtRest) {
    markers.add("encrypted-at-rest");
  }
  if (record.protectionPolicy.keyEncryptionRequired) {
    markers.add("key-encryption-required");
  }
  if (!record.protectionPolicy.allowRuntimePlaintextRetrieval) {
    markers.add("runtime-plaintext-disabled");
  }
  for (const tag of record.reference.metadata.tags) {
    if (tag.startsWith("sensitivity:")) {
      markers.add(tag);
    }
  }
  return Object.freeze([...markers.values()]);
}

function normalizeLookup(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON payload was not an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Persisted secret payload JSON is invalid: ${details}`);
  }
}

function parseKeyEncryptionContext(value: string, owner: SecretScopeOwner): KeyEncryptionContext {
  const parsed = parseJsonObject(value);
  const keyId = typeof parsed.keyId === "string" ? parsed.keyId : "";
  const algorithm = typeof parsed.algorithm === "string" ? parsed.algorithm : "";
  const keyVersion = typeof parsed.keyVersion === "string" ? parsed.keyVersion : undefined;

  if (!keyId || !algorithm) {
    throw new Error("Persisted secret key encryption context is invalid.");
  }

  return Object.freeze({
    keyId,
    algorithm,
    scope: owner.scope,
    workspaceId: owner.workspaceId,
    userIdentityId: owner.userIdentityId,
    keyVersion,
  });
}

function parseProtectionPolicyInput(value: string): {
  readonly keyEncryptionRequired?: boolean;
  readonly envelopeAlgorithm?: string;
  readonly encryptedAtRest?: boolean;
  readonly requireRotation?: boolean;
  readonly maxVersionAgeDays?: number;
  readonly allowRuntimePlaintextRetrieval?: boolean;
} {
  const parsed = parseJsonObject(value);
  const policy = {
    keyEncryptionRequired: typeof parsed.keyEncryptionRequired === "boolean" ? parsed.keyEncryptionRequired : undefined,
    envelopeAlgorithm: typeof parsed.envelopeAlgorithm === "string" ? parsed.envelopeAlgorithm : undefined,
    encryptedAtRest: typeof parsed.encryptedAtRest === "boolean" ? parsed.encryptedAtRest : undefined,
    requireRotation: typeof parsed.requireRotation === "boolean" ? parsed.requireRotation : undefined,
    maxVersionAgeDays: typeof parsed.maxVersionAgeDays === "number" ? parsed.maxVersionAgeDays : undefined,
    allowRuntimePlaintextRetrieval: typeof parsed.allowRuntimePlaintextRetrieval === "boolean"
      ? parsed.allowRuntimePlaintextRetrieval
      : undefined,
  };

  return Object.freeze(policy);
}

function parseStringArray(value: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    return Object.freeze(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return Object.freeze([]);
  }
}

function parseStringMap(value: string): Readonly<Record<string, string>> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Object.freeze({});
    }
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string");
    return Object.freeze(Object.fromEntries(entries));
  } catch {
    return Object.freeze({});
  }
}

function assertSecretScope(value: string): SecretScope {
  if (Object.values(SecretScopes).includes(value as SecretScope)) {
    return value as SecretScope;
  }
  throw new Error(`Persisted secret scope '${value}' is invalid.`);
}

function assertSecretKind(value: string): SecretKind {
  if (Object.values(SecretKinds).includes(value as SecretKind)) {
    return value as SecretKind;
  }
  throw new Error(`Persisted secret kind '${value}' is invalid.`);
}

function assertSecretRecordState(value: string): SecretRecordState {
  if (Object.values(SecretRecordStates).includes(value as SecretRecordState)) {
    return value as SecretRecordState;
  }
  throw new Error(`Persisted secret record state '${value}' is invalid.`);
}

function assertSecretVersionState(value: string): SecretVersionState {
  if (Object.values(SecretVersionStates).includes(value as SecretVersionState)) {
    return value as SecretVersionState;
  }
  throw new Error(`Persisted secret version state '${value}' is invalid.`);
}

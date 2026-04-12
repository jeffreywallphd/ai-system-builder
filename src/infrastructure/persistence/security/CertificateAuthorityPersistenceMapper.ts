import type {
  CertificateAuthorityRootPersistenceRecord,
  CertificateDistributionEventPersistenceRecord,
  CertificateRevocationHistoryPersistenceRecord,
  CertificateStatusHistoryPersistenceRecord,
  IssuedCertificatePersistenceRecord,
  TrustMaterialReferencePersistenceRecord,
} from "@shared/dto/security/CertificateAuthorityDtos";
import {
  parseCertificateAuthorityRootPersistenceRecord,
  parseCertificateDistributionEventPersistenceRecord,
  parseCertificateRevocationHistoryPersistenceRecord,
  parseCertificateStatusHistoryPersistenceRecord,
  parseIssuedCertificatePersistenceRecord,
  parseTrustMaterialReferencePersistenceRecord,
} from "@shared/schemas/security/CertificateAuthoritySchemaContracts";

export interface CertificateAuthorityRootRow {
  readonly certificate_authority_id: string;
  readonly display_name: string;
  readonly status: CertificateAuthorityRootPersistenceRecord["status"];
  readonly subject_json: string;
  readonly serial_number: string;
  readonly validity_not_before: string;
  readonly validity_not_after: string;
  readonly signature_algorithm: string;
  readonly root_certificate_material_ref: string;
  readonly root_private_key_material_ref: string;
  readonly rotation_policy_json: string;
  readonly rotated_from_certificate_authority_id: string | null;
  readonly retired_at: string | null;
  readonly compromised_at: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface IssuedCertificateRow {
  readonly serial_number: string;
  readonly certificate_authority_id: string;
  readonly status: IssuedCertificatePersistenceRecord["status"];
  readonly subject_json: string;
  readonly subject_reference_kind: IssuedCertificatePersistenceRecord["subjectReference"]["kind"];
  readonly subject_reference_id: string;
  readonly subject_reference_workspace_id: string | null;
  readonly usages_json: string;
  readonly validity_not_before: string;
  readonly validity_not_after: string;
  readonly issued_at: string;
  readonly certificate_material_ref: string;
  readonly certificate_chain_material_ref: string | null;
  readonly trust_material_ref: string | null;
  readonly public_key_algorithm: string;
  readonly public_key_fingerprint_sha256: string | null;
  readonly revocation_json: string | null;
  readonly superseded_by_serial_number: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface TrustMaterialReferenceRow {
  readonly material_ref: string;
  readonly kind: TrustMaterialReferencePersistenceRecord["kind"];
  readonly storage_locator: string;
  readonly fingerprint_sha256: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface CertificateStatusHistoryRow {
  readonly status_event_id: string;
  readonly certificate_authority_id: string;
  readonly serial_number: string;
  readonly previous_status: CertificateStatusHistoryPersistenceRecord["previousStatus"] | null;
  readonly current_status: CertificateStatusHistoryPersistenceRecord["currentStatus"];
  readonly occurred_at: string;
  readonly occurred_by: string;
  readonly reason: string | null;
  readonly note: string | null;
}

export interface CertificateRevocationRow {
  readonly revocation_id: string;
  readonly certificate_authority_id: string;
  readonly serial_number: string;
  readonly reason: CertificateRevocationHistoryPersistenceRecord["reason"];
  readonly revoked_at: string;
  readonly revoked_by_actor_id: string | null;
  readonly note: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface CertificateDistributionEventRow {
  readonly distribution_event_id: string;
  readonly material_ref: string;
  readonly certificate_authority_id: string | null;
  readonly serial_number: string | null;
  readonly target_kind: CertificateDistributionEventPersistenceRecord["targetKind"];
  readonly target_reference_id: string;
  readonly workspace_id: string | null;
  readonly transport: string;
  readonly delivery_locator_ref: string | null;
  readonly status: CertificateDistributionEventPersistenceRecord["status"];
  readonly occurred_at: string;
  readonly occurred_by: string;
  readonly failure_reason: string | null;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface CertificateMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind:
    | "certificate-authority"
    | "issued-certificate"
    | "trust-material"
    | "status-history"
    | "certificate-revocation"
    | "distribution-event";
  readonly record_snapshot_json: string;
  readonly created_at: string;
}

export function mapCertificateAuthorityRootRowToRecord(row: CertificateAuthorityRootRow): CertificateAuthorityRootPersistenceRecord {
  return Object.freeze(parseCertificateAuthorityRootPersistenceRecord({
    certificateAuthorityId: row.certificate_authority_id,
    displayName: row.display_name,
    status: row.status,
    subject: parseJsonObject(row.subject_json),
    serialNumber: row.serial_number,
    validity: {
      notBefore: row.validity_not_before,
      notAfter: row.validity_not_after,
    },
    signatureAlgorithm: row.signature_algorithm,
    rootCertificateMaterialRef: row.root_certificate_material_ref,
    rootPrivateKeyMaterialRef: row.root_private_key_material_ref,
    rotationPolicy: parseJsonObject(row.rotation_policy_json),
    rotatedFromCertificateAuthorityId: normalizeLookup(row.rotated_from_certificate_authority_id),
    retiredAt: normalizeLookup(row.retired_at),
    compromisedAt: normalizeLookup(row.compromised_at),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  }));
}

export function mapCertificateAuthorityRootRecordToRowValues(
  record: CertificateAuthorityRootPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.certificateAuthorityId,
    record.displayName,
    record.status,
    JSON.stringify(record.subject),
    record.serialNumber,
    record.validity.notBefore,
    record.validity.notAfter,
    record.signatureAlgorithm,
    record.rootCertificateMaterialRef,
    record.rootPrivateKeyMaterialRef,
    JSON.stringify(record.rotationPolicy),
    record.rotatedFromCertificateAuthorityId ?? null,
    record.retiredAt ?? null,
    record.compromisedAt ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapIssuedCertificateRowToRecord(row: IssuedCertificateRow): IssuedCertificatePersistenceRecord {
  return Object.freeze(parseIssuedCertificatePersistenceRecord({
    certificateAuthorityId: row.certificate_authority_id,
    serialNumber: row.serial_number,
    status: row.status,
    subject: parseJsonObject(row.subject_json),
    subjectReference: {
      kind: row.subject_reference_kind,
      referenceId: row.subject_reference_id,
      workspaceId: normalizeLookup(row.subject_reference_workspace_id),
    },
    usages: parseStringArray(row.usages_json),
    validity: {
      notBefore: row.validity_not_before,
      notAfter: row.validity_not_after,
    },
    issuedAt: row.issued_at,
    certificateMaterialRef: row.certificate_material_ref,
    certificateChainMaterialRef: normalizeLookup(row.certificate_chain_material_ref),
    trustMaterialRef: normalizeLookup(row.trust_material_ref),
    publicKeyAlgorithm: row.public_key_algorithm,
    publicKeyFingerprintSha256: normalizeLookup(row.public_key_fingerprint_sha256),
    revocation: row.revocation_json ? parseJsonObject(row.revocation_json) : undefined,
    supersededBySerialNumber: normalizeLookup(row.superseded_by_serial_number),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  }));
}

export function mapIssuedCertificateRecordToRowValues(record: IssuedCertificatePersistenceRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    record.serialNumber,
    record.certificateAuthorityId,
    record.status,
    JSON.stringify(record.subject),
    record.subjectReference.kind,
    record.subjectReference.referenceId,
    record.subjectReference.workspaceId ?? null,
    JSON.stringify(record.usages),
    record.validity.notBefore,
    record.validity.notAfter,
    record.issuedAt,
    record.certificateMaterialRef,
    record.certificateChainMaterialRef ?? null,
    record.trustMaterialRef ?? null,
    record.publicKeyAlgorithm,
    record.publicKeyFingerprintSha256 ?? null,
    record.revocation ? JSON.stringify(record.revocation) : null,
    record.supersededBySerialNumber ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapTrustMaterialReferenceRowToRecord(row: TrustMaterialReferenceRow): TrustMaterialReferencePersistenceRecord {
  return Object.freeze(parseTrustMaterialReferencePersistenceRecord({
    materialRef: row.material_ref,
    kind: row.kind,
    storageLocator: row.storage_locator,
    fingerprintSha256: normalizeLookup(row.fingerprint_sha256),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  }));
}

export function mapTrustMaterialReferenceRecordToRowValues(
  record: TrustMaterialReferencePersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.materialRef,
    record.kind,
    record.storageLocator,
    record.fingerprintSha256 ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapCertificateStatusHistoryRowToRecord(row: CertificateStatusHistoryRow): CertificateStatusHistoryPersistenceRecord {
  return Object.freeze(parseCertificateStatusHistoryPersistenceRecord({
    statusEventId: row.status_event_id,
    certificateAuthorityId: row.certificate_authority_id,
    serialNumber: row.serial_number,
    previousStatus: row.previous_status ?? undefined,
    currentStatus: row.current_status,
    occurredAt: row.occurred_at,
    occurredBy: row.occurred_by,
    reason: normalizeLookup(row.reason),
    note: normalizeLookup(row.note),
  }));
}

export function mapCertificateStatusHistoryRecordToRowValues(
  record: CertificateStatusHistoryPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.statusEventId,
    record.certificateAuthorityId,
    record.serialNumber,
    record.previousStatus ?? null,
    record.currentStatus,
    record.occurredAt,
    record.occurredBy,
    record.reason ?? null,
    record.note ?? null,
  ]);
}

export function mapCertificateRevocationRowToRecord(row: CertificateRevocationRow): CertificateRevocationHistoryPersistenceRecord {
  return Object.freeze(parseCertificateRevocationHistoryPersistenceRecord({
    revocationId: row.revocation_id,
    certificateAuthorityId: row.certificate_authority_id,
    serialNumber: row.serial_number,
    reason: row.reason,
    revokedAt: row.revoked_at,
    revokedByActorId: normalizeLookup(row.revoked_by_actor_id),
    note: normalizeLookup(row.note),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  }));
}

export function mapCertificateRevocationRecordToRowValues(
  record: CertificateRevocationHistoryPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.revocationId,
    record.certificateAuthorityId,
    record.serialNumber,
    record.reason,
    record.revokedAt,
    record.revokedByActorId ?? null,
    record.note ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function mapCertificateDistributionEventRowToRecord(
  row: CertificateDistributionEventRow,
): CertificateDistributionEventPersistenceRecord {
  return Object.freeze(parseCertificateDistributionEventPersistenceRecord({
    distributionEventId: row.distribution_event_id,
    materialRef: row.material_ref,
    certificateAuthorityId: normalizeLookup(row.certificate_authority_id),
    serialNumber: normalizeLookup(row.serial_number),
    targetKind: row.target_kind,
    targetReferenceId: row.target_reference_id,
    workspaceId: normalizeLookup(row.workspace_id),
    transport: row.transport,
    deliveryLocatorRef: normalizeLookup(row.delivery_locator_ref),
    status: row.status,
    occurredAt: row.occurred_at,
    occurredBy: row.occurred_by,
    failureReason: normalizeLookup(row.failure_reason),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastModifiedAt: row.last_modified_at,
    lastModifiedBy: row.last_modified_by,
    revision: row.revision,
  }));
}

export function mapCertificateDistributionEventRecordToRowValues(
  record: CertificateDistributionEventPersistenceRecord,
): ReadonlyArray<unknown> {
  return Object.freeze([
    record.distributionEventId,
    record.materialRef,
    record.certificateAuthorityId ?? null,
    record.serialNumber ?? null,
    record.targetKind,
    record.targetReferenceId,
    record.workspaceId ?? null,
    record.transport,
    record.deliveryLocatorRef ?? null,
    record.status,
    record.occurredAt,
    record.occurredBy,
    record.failureReason ?? null,
    record.createdAt,
    record.createdBy,
    record.lastModifiedAt,
    record.lastModifiedBy,
    record.revision,
  ]);
}

export function parseCertificateMutationReplayRecord<TRecord>(row: CertificateMutationReplayRow): TRecord {
  try {
    return JSON.parse(row.record_snapshot_json) as TRecord;
  } catch {
    throw new Error(`Certificate mutation replay snapshot for operation '${row.operation_key}' is malformed.`);
  }
}

export function normalizeCertificateLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
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
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("JSON payload was not an object.");
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Persisted certificate payload JSON is invalid: ${details}`);
  }
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


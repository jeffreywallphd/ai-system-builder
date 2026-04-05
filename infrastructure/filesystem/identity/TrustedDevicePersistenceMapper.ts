import type {
  TrustedDeviceListQuery,
  TrustedDevicePairingSessionRecord,
  TrustedDevicePairingTokenRecord,
} from "../../../application/contracts/IdentityApplicationContracts";
import {
  createTrustedDevice,
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  type DevicePairingMethod,
  type DeviceRevocationReason,
  type DeviceTrustMaterialKind,
  type DeviceTrustStatus,
  type TrustedDevice,
} from "../../../src/domain/identity/TrustedDeviceDomain";
import {
  PairingSessionRejectionReasons,
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenInvalidationReasons,
  PairingTokenStatuses,
  type PairingSessionRejectionReason,
  type PairingSessionStatus,
  type PairingTokenActorScope,
  type PairingTokenArtifactType,
  type PairingTokenInvalidationReason,
  type PairingTokenStatus,
} from "../../../src/domain/identity/TrustedDevicePairingDomain";

export interface TrustedDeviceRow {
  readonly trusted_device_id: string;
  readonly user_identity_id: string;
  readonly workspace_id: string | null;
  readonly display_name: string;
  readonly fingerprint_algorithm: string;
  readonly fingerprint_value: string;
  readonly fingerprint_captured_at: string;
  readonly pairing_method: string;
  readonly trust_status: string;
  readonly trust_material_id: string | null;
  readonly trust_material_kind: string | null;
  readonly trust_material_version: string | null;
  readonly trust_material_issued_at: string | null;
  readonly trust_material_expires_at: string | null;
  readonly registered_at: string;
  readonly paired_at: string | null;
  readonly last_seen_at: string | null;
  readonly metadata_platform: string | null;
  readonly metadata_os_version: string | null;
  readonly metadata_app_version: string | null;
  readonly metadata_device_model: string | null;
  readonly metadata_locale: string | null;
  readonly metadata_last_ip_address: string | null;
  readonly revocation_reason: string | null;
  readonly revoked_at: string | null;
  readonly revoked_by_user_identity_id: string | null;
  readonly revocation_note: string | null;
  readonly updated_at: string;
}

export interface PairingSessionRow {
  readonly pairing_session_id: string;
  readonly trusted_device_id: string;
  readonly user_identity_id: string;
  readonly workspace_id: string | null;
  readonly pairing_token_id: string;
  readonly status: string;
  readonly initiated_at: string;
  readonly validated_at: string | null;
  readonly completed_at: string | null;
  readonly completed_by_user_identity_id: string | null;
  readonly trust_material_registration_kind: string | null;
  readonly trust_material_registration_pin_reference: string | null;
  readonly trust_material_registration_public_key_fingerprint: string | null;
  readonly rejected_at: string | null;
  readonly rejection_reason: string | null;
  readonly rejection_note: string | null;
  readonly invalidated_at: string | null;
  readonly expired_at: string | null;
  readonly updated_at: string;
}

export interface PairingTokenRow {
  readonly pairing_token_id: string;
  readonly pairing_session_id: string;
  readonly trusted_device_id: string;
  readonly user_identity_id: string;
  readonly workspace_id: string | null;
  readonly artifact_type: string;
  readonly token_hash: string;
  readonly hash_algorithm: "sha256";
  readonly actor_scope: string;
  readonly actor_user_identity_id: string | null;
  readonly actor_session_id: string | null;
  readonly issuance_issued_by_user_identity_id: string | null;
  readonly issuance_ip_address: string | null;
  readonly issuance_user_agent: string | null;
  readonly issuance_channel_hint: string | null;
  readonly status: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly failed_validation_attempts: number;
  readonly max_validation_attempts: number;
  readonly last_validation_attempt_at: string | null;
  readonly consumed_at: string | null;
  readonly consumed_by_user_identity_id: string | null;
  readonly invalidation_reason: string | null;
  readonly invalidated_at: string | null;
  readonly invalidated_by_user_identity_id: string | null;
  readonly invalidation_note: string | null;
  readonly updated_at: string;
}

export function mapTrustedDeviceRowToDomain(row: TrustedDeviceRow): TrustedDevice {
  return createTrustedDevice({
    id: row.trusted_device_id,
    userIdentityId: row.user_identity_id,
    workspaceId: row.workspace_id ?? undefined,
    displayName: row.display_name,
    fingerprint: {
      algorithm: assertFingerprintAlgorithm(row.fingerprint_algorithm),
      value: row.fingerprint_value,
      capturedAt: row.fingerprint_captured_at,
    },
    pairingMethod: assertPairingMethod(row.pairing_method),
    trustStatus: assertTrustStatus(row.trust_status),
    trustMaterialRef: row.trust_material_id && row.trust_material_kind && row.trust_material_issued_at
      ? {
          materialId: row.trust_material_id,
          kind: assertTrustMaterialKind(row.trust_material_kind),
          version: row.trust_material_version ?? undefined,
          issuedAt: row.trust_material_issued_at,
          expiresAt: row.trust_material_expires_at ?? undefined,
        }
      : undefined,
    registeredAt: row.registered_at,
    pairedAt: row.paired_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    metadata: {
      platform: row.metadata_platform ?? undefined,
      osVersion: row.metadata_os_version ?? undefined,
      appVersion: row.metadata_app_version ?? undefined,
      deviceModel: row.metadata_device_model ?? undefined,
      locale: row.metadata_locale ?? undefined,
      lastIpAddress: row.metadata_last_ip_address ?? undefined,
    },
    revocation: row.revocation_reason && row.revoked_at
      ? {
          reason: assertRevocationReason(row.revocation_reason),
          revokedAt: row.revoked_at,
          revokedByUserIdentityId: row.revoked_by_user_identity_id ?? undefined,
          note: row.revocation_note ?? undefined,
        }
      : undefined,
    updatedAt: row.updated_at,
  });
}

export function mapTrustedDeviceToRowValues(device: TrustedDevice): ReadonlyArray<unknown> {
  return Object.freeze([
    device.id,
    device.userIdentityId,
    device.workspaceId ?? null,
    device.displayName.value,
    device.fingerprint.algorithm,
    device.fingerprint.value,
    device.fingerprint.capturedAt,
    device.pairingMethod,
    device.trustStatus,
    device.trustMaterialRef?.materialId ?? null,
    device.trustMaterialRef?.kind ?? null,
    device.trustMaterialRef?.version ?? null,
    device.trustMaterialRef?.issuedAt ?? null,
    device.trustMaterialRef?.expiresAt ?? null,
    device.registeredAt,
    device.pairedAt ?? null,
    device.lastSeenAt ?? null,
    device.metadata.platform ?? null,
    device.metadata.osVersion ?? null,
    device.metadata.appVersion ?? null,
    device.metadata.deviceModel ?? null,
    device.metadata.locale ?? null,
    device.metadata.lastIpAddress ?? null,
    device.revocation?.reason ?? null,
    device.revocation?.revokedAt ?? null,
    device.revocation?.revokedByUserIdentityId ?? null,
    device.revocation?.note ?? null,
    device.updatedAt,
  ]);
}

export function mapPairingSessionRowToRecord(row: PairingSessionRow): TrustedDevicePairingSessionRecord {
  return Object.freeze({
    id: row.pairing_session_id,
    trustedDeviceId: row.trusted_device_id,
    userIdentityId: row.user_identity_id,
    workspaceId: row.workspace_id ?? undefined,
    pairingTokenId: row.pairing_token_id,
    status: assertPairingSessionStatus(row.status),
    initiatedAt: row.initiated_at,
    validatedAt: row.validated_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    completedByUserIdentityId: row.completed_by_user_identity_id ?? undefined,
    trustMaterialRegistration: row.trust_material_registration_kind && row.trust_material_registration_pin_reference
      ? {
          materialKind: assertTrustMaterialKind(row.trust_material_registration_kind),
          pinReference: row.trust_material_registration_pin_reference,
          publicKeyFingerprint: row.trust_material_registration_public_key_fingerprint ?? undefined,
        }
      : undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectionReason: row.rejection_reason ? assertPairingSessionRejectionReason(row.rejection_reason) : undefined,
    rejectionNote: row.rejection_note ?? undefined,
    invalidatedAt: row.invalidated_at ?? undefined,
    expiredAt: row.expired_at ?? undefined,
    updatedAt: row.updated_at,
  });
}

export function mapPairingSessionToRowValues(session: TrustedDevicePairingSessionRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    session.id,
    session.trustedDeviceId,
    session.userIdentityId,
    session.workspaceId ?? null,
    session.pairingTokenId,
    session.status,
    session.initiatedAt,
    session.validatedAt ?? null,
    session.completedAt ?? null,
    session.completedByUserIdentityId ?? null,
    session.trustMaterialRegistration?.materialKind ?? null,
    session.trustMaterialRegistration?.pinReference ?? null,
    session.trustMaterialRegistration?.publicKeyFingerprint ?? null,
    session.rejectedAt ?? null,
    session.rejectionReason ?? null,
    session.rejectionNote ?? null,
    session.invalidatedAt ?? null,
    session.expiredAt ?? null,
    session.updatedAt,
  ]);
}

export function mapPairingTokenRowToRecord(row: PairingTokenRow): TrustedDevicePairingTokenRecord {
  return Object.freeze({
    id: row.pairing_token_id,
    pairingSessionId: row.pairing_session_id,
    trustedDeviceId: row.trusted_device_id,
    userIdentityId: row.user_identity_id,
    workspaceId: row.workspace_id ?? undefined,
    artifactType: assertPairingTokenArtifactType(row.artifact_type),
    tokenHash: row.token_hash,
    hashAlgorithm: row.hash_algorithm,
    actorBinding: {
      scope: assertPairingActorScope(row.actor_scope),
      userIdentityId: row.actor_user_identity_id ?? undefined,
      sessionId: row.actor_session_id ?? undefined,
    },
    issuance: {
      issuedByUserIdentityId: row.issuance_issued_by_user_identity_id ?? undefined,
      issuedFromIpAddress: row.issuance_ip_address ?? undefined,
      issuedFromUserAgent: row.issuance_user_agent ?? undefined,
      channelHint: row.issuance_channel_hint ?? undefined,
    },
    status: assertPairingTokenStatus(row.status),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    failedValidationAttempts: row.failed_validation_attempts,
    maxValidationAttempts: row.max_validation_attempts,
    lastValidationAttemptAt: row.last_validation_attempt_at ?? undefined,
    consumedAt: row.consumed_at ?? undefined,
    consumedByUserIdentityId: row.consumed_by_user_identity_id ?? undefined,
    invalidationReason: row.invalidation_reason ? assertPairingTokenInvalidationReason(row.invalidation_reason) : undefined,
    invalidatedAt: row.invalidated_at ?? undefined,
    invalidatedByUserIdentityId: row.invalidated_by_user_identity_id ?? undefined,
    invalidationNote: row.invalidation_note ?? undefined,
    updatedAt: row.updated_at,
  });
}

export function mapPairingTokenToRowValues(token: TrustedDevicePairingTokenRecord): ReadonlyArray<unknown> {
  return Object.freeze([
    token.id,
    token.pairingSessionId,
    token.trustedDeviceId,
    token.userIdentityId,
    token.workspaceId ?? null,
    token.artifactType,
    token.tokenHash,
    token.hashAlgorithm,
    token.actorBinding.scope,
    token.actorBinding.userIdentityId ?? null,
    token.actorBinding.sessionId ?? null,
    token.issuance.issuedByUserIdentityId ?? null,
    token.issuance.issuedFromIpAddress ?? null,
    token.issuance.issuedFromUserAgent ?? null,
    token.issuance.channelHint ?? null,
    token.status,
    token.issuedAt,
    token.expiresAt,
    token.failedValidationAttempts,
    token.maxValidationAttempts,
    token.lastValidationAttemptAt ?? null,
    token.consumedAt ?? null,
    token.consumedByUserIdentityId ?? null,
    token.invalidationReason ?? null,
    token.invalidatedAt ?? null,
    token.invalidatedByUserIdentityId ?? null,
    token.invalidationNote ?? null,
    token.updatedAt,
  ]);
}

export function normalizeLookup(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function hasTrustedDeviceStatuses(query: TrustedDeviceListQuery): boolean {
  return Array.isArray(query.includeStatuses) && query.includeStatuses.length > 0;
}

function assertPairingMethod(value: string): DevicePairingMethod {
  if (Object.values(DevicePairingMethods).includes(value as DevicePairingMethod)) {
    return value as DevicePairingMethod;
  }
  throw new Error(`Persisted trusted-device pairing method '${value}' is invalid.`);
}

function assertTrustStatus(value: string): DeviceTrustStatus {
  if (Object.values(DeviceTrustStatuses).includes(value as DeviceTrustStatus)) {
    return value as DeviceTrustStatus;
  }
  throw new Error(`Persisted trusted-device trust status '${value}' is invalid.`);
}

function assertFingerprintAlgorithm(value: string): "sha256" | "sha512" | "opaque" {
  if (value === "sha256" || value === "sha512" || value === "opaque") {
    return value;
  }
  throw new Error(`Persisted trusted-device fingerprint algorithm '${value}' is invalid.`);
}

function assertRevocationReason(value: string): DeviceRevocationReason {
  if (Object.values(DeviceRevocationReasons).includes(value as DeviceRevocationReason)) {
    return value as DeviceRevocationReason;
  }
  throw new Error(`Persisted trusted-device revocation reason '${value}' is invalid.`);
}

function assertTrustMaterialKind(value: string): DeviceTrustMaterialKind {
  if (Object.values(DeviceTrustMaterialKinds).includes(value as DeviceTrustMaterialKind)) {
    return value as DeviceTrustMaterialKind;
  }
  throw new Error(`Persisted trust material kind '${value}' is invalid.`);
}

function assertPairingSessionStatus(value: string): PairingSessionStatus {
  if (Object.values(PairingSessionStatuses).includes(value as PairingSessionStatus)) {
    return value as PairingSessionStatus;
  }
  throw new Error(`Persisted pairing session status '${value}' is invalid.`);
}

function assertPairingSessionRejectionReason(value: string): PairingSessionRejectionReason {
  if (Object.values(PairingSessionRejectionReasons).includes(value as PairingSessionRejectionReason)) {
    return value as PairingSessionRejectionReason;
  }
  throw new Error(`Persisted pairing session rejection reason '${value}' is invalid.`);
}

function assertPairingTokenStatus(value: string): PairingTokenStatus {
  if (Object.values(PairingTokenStatuses).includes(value as PairingTokenStatus)) {
    return value as PairingTokenStatus;
  }
  throw new Error(`Persisted pairing token status '${value}' is invalid.`);
}

function assertPairingTokenArtifactType(value: string): PairingTokenArtifactType {
  if (Object.values(PairingTokenArtifactTypes).includes(value as PairingTokenArtifactType)) {
    return value as PairingTokenArtifactType;
  }
  throw new Error(`Persisted pairing token artifact type '${value}' is invalid.`);
}

function assertPairingActorScope(value: string): PairingTokenActorScope {
  if (Object.values(PairingTokenActorScopes).includes(value as PairingTokenActorScope)) {
    return value as PairingTokenActorScope;
  }
  throw new Error(`Persisted pairing token actor scope '${value}' is invalid.`);
}

function assertPairingTokenInvalidationReason(value: string): PairingTokenInvalidationReason {
  if (Object.values(PairingTokenInvalidationReasons).includes(value as PairingTokenInvalidationReason)) {
    return value as PairingTokenInvalidationReason;
  }
  throw new Error(`Persisted pairing token invalidation reason '${value}' is invalid.`);
}

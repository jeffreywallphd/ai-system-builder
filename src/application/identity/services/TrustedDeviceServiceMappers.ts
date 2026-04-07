import type {
  TrustedDevicePairingSessionRecord,
  TrustedDevicePairingTokenRecord,
  TrustedDeviceRecord,
} from "../../contracts/IdentityApplicationContracts";
import {
  createPairingSession,
  createPairingToken,
  type PairingSession,
  type PairingToken,
} from "@domain/identity/TrustedDevicePairingDomain";
import type { TrustedDevice } from "@domain/identity/TrustedDeviceDomain";

export function mapTrustedDeviceRecord(device: TrustedDevice): TrustedDeviceRecord {
  return Object.freeze({
    id: device.id,
    userIdentityId: device.userIdentityId,
    workspaceId: device.workspaceId,
    displayName: device.displayName,
    fingerprint: device.fingerprint,
    pairingMethod: device.pairingMethod,
    trustStatus: device.trustStatus,
    trustMaterialRef: device.trustMaterialRef,
    registeredAt: device.registeredAt,
    pairedAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt,
    metadata: device.metadata,
    revocation: device.revocation,
    updatedAt: device.updatedAt,
  });
}

export function mapPairingTokenRecord(token: PairingToken): TrustedDevicePairingTokenRecord {
  return Object.freeze({
    id: token.id,
    pairingSessionId: token.pairingSessionId,
    trustedDeviceId: token.trustedDeviceId,
    userIdentityId: token.userIdentityId,
    workspaceId: token.workspaceId,
    artifactType: token.artifactType,
    tokenHash: token.tokenHash,
    hashAlgorithm: token.hashAlgorithm,
    actorBinding: token.actorBinding,
    issuance: token.issuance,
    status: token.status,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    failedValidationAttempts: token.attempts.failedValidationAttempts,
    maxValidationAttempts: token.attempts.maxValidationAttempts,
    lastValidationAttemptAt: token.attempts.lastValidationAttemptAt,
    consumedAt: token.consumed?.consumedAt,
    consumedByUserIdentityId: token.consumed?.consumedByUserIdentityId,
    invalidationReason: token.invalidation?.reason,
    invalidatedAt: token.invalidation?.invalidatedAt,
    invalidatedByUserIdentityId: token.invalidation?.invalidatedByUserIdentityId,
    invalidationNote: token.invalidation?.note,
    updatedAt: token.updatedAt,
  });
}

export function mapPairingSessionRecord(session: PairingSession): TrustedDevicePairingSessionRecord {
  return Object.freeze({
    id: session.id,
    trustedDeviceId: session.trustedDeviceId,
    userIdentityId: session.userIdentityId,
    workspaceId: session.workspaceId,
    pairingTokenId: session.pairingTokenId,
    status: session.status,
    initiatedAt: session.initiatedAt,
    validatedAt: session.validatedAt,
    completedAt: session.completion?.completedAt,
    completedByUserIdentityId: session.completion?.completedByUserIdentityId,
    trustMaterialRegistration: session.completion?.trustMaterialRegistration,
    rejectedAt: session.rejection?.rejectedAt,
    rejectionReason: session.rejection?.reason,
    rejectionNote: session.rejection?.note,
    invalidatedAt: session.invalidatedAt,
    expiredAt: session.expiredAt,
    updatedAt: session.updatedAt,
  });
}

export function mapTokenRecordToDomain(token: TrustedDevicePairingTokenRecord): PairingToken {
  return createPairingToken({
    ...token,
    attempts: {
      failedValidationAttempts: token.failedValidationAttempts,
      maxValidationAttempts: token.maxValidationAttempts,
      lastValidationAttemptAt: token.lastValidationAttemptAt,
    },
    consumed: token.consumedAt
      ? {
          consumedAt: token.consumedAt,
          consumedByUserIdentityId: token.consumedByUserIdentityId,
        }
      : undefined,
    invalidation: token.invalidationReason && token.invalidatedAt
      ? {
          reason: token.invalidationReason,
          invalidatedAt: token.invalidatedAt,
          invalidatedByUserIdentityId: token.invalidatedByUserIdentityId,
          note: token.invalidationNote,
        }
      : undefined,
  });
}

export function mapSessionRecordToDomain(session: TrustedDevicePairingSessionRecord): PairingSession {
  return createPairingSession({
    ...session,
    completion: session.completedAt
      ? {
          completedAt: session.completedAt,
          completedByUserIdentityId: session.completedByUserIdentityId,
          trustMaterialRegistration: session.trustMaterialRegistration,
        }
      : undefined,
    rejection: session.rejectionReason && session.rejectedAt
      ? {
          reason: session.rejectionReason,
          rejectedAt: session.rejectedAt,
          note: session.rejectionNote,
        }
      : undefined,
  });
}


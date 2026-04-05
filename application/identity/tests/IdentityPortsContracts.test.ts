import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  CredentialStatuses,
  IdentitySessionStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createSession,
  createUserIdentity,
  revokeSession,
} from "../../../src/domain/identity/IdentityDomain";
import {
  DeviceTrustStatuses,
  DeviceFingerprintAlgorithms,
  DevicePairingMethods,
  DeviceRevocationReasons,
  DeviceTrustMaterialKinds,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
  pairTrustedDevice,
  revokeTrustedDevice,
  touchTrustedDevice,
  updateTrustedDeviceDisplayName,
  type TrustedDevice,
} from "../../../src/domain/identity/TrustedDeviceDomain";
import {
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenArtifactTypes,
  PairingTokenInvalidationReasons,
  PairingTokenStatuses,
  completePairingSession,
  consumePairingToken,
  createPairingSession,
  createPairingToken,
  expirePairingSession,
  expirePairingToken,
  invalidatePairingSession,
  invalidatePairingToken,
  markPairingSessionValidated,
  registerPairingTokenFailedAttempt,
  type PairingSession,
  type PairingToken,
} from "../../../src/domain/identity/TrustedDevicePairingDomain";
import {
  IdentityErrorCodes,
  IdentityCredentialMaterialStatuses,
  IdentityIdNamespaces,
  IdentityPrincipalLookupKinds,
  PairingTokenValidationOutcomes,
  identityFailure,
  identitySuccess,
  type IdentityCredentialHistoryQuery,
  type IdentityCredentialMaterialRecord,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type IdentityPrincipalLookup,
  type IdentityProviderSubjectReference,
  type IdentitySessionListQuery,
  type IdentityUserIdentityListQuery,
  type TrustedDeviceDisplayNameUpdate,
  type TrustedDeviceLastSeenUpdate,
  type TrustedDevicePairingCompletionRequest,
  type TrustedDevicePairingCompletionResponse,
  type TrustedDevicePairingExpirationRequest,
  type TrustedDevicePairingExpirationResult,
  type TrustedDevicePairingInitiationRequest,
  type TrustedDevicePairingInitiationResponse,
  type TrustedDevicePairingInvalidationRequest,
  type TrustedDevicePairingSessionRecord,
  type TrustedDevicePairingTokenRecord,
  type TrustedDevicePairingValidationRequest,
  type TrustedDevicePairingValidationResponse,
  type TrustedDeviceListQuery,
  type TrustedDeviceLookupByFingerprintQuery,
  type TrustedDevicePairingRequest,
  type TrustedDeviceRecord,
  type TrustedDeviceRegistrationRequest,
  type TrustedDeviceRevocationRequest,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import type { ITrustedDeviceManagementService } from "../ports/ITrustedDeviceManagementService";
import type { ITrustedDevicePairingRepository } from "../ports/ITrustedDevicePairingRepository";
import type { ITrustedDevicePairingService } from "../ports/ITrustedDevicePairingService";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";

class InMemoryIdentityPortAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    ITrustedDeviceRepository,
    ITrustedDevicePairingRepository,
    IIdentityClock,
    IIdentityIdGenerator {
  private readonly users = new Map<string, ReturnType<typeof createUserIdentity>>();
  private readonly providers = new Map<string, ReturnType<typeof createAuthProvider>>();
  private readonly policies = new Map<string, ReturnType<typeof createCredentialPolicy>>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private readonly sessions = new Map<string, ReturnType<typeof createSession>>();
  private readonly trustedDevices = new Map<string, TrustedDevice>();
  private readonly pairingSessions = new Map<string, PairingSession>();
  private readonly pairingTokens = new Map<string, PairingToken>();
  private sequence = 0;

  now(): Date {
    return new Date("2026-04-04T12:00:00.000Z");
  }

  nextId(namespace: typeof IdentityIdNamespaces[keyof typeof IdentityIdNamespaces]): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }

  async saveUserIdentity(identity: ReturnType<typeof createUserIdentity>) {
    this.users.set(identity.id, identity);
    return identity;
  }

  async saveAuthProvider(provider: ReturnType<typeof createAuthProvider>) {
    this.providers.set(provider.id, provider);
    return provider;
  }

  async saveCredentialPolicy(policy: ReturnType<typeof createCredentialPolicy>) {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async findUserIdentityById(userIdentityId: string) {
    return this.users.get(userIdentityId.trim());
  }

  async countUserIdentities() {
    return this.users.size;
  }

  async listUserIdentities(query: IdentityUserIdentityListQuery) {
    const filtered = [...this.users.values()]
      .filter((user) => (
        !query.providerId || user.linkedProviders.some((link) => !link.unlinkedAt && link.providerId === query.providerId)
      ))
      .filter((user) => (
        !query.includeStatuses || query.includeStatuses.length === 0 || query.includeStatuses.includes(user.status)
      ));
    return Object.freeze(filtered);
  }

  async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup) {
    const normalizedValue = lookup.value.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (lookup.kind === IdentityPrincipalLookupKinds.username && user.username === normalizedValue) {
        return user;
      }
      if (lookup.kind === IdentityPrincipalLookupKinds.email && user.email === normalizedValue) {
        return user;
      }
    }
    return undefined;
  }

  async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference) {
    for (const user of this.users.values()) {
      const link = user.linkedProviders.find((entry) => (
        entry.providerId === reference.providerId &&
        entry.providerSubject === reference.providerSubject
      ));
      if (link) {
        return user;
      }
    }
    return undefined;
  }

  async findAuthProviderById(providerId: string) {
    return this.providers.get(providerId.trim());
  }

  async findCredentialPolicyById(policyId: string) {
    return this.policies.get(policyId.trim());
  }

  async getActiveCredentialMaterial(reference: IdentityProviderSubjectReference) {
    for (const material of this.credentialMaterial.values()) {
      if (
        material.providerId === reference.providerId &&
        material.providerSubject === reference.providerSubject &&
        material.status === IdentityCredentialMaterialStatuses.active
      ) {
        return material;
      }
    }
    return undefined;
  }

  async listCredentialMaterialHistory(query: IdentityCredentialHistoryQuery) {
    const includeInactive = query.includeInactive ?? false;
    const records = [...this.credentialMaterial.values()]
      .filter((material) => (
        material.providerId === query.reference.providerId &&
        material.providerSubject === query.reference.providerSubject &&
        (includeInactive || material.status === IdentityCredentialMaterialStatuses.active)
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    if (query.limit && query.limit > 0) {
      return records.slice(0, query.limit);
    }
    return records;
  }

  async saveCredentialMaterial(record: IdentityCredentialMaterialRecord) {
    this.credentialMaterial.set(record.id, record);
    return record;
  }

  async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidRequest>> {
    const record = this.credentialMaterial.get(recordId.trim());
    if (!record) {
      return identityFailure({
        code: IdentityErrorCodes.invalidRequest,
        message: "Credential material record was not found.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    this.credentialMaterial.set(record.id, {
      ...record,
      status: IdentityCredentialMaterialStatuses.superseded,
      supersededAt,
      updatedAt: supersededAt,
    });
    return identitySuccess({ changed: true });
  }

  async saveSession(session: ReturnType<typeof createSession>) {
    this.sessions.set(session.id, session);
    return session;
  }

  async getSessionById(sessionId: string) {
    return this.sessions.get(sessionId.trim());
  }

  async listSessionsByUserIdentityId(query: IdentitySessionListQuery) {
    const includeStatuses = query.includeStatuses;
    const expiresBefore = query.expiresBefore ? new Date(query.expiresBefore).getTime() : undefined;
    const expiresAfter = query.expiresAfter ? new Date(query.expiresAfter).getTime() : undefined;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;

    const sessions = [...this.sessions.values()].filter((session) => {
      if (session.userIdentityId !== query.userIdentityId) {
        return false;
      }
      if (includeStatuses && includeStatuses.length > 0 && !includeStatuses.includes(session.status)) {
        return false;
      }
      const expiresAt = new Date(session.expiresAt).getTime();
      if (expiresBefore !== undefined && expiresAt >= expiresBefore) {
        return false;
      }
      if (expiresAfter !== undefined && expiresAt <= expiresAfter) {
        return false;
      }
      return true;
    });

    return limit ? sessions.slice(0, limit) : sessions;
  }

  async removeSession(
    sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return identityFailure({
        code: IdentityErrorCodes.invalidSessionState,
        message: "Session id is required.",
        boundary: "infrastructure",
        retryable: false,
      });
    }
    return identitySuccess({
      changed: this.sessions.delete(normalizedSessionId),
    });
  }

  async createTrustedDevice(device: TrustedDevice) {
    this.trustedDevices.set(device.id, device);
    return device;
  }

  async getTrustedDeviceById(trustedDeviceId: string) {
    return this.trustedDevices.get(trustedDeviceId.trim());
  }

  async findTrustedDeviceByFingerprint(query: TrustedDeviceLookupByFingerprintQuery) {
    for (const trustedDevice of this.trustedDevices.values()) {
      const workspaceMatches = query.workspaceId
        ? trustedDevice.workspaceId === query.workspaceId
        : true;
      if (
        trustedDevice.userIdentityId === query.userIdentityId &&
        workspaceMatches &&
        trustedDevice.fingerprint.algorithm === query.fingerprint.algorithm &&
        trustedDevice.fingerprint.value === query.fingerprint.value
      ) {
        return trustedDevice;
      }
    }
    return undefined;
  }

  async listTrustedDevices(query: TrustedDeviceListQuery) {
    const devices = [...this.trustedDevices.values()]
      .filter((trustedDevice) => trustedDevice.userIdentityId === query.userIdentityId)
      .filter((trustedDevice) => !query.workspaceId || trustedDevice.workspaceId === query.workspaceId)
      .filter((trustedDevice) => (
        !query.includeStatuses ||
        query.includeStatuses.length === 0 ||
        query.includeStatuses.includes(trustedDevice.trustStatus)
      ));

    const offset = query.offset && query.offset > 0 ? query.offset : 0;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    const paged = offset > 0 ? devices.slice(offset) : devices;
    return limit ? paged.slice(0, limit) : paged;
  }

  async updateTrustedDevice(device: TrustedDevice) {
    this.trustedDevices.set(device.id, device);
    return device;
  }

  async revokeTrustedDevice(
    request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    const trustedDeviceId = request.trustedDeviceId.trim();
    if (!trustedDeviceId) {
      return identityFailure({
        code: IdentityErrorCodes.invalidRequest,
        message: "Trusted device id is required.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    const trustedDevice = this.trustedDevices.get(trustedDeviceId);
    if (!trustedDevice) {
      return identityFailure({
        code: IdentityErrorCodes.notFound,
        message: "Trusted device was not found.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    if (trustedDevice.trustStatus === DeviceTrustStatuses.revoked) {
      return identityFailure({
        code: IdentityErrorCodes.invalidState,
        message: "Trusted device is already revoked.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    const revoked = revokeTrustedDevice(trustedDevice, {
      reason: request.reason,
      revokedAt: request.revokedAt ?? new Date().toISOString(),
      revokedByUserIdentityId: request.revokedByUserIdentityId,
      note: request.note,
    });
    this.trustedDevices.set(revoked.id, revoked);
    return identitySuccess({ changed: true });
  }

  async createPairingSession(session: TrustedDevicePairingSessionRecord) {
    const domain = createPairingSession({
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
    this.pairingSessions.set(domain.id, domain);
    return mapPairingSessionRecord(domain);
  }

  async createPairingToken(token: TrustedDevicePairingTokenRecord) {
    const domain = createPairingToken({
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
    this.pairingTokens.set(domain.id, domain);
    return mapPairingTokenRecord(domain);
  }

  async getPairingSessionById(pairingSessionId: string) {
    const session = this.pairingSessions.get(pairingSessionId.trim());
    return session ? mapPairingSessionRecord(session) : undefined;
  }

  async getPairingTokenById(pairingTokenId: string) {
    const token = this.pairingTokens.get(pairingTokenId.trim());
    return token ? mapPairingTokenRecord(token) : undefined;
  }

  async getPairingTokenBySessionId(pairingSessionId: string) {
    for (const token of this.pairingTokens.values()) {
      if (token.pairingSessionId === pairingSessionId.trim()) {
        return mapPairingTokenRecord(token);
      }
    }
    return undefined;
  }

  async updatePairingSession(session: TrustedDevicePairingSessionRecord) {
    const updated = await this.createPairingSession(session);
    return updated;
  }

  async updatePairingToken(token: TrustedDevicePairingTokenRecord) {
    const updated = await this.createPairingToken(token);
    return updated;
  }

  async invalidatePairingArtifacts(
    request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    if (!request.pairingSessionId && !request.pairingTokenId) {
      return identityFailure({
        code: IdentityErrorCodes.invalidRequest,
        message: "Pairing session id or pairing token id is required.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    let changed = false;
    if (request.pairingTokenId) {
      const pairingToken = this.pairingTokens.get(request.pairingTokenId);
      if (!pairingToken) {
        return identityFailure({
          code: IdentityErrorCodes.notFound,
          message: "Pairing token was not found.",
          boundary: "infrastructure",
          retryable: false,
        });
      }
      if (pairingToken.status === PairingTokenStatuses.issued) {
        const invalidated = invalidatePairingToken(pairingToken, {
          reason: request.reason,
          invalidatedByUserIdentityId: request.invalidatedByUserIdentityId,
          note: request.note,
          invalidatedAt: request.invalidatedAt ?? this.now().toISOString(),
        });
        this.pairingTokens.set(invalidated.id, invalidated);
        changed = true;
      }
    }

    if (request.pairingSessionId) {
      const pairingSession = this.pairingSessions.get(request.pairingSessionId);
      if (!pairingSession) {
        return identityFailure({
          code: IdentityErrorCodes.notFound,
          message: "Pairing session was not found.",
          boundary: "infrastructure",
          retryable: false,
        });
      }
      if (pairingSession.status === PairingSessionStatuses.completed) {
        return identityFailure({
          code: IdentityErrorCodes.invalidState,
          message: "Completed pairing sessions cannot be invalidated.",
          boundary: "infrastructure",
          retryable: false,
        });
      }
      const invalidatedSession = invalidatePairingSession(pairingSession, {
        invalidatedAt: request.invalidatedAt ?? this.now().toISOString(),
      });
      this.pairingSessions.set(invalidatedSession.id, invalidatedSession);
      changed = true;
    }

    return identitySuccess({
      changed,
    });
  }
}

function mapTrustedDeviceRecord(device: TrustedDevice): TrustedDeviceRecord {
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

function mapPairingTokenRecord(token: PairingToken): TrustedDevicePairingTokenRecord {
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

function mapPairingSessionRecord(session: PairingSession): TrustedDevicePairingSessionRecord {
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

class InMemoryTrustedDeviceManagementService implements ITrustedDeviceManagementService {
  constructor(
    private readonly repository: ITrustedDeviceRepository,
    private readonly idGenerator: IIdentityIdGenerator,
    private readonly clock: IIdentityClock,
  ) {}

  async registerTrustedDevice(request: TrustedDeviceRegistrationRequest): Promise<TrustedDeviceRecord> {
    const trustedDevice = createTrustedDevice({
      id: this.idGenerator.nextId(IdentityIdNamespaces.trustedDevice),
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      displayName: request.displayName,
      fingerprint: request.fingerprint,
      pairingMethod: request.pairingMethod,
      registeredAt: request.registeredAt ?? this.clock.now(),
      metadata: request.metadata,
    });
    const created = await this.repository.createTrustedDevice(trustedDevice);
    return mapTrustedDeviceRecord(created);
  }

  async getTrustedDeviceById(trustedDeviceId: string): Promise<TrustedDeviceRecord | undefined> {
    const trustedDevice = await this.repository.getTrustedDeviceById(trustedDeviceId);
    return trustedDevice ? mapTrustedDeviceRecord(trustedDevice) : undefined;
  }

  async listTrustedDevices(query: TrustedDeviceListQuery): Promise<ReadonlyArray<TrustedDeviceRecord>> {
    const devices = await this.repository.listTrustedDevices(query);
    return Object.freeze(devices.map((trustedDevice) => mapTrustedDeviceRecord(trustedDevice)));
  }

  async pairTrustedDevice(request: TrustedDevicePairingRequest): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }
    const paired = pairTrustedDevice(trustedDevice, {
      trustMaterialRef: request.trustMaterialRef,
      pairedAt: request.pairedAt ?? this.clock.now(),
      now: this.clock.now(),
    });
    const updated = await this.repository.updateTrustedDevice(paired);
    return mapTrustedDeviceRecord(updated);
  }

  async updateTrustedDeviceDisplayName(request: TrustedDeviceDisplayNameUpdate): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }
    const updated = updateTrustedDeviceDisplayName(
      trustedDevice,
      request.displayName,
      request.updatedAt ? new Date(request.updatedAt) : this.clock.now(),
    );
    const persisted = await this.repository.updateTrustedDevice(updated);
    return mapTrustedDeviceRecord(persisted);
  }

  async recordTrustedDeviceLastSeen(request: TrustedDeviceLastSeenUpdate): Promise<TrustedDeviceRecord> {
    const trustedDevice = await this.repository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }
    const updated = touchTrustedDevice(trustedDevice, {
      seenAt: request.seenAt,
      metadataPatch: request.metadataPatch,
    });
    const persisted = await this.repository.updateTrustedDevice(updated);
    return mapTrustedDeviceRecord(persisted);
  }

  async revokeTrustedDevice(
    request: TrustedDeviceRevocationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    return this.repository.revokeTrustedDevice(request);
  }
}

class InMemoryTrustedDevicePairingService implements ITrustedDevicePairingService {
  constructor(
    private readonly trustedDeviceRepository: ITrustedDeviceRepository,
    private readonly pairingRepository: ITrustedDevicePairingRepository,
    private readonly idGenerator: IIdentityIdGenerator,
    private readonly clock: IIdentityClock,
  ) {}

  async initiatePairing(request: TrustedDevicePairingInitiationRequest): Promise<TrustedDevicePairingInitiationResponse> {
    const now = this.clock.now().toISOString();
    const pairingSessionId = this.idGenerator.nextId(IdentityIdNamespaces.trustedDevicePairingSession);
    const pairingTokenId = this.idGenerator.nextId(IdentityIdNamespaces.trustedDevicePairingToken);
    const token = createPairingToken({
      id: pairingTokenId,
      pairingSessionId,
      trustedDeviceId: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      artifactType: request.artifactType,
      tokenHash: `hash:${pairingTokenId}`,
      actorBinding: request.actorBinding,
      issuance: request.issuance,
      attempts: {
        maxValidationAttempts: request.maxValidationAttempts,
      },
      issuedAt: now,
      expiresAt: request.expiresAt,
    });
    const session = createPairingSession({
      id: pairingSessionId,
      trustedDeviceId: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      pairingTokenId,
      initiatedAt: now,
    });

    const persistedSession = await this.pairingRepository.createPairingSession(mapPairingSessionRecord(session));
    const persistedToken = await this.pairingRepository.createPairingToken(mapPairingTokenRecord(token));

    return Object.freeze({
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      artifact: {
        type: request.artifactType,
        value: `artifact:${pairingTokenId}`,
        redactedHint: "******",
      },
    });
  }

  async validatePairingToken(request: TrustedDevicePairingValidationRequest): Promise<TrustedDevicePairingValidationResponse> {
    const sessionRecord = await this.pairingRepository.getPairingSessionById(request.pairingSessionId);
    if (!sessionRecord) {
      throw new Error(`Pairing session '${request.pairingSessionId}' was not found.`);
    }
    const tokenRecord = request.pairingTokenId
      ? await this.pairingRepository.getPairingTokenById(request.pairingTokenId)
      : await this.pairingRepository.getPairingTokenBySessionId(request.pairingSessionId);
    if (!tokenRecord) {
      throw new Error("Pairing token was not found.");
    }

    let token = createPairingToken({
      ...tokenRecord,
      attempts: {
        failedValidationAttempts: tokenRecord.failedValidationAttempts,
        maxValidationAttempts: tokenRecord.maxValidationAttempts,
        lastValidationAttemptAt: tokenRecord.lastValidationAttemptAt,
      },
      consumed: tokenRecord.consumedAt
        ? {
            consumedAt: tokenRecord.consumedAt,
            consumedByUserIdentityId: tokenRecord.consumedByUserIdentityId,
          }
        : undefined,
      invalidation: tokenRecord.invalidationReason && tokenRecord.invalidatedAt
        ? {
            reason: tokenRecord.invalidationReason,
            invalidatedAt: tokenRecord.invalidatedAt,
            invalidatedByUserIdentityId: tokenRecord.invalidatedByUserIdentityId,
            note: tokenRecord.invalidationNote,
          }
        : undefined,
    });
    let session = createPairingSession({
      ...sessionRecord,
      completion: sessionRecord.completedAt
        ? {
            completedAt: sessionRecord.completedAt,
            completedByUserIdentityId: sessionRecord.completedByUserIdentityId,
            trustMaterialRegistration: sessionRecord.trustMaterialRegistration,
          }
        : undefined,
      rejection: sessionRecord.rejectionReason && sessionRecord.rejectedAt
        ? {
            reason: sessionRecord.rejectionReason,
            rejectedAt: sessionRecord.rejectedAt,
            note: sessionRecord.rejectionNote,
          }
        : undefined,
    });

    if (token.status === PairingTokenStatuses.expired || new Date(token.expiresAt).getTime() <= this.clock.now().getTime()) {
      if (token.status === PairingTokenStatuses.issued) {
        token = expirePairingToken(token, this.clock.now());
      }
      session = expirePairingSession(session, this.clock.now());
      const persistedToken = await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));
      const persistedSession = await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
      return Object.freeze({
        outcome: PairingTokenValidationOutcomes.expired,
        pairingSession: persistedSession,
        pairingToken: persistedToken,
        attemptsRemaining: 0,
      });
    }

    if (token.status === PairingTokenStatuses.consumed) {
      session = rejectPairingSession(session, {
        reason: "token-reused",
        rejectedAt: this.clock.now().toISOString(),
      });
      const persistedSession = await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
      return Object.freeze({
        outcome: PairingTokenValidationOutcomes.reused,
        pairingSession: persistedSession,
        pairingToken: tokenRecord,
        attemptsRemaining: 0,
      });
    }

    if (token.status === PairingTokenStatuses.invalidated) {
      return Object.freeze({
        outcome: PairingTokenValidationOutcomes.invalidated,
        pairingSession: sessionRecord,
        pairingToken: tokenRecord,
        attemptsRemaining: 0,
      });
    }

    const expectedValue = `artifact:${token.id}`;
    if (request.presentedToken !== expectedValue) {
      token = registerPairingTokenFailedAttempt(token, {
        attemptedAt: request.attemptedAt ?? this.clock.now().toISOString(),
        invalidatedByUserIdentityId: request.userIdentityId,
      });
      let outcome = PairingTokenValidationOutcomes.invalid;
      if (token.status === PairingTokenStatuses.invalidated) {
        session = rejectPairingSession(session, {
          reason: "invalid-token",
          rejectedAt: this.clock.now().toISOString(),
          note: "max attempts reached",
        });
        outcome = PairingTokenValidationOutcomes.attemptsExhausted;
      }
      const persistedToken = await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));
      const persistedSession = await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
      return Object.freeze({
        outcome,
        pairingSession: persistedSession,
        pairingToken: persistedToken,
        attemptsRemaining: Math.max(
          persistedToken.maxValidationAttempts - persistedToken.failedValidationAttempts,
          0,
        ),
      });
    }

    session = markPairingSessionValidated(session, {
      validatedAt: request.attemptedAt ?? this.clock.now().toISOString(),
    });
    const persistedSession = await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
    const persistedToken = await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));
    return Object.freeze({
      outcome: PairingTokenValidationOutcomes.valid,
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      attemptsRemaining: Math.max(token.attempts.maxValidationAttempts - token.attempts.failedValidationAttempts, 0),
    });
  }

  async completePairing(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevicePairingCompletionResponse> {
    const sessionRecord = await this.pairingRepository.getPairingSessionById(request.pairingSessionId);
    const tokenRecord = await this.pairingRepository.getPairingTokenById(request.pairingTokenId);
    const trustedDevice = await this.trustedDeviceRepository.getTrustedDeviceById(request.trustedDeviceId);
    if (!sessionRecord || !tokenRecord || !trustedDevice) {
      throw new Error("Pairing completion dependencies were not found.");
    }

    let token = createPairingToken({
      ...tokenRecord,
      attempts: {
        failedValidationAttempts: tokenRecord.failedValidationAttempts,
        maxValidationAttempts: tokenRecord.maxValidationAttempts,
        lastValidationAttemptAt: tokenRecord.lastValidationAttemptAt,
      },
    });
    let session = createPairingSession({
      ...sessionRecord,
      completion: sessionRecord.completedAt
        ? {
            completedAt: sessionRecord.completedAt,
            completedByUserIdentityId: sessionRecord.completedByUserIdentityId,
            trustMaterialRegistration: sessionRecord.trustMaterialRegistration,
          }
        : undefined,
      rejection: sessionRecord.rejectionReason && sessionRecord.rejectedAt
        ? {
            reason: sessionRecord.rejectionReason,
            rejectedAt: sessionRecord.rejectedAt,
            note: sessionRecord.rejectionNote,
          }
        : undefined,
    });

    if (request.presentedToken !== `artifact:${token.id}`) {
      token = invalidatePairingToken(token, {
        reason: PairingTokenInvalidationReasons.invalidTokenPresented,
        invalidatedByUserIdentityId: request.userIdentityId,
        invalidatedAt: this.clock.now().toISOString(),
      });
      session = rejectPairingSession(session, {
        reason: "invalid-token",
        rejectedAt: this.clock.now().toISOString(),
      });
      await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));
      await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
      throw new Error("Pairing token presented for completion is invalid.");
    }

    token = consumePairingToken(token, {
      consumedAt: request.completedAt ?? this.clock.now().toISOString(),
      consumedByUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
    });
    if (session.status !== PairingSessionStatuses.validated) {
      session = markPairingSessionValidated(session, {
        validatedAt: request.completedAt ?? this.clock.now().toISOString(),
      });
    }
    session = completePairingSession(session, token, {
      completedAt: request.completedAt ?? this.clock.now().toISOString(),
      completedByUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
      trustMaterialRegistration: request.trustMaterialRegistration,
    });
    const pairedDevice = pairTrustedDevice(trustedDevice, {
      trustMaterialRef: request.trustMaterialRef ?? createDeviceTrustMaterialRef({
        materialId: `trust-material:${trustedDevice.id}`,
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
      }),
      pairedAt: request.completedAt ?? this.clock.now().toISOString(),
      now: this.clock.now(),
    });

    const persistedToken = await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));
    const persistedSession = await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(session));
    const persistedDevice = await this.trustedDeviceRepository.updateTrustedDevice(pairedDevice);

    return Object.freeze({
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      trustedDevice: mapTrustedDeviceRecord(persistedDevice),
    });
  }

  async expirePairingAttempts(request: TrustedDevicePairingExpirationRequest): Promise<TrustedDevicePairingExpirationResult> {
    let expiredTokens = 0;
    let expiredSessions = 0;
    const expiresBeforeTime = new Date(request.expiresBefore).getTime();
    if (request.pairingTokenId) {
      const tokenRecord = await this.pairingRepository.getPairingTokenById(request.pairingTokenId);
      if (tokenRecord) {
        const token = createPairingToken({
          ...tokenRecord,
          attempts: {
            failedValidationAttempts: tokenRecord.failedValidationAttempts,
            maxValidationAttempts: tokenRecord.maxValidationAttempts,
            lastValidationAttemptAt: tokenRecord.lastValidationAttemptAt,
          },
        });
        if (
          token.status === PairingTokenStatuses.issued &&
          new Date(token.expiresAt).getTime() <= expiresBeforeTime
        ) {
          await this.pairingRepository.updatePairingToken(mapPairingTokenRecord(expirePairingToken(token, new Date(request.expiresBefore))));
          expiredTokens += 1;
        }
      }
    }

    if (request.pairingSessionId) {
      const sessionRecord = await this.pairingRepository.getPairingSessionById(request.pairingSessionId);
      if (sessionRecord) {
        const session = createPairingSession({
          ...sessionRecord,
          completion: sessionRecord.completedAt
            ? {
                completedAt: sessionRecord.completedAt,
                completedByUserIdentityId: sessionRecord.completedByUserIdentityId,
                trustMaterialRegistration: sessionRecord.trustMaterialRegistration,
              }
            : undefined,
          rejection: sessionRecord.rejectionReason && sessionRecord.rejectedAt
            ? {
                reason: sessionRecord.rejectionReason,
                rejectedAt: sessionRecord.rejectedAt,
                note: sessionRecord.rejectionNote,
              }
            : undefined,
        });
        if (
          (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated) &&
          new Date(session.initiatedAt).getTime() <= expiresBeforeTime
        ) {
          await this.pairingRepository.updatePairingSession(mapPairingSessionRecord(expirePairingSession(session, new Date(request.expiresBefore))));
          expiredSessions += 1;
        }
      }
    }

    return Object.freeze({
      expiredSessions,
      expiredTokens,
    });
  }

  async invalidatePairing(
    request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    return this.pairingRepository.invalidatePairingArtifacts(request);
  }
}

describe("identity application ports contracts", () => {
  it("supports registration and login lookup seams across principal and provider subject", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const provider = await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    const policy = await adapter.saveCredentialPolicy(createCredentialPolicy({ id: "policy:local" }));
    const user = await adapter.saveUserIdentity(createUserIdentity({
      id: "user:1",
      username: "Alice",
      email: "Alice@example.com",
      linkedProviders: [{
        providerId: provider.id,
        providerSubject: "alice-local",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
        credentialState: {
          status: CredentialStatuses.active,
          policyId: policy.id,
          failedAttempts: 0,
        },
      }],
    }));

    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: "alice",
    }))?.id).toBe(user.id);
    expect(await adapter.countUserIdentities()).toBe(1);

    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.email,
      value: "ALICE@EXAMPLE.COM",
    }))?.id).toBe(user.id);

    expect((await adapter.findUserIdentityByProviderSubject({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe(user.id);
  });

  it("supports credential material history and session persistence seams", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const recordId = adapter.nextId(IdentityIdNamespaces.credentialMaterial);
    await adapter.saveCredentialMaterial({
      id: recordId,
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    const activeCredential = await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "alice-local",
    });
    expect(activeCredential?.id).toBe(recordId);

    const superseded = await adapter.markCredentialMaterialSuperseded(recordId, "2026-04-04T13:00:00.000Z");
    expect(superseded.ok).toBe(true);
    if (superseded.ok) {
      expect(superseded.value.changed).toBe(true);
    }
    expect((await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "alice-local",
    }))?.id).toBeUndefined();

    const fullHistory = await adapter.listCredentialMaterialHistory({
      reference: { providerId: "provider:local-password", providerSubject: "alice-local" },
      includeInactive: true,
    });
    expect(fullHistory).toHaveLength(1);
    expect(fullHistory[0]?.status).toBe(IdentityCredentialMaterialStatuses.superseded);

    const activeSession = await adapter.saveSession(createSession({
      id: "session:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
    }));
    const revokedSession = await adapter.saveSession(revokeSession(createSession({
      id: "session:2",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
    }), "logout", new Date("2026-04-04T12:30:00.000Z")));

    const list = await adapter.listSessionsByUserIdentityId({
      userIdentityId: "user:1",
      includeStatuses: [IdentitySessionStatuses.active],
    });
    expect(list.map((session) => session.id)).toEqual([activeSession.id]);
    expect(revokedSession.status).toBe(IdentitySessionStatuses.revoked);

    const invalidRemoval = await adapter.removeSession("   ");
    expect(invalidRemoval).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-session-state",
      }),
    });
  });

  it("supports trusted-device repository and service lifecycle actions", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const service = new InMemoryTrustedDeviceManagementService(adapter, adapter, adapter);

    const registered = await service.registerTrustedDevice({
      userIdentityId: "user:trusted:1",
      workspaceId: "workspace:trusted:1",
      displayName: "Jeff Workstation",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "trusted-fingerprint-1",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      metadata: {
        platform: "desktop",
      },
      registeredAt: "2026-04-04T12:00:00.000Z",
    });
    expect(registered.id).toBe("trusted-device:1");
    expect(registered.trustStatus).toBe(DeviceTrustStatuses.pendingPairing);

    const paired = await service.pairTrustedDevice({
      trustedDeviceId: registered.id,
      trustMaterialRef: createDeviceTrustMaterialRef({
        materialId: "trust-material:trusted:1",
        kind: DeviceTrustMaterialKinds.attestationKey,
      }),
      pairedAt: "2026-04-04T12:01:00.000Z",
    });
    expect(paired.trustStatus).toBe(DeviceTrustStatuses.trusted);

    const renamed = await service.updateTrustedDeviceDisplayName({
      trustedDeviceId: registered.id,
      displayName: "Jeff Workstation Renamed",
      updatedAt: "2026-04-04T12:01:30.000Z",
    });
    expect(renamed.displayName.value).toBe("Jeff Workstation Renamed");

    const touched = await service.recordTrustedDeviceLastSeen({
      trustedDeviceId: registered.id,
      seenAt: "2026-04-04T12:02:00.000Z",
      metadataPatch: {
        appVersion: "0.1.0",
      },
    });
    expect(touched.lastSeenAt).toBe("2026-04-04T12:02:00.000Z");
    expect(touched.metadata.appVersion).toBe("0.1.0");

    const byFingerprint = await adapter.findTrustedDeviceByFingerprint({
      userIdentityId: "user:trusted:1",
      workspaceId: "workspace:trusted:1",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "trusted-fingerprint-1",
      }),
    });
    expect(byFingerprint?.id).toBe(registered.id);

    const listed = await service.listTrustedDevices({
      userIdentityId: "user:trusted:1",
      includeStatuses: [DeviceTrustStatuses.trusted],
      limit: 10,
    });
    expect(listed).toHaveLength(1);

    const revoked = await service.revokeTrustedDevice({
      trustedDeviceId: registered.id,
      reason: DeviceRevocationReasons.suspectedCompromise,
      revokedByUserIdentityId: "admin:1",
      note: "Potential theft",
      revokedAt: "2026-04-04T12:03:00.000Z",
    });
    expect(revoked).toEqual({
      ok: true,
      value: {
        changed: true,
      },
    });

    const revokedAgain = await service.revokeTrustedDevice({
      trustedDeviceId: registered.id,
      reason: DeviceRevocationReasons.adminAction,
    });
    expect(revokedAgain).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-state",
      }),
    });
  });

  it("supports trusted-device pairing initiation, validation, completion, expiration, and invalidation seams", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const trustedDeviceService = new InMemoryTrustedDeviceManagementService(adapter, adapter, adapter);
    const pairingService = new InMemoryTrustedDevicePairingService(adapter, adapter, adapter, adapter);

    const registered = await trustedDeviceService.registerTrustedDevice({
      userIdentityId: "user:pairing:1",
      workspaceId: "workspace:pairing:1",
      displayName: "Pairing Laptop",
      fingerprint: createDeviceFingerprint({
        algorithm: DeviceFingerprintAlgorithms.sha256,
        value: "pairing-fingerprint-1",
      }),
      pairingMethod: DevicePairingMethods.oneTimeCode,
      registeredAt: "2026-04-04T12:00:00.000Z",
    });

    const initiated = await pairingService.initiatePairing({
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      workspaceId: "workspace:pairing:1",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      actorBinding: {
        scope: PairingTokenActorScopes.sameUser,
        userIdentityId: "user:pairing:1",
      },
      expiresAt: "2026-04-04T12:15:00.000Z",
      maxValidationAttempts: 2,
    });
    expect(initiated.pairingSession.status).toBe(PairingSessionStatuses.initiated);
    expect(initiated.pairingToken.status).toBe(PairingTokenStatuses.issued);

    const invalidValidation = await pairingService.validatePairingToken({
      pairingSessionId: initiated.pairingSession.id,
      pairingTokenId: initiated.pairingToken.id,
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      presentedToken: "wrong-token",
      attemptedAt: "2026-04-04T12:01:00.000Z",
    });
    expect(invalidValidation.outcome).toBe(PairingTokenValidationOutcomes.invalid);
    expect(invalidValidation.pairingToken.failedValidationAttempts).toBe(1);

    const validValidation = await pairingService.validatePairingToken({
      pairingSessionId: initiated.pairingSession.id,
      pairingTokenId: initiated.pairingToken.id,
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      presentedToken: initiated.artifact.value,
      attemptedAt: "2026-04-04T12:01:30.000Z",
    });
    expect(validValidation.outcome).toBe(PairingTokenValidationOutcomes.valid);
    expect(validValidation.pairingSession.status).toBe(PairingSessionStatuses.validated);

    const completed = await pairingService.completePairing({
      pairingSessionId: initiated.pairingSession.id,
      pairingTokenId: initiated.pairingToken.id,
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      workspaceId: "workspace:pairing:1",
      presentedToken: initiated.artifact.value,
      completedAt: "2026-04-04T12:02:00.000Z",
      completedByUserIdentityId: "user:pairing:1",
      trustMaterialRegistration: {
        materialKind: DeviceTrustMaterialKinds.sessionSigningKey,
        pinReference: "pin:pairing:1",
      },
    });
    expect(completed.pairingToken.status).toBe(PairingTokenStatuses.consumed);
    expect(completed.pairingSession.status).toBe(PairingSessionStatuses.completed);
    expect(completed.trustedDevice.trustStatus).toBe(DeviceTrustStatuses.trusted);

    const reusedValidation = await pairingService.validatePairingToken({
      pairingSessionId: initiated.pairingSession.id,
      pairingTokenId: initiated.pairingToken.id,
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      presentedToken: initiated.artifact.value,
      attemptedAt: "2026-04-04T12:02:30.000Z",
    });
    expect(reusedValidation.outcome).toBe(PairingTokenValidationOutcomes.reused);

    const toExpire = await pairingService.initiatePairing({
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      workspaceId: "workspace:pairing:1",
      artifactType: PairingTokenArtifactTypes.qrPayload,
      actorBinding: {
        scope: PairingTokenActorScopes.sessionBound,
        sessionId: "session:pairing:1",
      },
      expiresAt: "2026-04-04T12:00:30.000Z",
    });
    const expired = await pairingService.expirePairingAttempts({
      pairingSessionId: toExpire.pairingSession.id,
      pairingTokenId: toExpire.pairingToken.id,
      expiresBefore: "2026-04-04T12:02:00.000Z",
    });
    expect(expired).toEqual({
      expiredSessions: 1,
      expiredTokens: 1,
    });

    const toInvalidate = await pairingService.initiatePairing({
      trustedDeviceId: registered.id,
      userIdentityId: "user:pairing:1",
      artifactType: PairingTokenArtifactTypes.oneTimeCode,
      actorBinding: {
        scope: PairingTokenActorScopes.workspaceAdmin,
        userIdentityId: "admin:pairing:1",
      },
      expiresAt: "2026-04-04T12:15:00.000Z",
    });
    const invalidated = await pairingService.invalidatePairing({
      pairingSessionId: toInvalidate.pairingSession.id,
      pairingTokenId: toInvalidate.pairingToken.id,
      reason: PairingTokenInvalidationReasons.manualCancel,
      invalidatedByUserIdentityId: "admin:pairing:1",
      invalidatedAt: "2026-04-04T12:03:00.000Z",
    });
    expect(invalidated).toEqual({
      ok: true,
      value: {
        changed: true,
      },
    });
  });

  it("provides deterministic id and clock seams for use-case orchestration", () => {
    const adapter = new InMemoryIdentityPortAdapter();
    expect(adapter.nextId(IdentityIdNamespaces.userIdentity)).toBe("user-identity:1");
    expect(adapter.nextId(IdentityIdNamespaces.identitySession)).toBe("identity-session:2");
    expect(adapter.now().toISOString()).toBe("2026-04-04T12:00:00.000Z");
  });
});

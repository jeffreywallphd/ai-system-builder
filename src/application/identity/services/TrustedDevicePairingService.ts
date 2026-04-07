import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  TrustedDevicePairingArtifact,
  TrustedDevicePairingCompletionRequest,
  TrustedDevicePairingCompletionResponse,
  TrustedDevicePairingExpirationRequest,
  TrustedDevicePairingExpirationResult,
  TrustedDevicePairingInitiationRequest,
  TrustedDevicePairingInitiationResponse,
  TrustedDevicePairingInvalidationRequest,
  TrustedDevicePairingValidationRequest,
  TrustedDevicePairingValidationResponse,
} from "../../contracts/IdentityApplicationContracts";
import {
  IdentityErrorCodes,
  IdentityIdNamespaces,
  PairingTokenValidationOutcomes,
} from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";
import type { ITrustedDevicePairingRepository } from "../ports/ITrustedDevicePairingRepository";
import type { ITrustedDevicePairingService } from "../ports/ITrustedDevicePairingService";
import type { ITrustedDeviceRepository } from "../ports/ITrustedDeviceRepository";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "../../contracts/IdentityLifecycleEventContracts";
import {
  PairingSessionStatuses,
  PairingTokenActorScopes,
  PairingTokenInvalidationReasons,
  PairingTokenStatuses,
  completePairingSession,
  consumePairingToken,
  createPairingSession,
  createPairingToken,
  expirePairingSession,
  expirePairingToken,
  invalidatePairingToken,
  markPairingSessionValidated,
  registerPairingTokenFailedAttempt,
  rejectPairingSession,
  type PairingSession,
  type PairingToken,
} from "../../../src/domain/identity/TrustedDevicePairingDomain";
import {
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
  pairTrustedDevice,
  type DeviceTrustMaterialRef,
  type TrustedDevice,
} from "../../../src/domain/identity/TrustedDeviceDomain";
import {
  mapPairingSessionRecord,
  mapPairingTokenRecord,
  mapSessionRecordToDomain,
  mapTokenRecordToDomain,
  mapTrustedDeviceRecord,
} from "./TrustedDeviceServiceMappers";
import { publishIdentityLifecycleEventBestEffort } from "./IdentityLifecycleEventPublishing";

interface TrustedDevicePairingServiceDependencies {
  readonly trustedDeviceRepository: ITrustedDeviceRepository;
  readonly pairingRepository: ITrustedDevicePairingRepository;
  readonly idGenerator: IIdentityIdGenerator;
  readonly clock: IIdentityClock;
  readonly pairingTokenHasher?: (token: string) => string;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
}

export class TrustedDevicePairingService implements ITrustedDevicePairingService {
  private readonly pairingTokenHasher: (token: string) => string;

  public constructor(private readonly dependencies: TrustedDevicePairingServiceDependencies) {
    this.pairingTokenHasher = dependencies.pairingTokenHasher ?? hashPairingToken;
  }

  public async initiatePairing(request: TrustedDevicePairingInitiationRequest): Promise<TrustedDevicePairingInitiationResponse> {
    const trustedDevice = await this.dependencies.trustedDeviceRepository.getTrustedDeviceById(request.trustedDeviceId);
    if (!trustedDevice) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }

    if (trustedDevice.userIdentityId !== request.userIdentityId) {
      throw new Error("Trusted device does not belong to the requested identity.");
    }

    const now = this.dependencies.clock.now().toISOString();
    const pairingSessionId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.trustedDevicePairingSession);
    const pairingTokenId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.trustedDevicePairingToken);
    const artifact = issuePairingArtifact(request.artifactType);
    const token = createPairingToken({
      id: pairingTokenId,
      pairingSessionId,
      trustedDeviceId: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      artifactType: request.artifactType,
      tokenHash: this.pairingTokenHasher(artifact.value),
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

    const persistedSession = await this.dependencies.pairingRepository.createPairingSession(mapPairingSessionRecord(session));
    const persistedToken = await this.dependencies.pairingRepository.createPairingToken(mapPairingTokenRecord(token));
    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDevicePairingInitiated,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: persistedToken.issuedAt,
        payload: {
          pairingSessionId: persistedSession.pairingSessionId,
          pairingTokenId: persistedToken.pairingTokenId,
          trustedDeviceId: persistedToken.trustedDeviceId,
          userIdentityId: persistedToken.userIdentityId,
          workspaceId: persistedToken.workspaceId,
          actorScope: persistedToken.actorBinding.scope,
          artifactType: persistedToken.artifactType,
          issuedAt: persistedToken.issuedAt,
          expiresAt: persistedToken.expiresAt,
          issuedByUserIdentityId: persistedToken.issuance?.issuedByUserIdentityId,
        },
      }),
    );

    return Object.freeze({
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      artifact,
    });
  }

  public async validatePairingToken(request: TrustedDevicePairingValidationRequest): Promise<TrustedDevicePairingValidationResponse> {
    const sessionRecord = await this.dependencies.pairingRepository.getPairingSessionById(request.pairingSessionId);
    if (!sessionRecord) {
      throw new Error(`Pairing session '${request.pairingSessionId}' was not found.`);
    }

    const tokenRecord = request.pairingTokenId
      ? await this.dependencies.pairingRepository.getPairingTokenById(request.pairingTokenId)
      : await this.dependencies.pairingRepository.getPairingTokenBySessionId(request.pairingSessionId);
    if (!tokenRecord) {
      throw new Error("Pairing token was not found.");
    }

    const token = mapTokenRecordToDomain(tokenRecord);
    const session = mapSessionRecordToDomain(sessionRecord);
    this.assertPairingBindings(token, session, request);

    if (token.status === PairingTokenStatuses.expired || this.isExpired(token, this.dependencies.clock.now())) {
      const expiredToken = token.status === PairingTokenStatuses.issued
        ? expirePairingToken(token, this.dependencies.clock.now())
        : token;
      const expiredSession = this.expireActiveSession(session);
      const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(mapPairingTokenRecord(expiredToken));
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(mapPairingSessionRecord(expiredSession));
      await this.publishPairingFailureAudit({
        pairingSessionId: persistedSession.pairingSessionId,
        pairingTokenId: persistedToken.pairingTokenId,
        trustedDeviceId: persistedToken.trustedDeviceId,
        userIdentityId: persistedToken.userIdentityId,
        workspaceId: persistedToken.workspaceId,
        failureReason: "expired",
        occurredAt: request.attemptedAt ?? this.dependencies.clock.now().toISOString(),
        actorUserIdentityId: request.userIdentityId,
      });
      return Object.freeze({
        outcome: PairingTokenValidationOutcomes.expired,
        pairingSession: persistedSession,
        pairingToken: persistedToken,
        attemptsRemaining: 0,
      });
    }

    if (token.status === PairingTokenStatuses.consumed) {
      const rejected = this.rejectReusableSession(session);
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(mapPairingSessionRecord(rejected));
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

    if (!this.isActorScopeAllowed(token, request.userIdentityId)) {
      const rejectedSession = this.rejectActorScopeViolation(session);
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(
        mapPairingSessionRecord(rejectedSession),
      );
      return Object.freeze({
        outcome: PairingTokenValidationOutcomes.actorScopeViolation,
        pairingSession: persistedSession,
        pairingToken: tokenRecord,
        attemptsRemaining: Math.max(token.attempts.maxValidationAttempts - token.attempts.failedValidationAttempts, 0),
      });
    }

    if (!this.isPresentedTokenValid(token, request.presentedToken)) {
      const attemptedToken = registerPairingTokenFailedAttempt(token, {
        attemptedAt: request.attemptedAt ?? this.dependencies.clock.now().toISOString(),
        invalidatedByUserIdentityId: request.userIdentityId,
      });
      let nextSession = session;
      let outcome = PairingTokenValidationOutcomes.invalid;
      if (attemptedToken.status === PairingTokenStatuses.invalidated) {
        nextSession = this.rejectInvalidToken(session, "max attempts reached");
        outcome = PairingTokenValidationOutcomes.attemptsExhausted;
      }

      const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(
        mapPairingTokenRecord(attemptedToken),
      );
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(
        mapPairingSessionRecord(nextSession),
      );
      if (outcome === PairingTokenValidationOutcomes.invalid || outcome === PairingTokenValidationOutcomes.attemptsExhausted) {
        await this.publishPairingFailureAudit({
          pairingSessionId: persistedSession.pairingSessionId,
          pairingTokenId: persistedToken.pairingTokenId,
          trustedDeviceId: persistedToken.trustedDeviceId,
          userIdentityId: persistedToken.userIdentityId,
          workspaceId: persistedToken.workspaceId,
          failureReason: "invalid-token",
          occurredAt: request.attemptedAt ?? this.dependencies.clock.now().toISOString(),
          actorUserIdentityId: request.userIdentityId,
        });
      }
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

    const validatedSession = session.status === PairingSessionStatuses.validated
      ? session
      : markPairingSessionValidated(session, {
          validatedAt: request.attemptedAt ?? this.dependencies.clock.now().toISOString(),
        });

    const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(
      mapPairingSessionRecord(validatedSession),
    );
    const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(mapPairingTokenRecord(token));

    return Object.freeze({
      outcome: PairingTokenValidationOutcomes.valid,
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      attemptsRemaining: Math.max(token.attempts.maxValidationAttempts - token.attempts.failedValidationAttempts, 0),
    });
  }

  public async completePairing(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevicePairingCompletionResponse> {
    const sessionRecord = await this.dependencies.pairingRepository.getPairingSessionById(request.pairingSessionId);
    const tokenRecord = await this.dependencies.pairingRepository.getPairingTokenById(request.pairingTokenId);
    if (!sessionRecord || !tokenRecord) {
      throw new Error("Pairing completion dependencies were not found.");
    }

    const token = mapTokenRecordToDomain(tokenRecord);
    const session = mapSessionRecordToDomain(sessionRecord);
    this.assertPairingBindings(token, session, request);

    const trustedDevice = await this.resolveTrustedDevice(request);

    if (session.status === PairingSessionStatuses.completed) {
      return this.resolveCompletedPairingIdempotently(request, sessionRecord, tokenRecord, trustedDevice);
    }

    if (token.status === PairingTokenStatuses.expired || this.isExpired(token, request.completedAt ? new Date(request.completedAt) : this.dependencies.clock.now())) {
      const expiredToken = token.status === PairingTokenStatuses.issued
        ? expirePairingToken(token, request.completedAt ? new Date(request.completedAt) : this.dependencies.clock.now())
        : token;
      const expiredSession = this.expireActiveSession(session);
      const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(mapPairingTokenRecord(expiredToken));
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(mapPairingSessionRecord(expiredSession));
      await this.publishPairingFailureAudit({
        pairingSessionId: persistedSession.pairingSessionId,
        pairingTokenId: persistedToken.pairingTokenId,
        trustedDeviceId: persistedToken.trustedDeviceId,
        userIdentityId: persistedToken.userIdentityId,
        workspaceId: persistedToken.workspaceId,
        failureReason: "expired",
        occurredAt: request.completedAt ?? this.dependencies.clock.now().toISOString(),
        actorUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
      });
      throw new Error("Pairing token is expired.");
    }

    if (token.status === PairingTokenStatuses.invalidated) {
      throw new Error("Pairing token is invalidated.");
    }

    if (token.status === PairingTokenStatuses.consumed) {
      throw new Error("Pairing token has already been consumed.");
    }

    if (!this.isActorScopeAllowed(token, request.userIdentityId)) {
      throw new Error("Pairing actor scope does not allow completion by this user.");
    }

    if (!this.isPresentedTokenValid(token, request.presentedToken)) {
      const invalidatedToken = this.invalidateOnInvalidCompletionToken(token, request.userIdentityId);
      const rejectedSession = this.rejectInvalidToken(session);
      const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(mapPairingTokenRecord(invalidatedToken));
      const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(mapPairingSessionRecord(rejectedSession));
      await this.publishPairingFailureAudit({
        pairingSessionId: persistedSession.pairingSessionId,
        pairingTokenId: persistedToken.pairingTokenId,
        trustedDeviceId: persistedToken.trustedDeviceId,
        userIdentityId: persistedToken.userIdentityId,
        workspaceId: persistedToken.workspaceId,
        failureReason: "invalid-token",
        occurredAt: request.completedAt ?? this.dependencies.clock.now().toISOString(),
        actorUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
      });
      throw new Error("Pairing token presented for completion is invalid.");
    }

    const completionTime = request.completedAt ?? this.dependencies.clock.now().toISOString();
    const consumedToken = consumePairingToken(token, {
      consumedAt: completionTime,
      consumedByUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
    });

    const validatedSession = session.status === PairingSessionStatuses.validated
      ? session
      : markPairingSessionValidated(session, {
          validatedAt: completionTime,
        });

    const completedSession = completePairingSession(validatedSession, consumedToken, {
      completedAt: completionTime,
      completedByUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
      trustMaterialRegistration: request.trustMaterialRegistration,
    });

    const pairedDevice = pairTrustedDevice(trustedDevice, {
      trustMaterialRef: request.trustMaterialRef ?? createDeviceTrustMaterialRef({
        materialId: `trust-material:${trustedDevice.id}`,
        kind: DeviceTrustMaterialKinds.sessionSigningKey,
        issuedAt: completionTime,
      }),
      pairedAt: completionTime,
      now: new Date(completionTime),
    });

    const persistedToken = await this.dependencies.pairingRepository.updatePairingToken(mapPairingTokenRecord(consumedToken));
    const persistedSession = await this.dependencies.pairingRepository.updatePairingSession(
      mapPairingSessionRecord(completedSession),
    );
    const persistedDevice = await this.dependencies.trustedDeviceRepository.updateTrustedDevice(pairedDevice);
    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDevicePairingCompleted,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: persistedSession.completedAt ?? completionTime,
        payload: {
          pairingSessionId: persistedSession.pairingSessionId,
          pairingTokenId: persistedToken.pairingTokenId,
          trustedDeviceId: persistedDevice.id,
          userIdentityId: persistedDevice.userIdentityId,
          workspaceId: persistedDevice.workspaceId,
          completedAt: persistedSession.completedAt ?? completionTime,
          completedByUserIdentityId: persistedSession.completedByUserIdentityId,
          trustMaterialKind: persistedDevice.trustMaterialRef?.kind,
        },
      }),
    );
    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDeviceTrustStatusChanged,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: persistedDevice.updatedAt,
        payload: {
          trustedDeviceId: persistedDevice.id,
          userIdentityId: persistedDevice.userIdentityId,
          workspaceId: persistedDevice.workspaceId,
          previousStatus: trustedDevice.trustStatus,
          nextStatus: persistedDevice.trustStatus,
          changedAt: persistedDevice.updatedAt,
          changedByUserIdentityId: request.completedByUserIdentityId ?? request.userIdentityId,
          reason: "pairing-completed",
        },
      }),
    );

    return Object.freeze({
      pairingSession: persistedSession,
      pairingToken: persistedToken,
      trustedDevice: mapTrustedDeviceRecord(persistedDevice),
    });
  }

  public async expirePairingAttempts(request: TrustedDevicePairingExpirationRequest): Promise<TrustedDevicePairingExpirationResult> {
    let expiredTokens = 0;
    let expiredSessions = 0;
    const expiresBefore = new Date(request.expiresBefore);

    if (request.pairingTokenId) {
      const tokenRecord = await this.dependencies.pairingRepository.getPairingTokenById(request.pairingTokenId);
      if (tokenRecord) {
        const token = mapTokenRecordToDomain(tokenRecord);
        if (token.status === PairingTokenStatuses.issued && this.isExpired(token, expiresBefore)) {
          await this.dependencies.pairingRepository.updatePairingToken(
            mapPairingTokenRecord(expirePairingToken(token, expiresBefore)),
          );
          expiredTokens += 1;
        }
      }
    }

    if (request.pairingSessionId) {
      const sessionRecord = await this.dependencies.pairingRepository.getPairingSessionById(request.pairingSessionId);
      if (sessionRecord) {
        const session = mapSessionRecordToDomain(sessionRecord);
        if (
          (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated)
          && new Date(session.initiatedAt).getTime() <= expiresBefore.getTime()
        ) {
          await this.dependencies.pairingRepository.updatePairingSession(
            mapPairingSessionRecord(expirePairingSession(session, expiresBefore)),
          );
          expiredSessions += 1;
        }
      }
    }

    return Object.freeze({
      expiredSessions,
      expiredTokens,
    });
  }

  public async invalidatePairing(
    request: TrustedDevicePairingInvalidationRequest,
  ): Promise<
    IdentityOperationResult<
      IdentityMutationOutcome,
      | typeof IdentityErrorCodes.invalidRequest
      | typeof IdentityErrorCodes.invalidState
      | typeof IdentityErrorCodes.notFound
    >
  > {
    return this.dependencies.pairingRepository.invalidatePairingArtifacts(request);
  }

  private async resolveTrustedDevice(request: TrustedDevicePairingCompletionRequest): Promise<TrustedDevice> {
    const existing = await this.dependencies.trustedDeviceRepository.getTrustedDeviceById(request.trustedDeviceId);
    if (existing) {
      if (existing.userIdentityId !== request.userIdentityId) {
        throw new Error("Trusted device identity linkage is invalid.");
      }
      if (request.workspaceId && existing.workspaceId !== request.workspaceId) {
        throw new Error("Trusted device workspace linkage is invalid.");
      }
      return existing;
    }

    if (!request.trustedDeviceRegistration) {
      throw new Error(`Trusted device '${request.trustedDeviceId}' was not found.`);
    }

    const created = await this.dependencies.trustedDeviceRepository.createTrustedDevice(createTrustedDevice({
      id: request.trustedDeviceId,
      userIdentityId: request.userIdentityId,
      workspaceId: request.workspaceId,
      displayName: request.trustedDeviceRegistration.displayName,
      fingerprint: request.trustedDeviceRegistration.fingerprint,
      pairingMethod: request.trustedDeviceRegistration.pairingMethod,
      trustStatus: DeviceTrustStatuses.pendingPairing,
      metadata: request.trustedDeviceRegistration.metadata,
      registeredAt: request.trustedDeviceRegistration.registeredAt ?? request.completedAt ?? this.dependencies.clock.now(),
      updatedAt: request.completedAt ?? this.dependencies.clock.now(),
    }));

    return created;
  }

  private async resolveCompletedPairingIdempotently(
    request: TrustedDevicePairingCompletionRequest,
    sessionRecord: TrustedDevicePairingCompletionResponse["pairingSession"],
    tokenRecord: TrustedDevicePairingCompletionResponse["pairingToken"],
    trustedDevice: TrustedDevice,
  ): Promise<TrustedDevicePairingCompletionResponse> {
    if (tokenRecord.status !== PairingTokenStatuses.consumed) {
      throw new Error("Pairing completion is inconsistent with consumed pairing state.");
    }

    if (!this.isPresentedTokenValid(mapTokenRecordToDomain(tokenRecord), request.presentedToken)) {
      throw new Error("Pairing token presented for completion is invalid.");
    }

    if (trustedDevice.trustStatus !== DeviceTrustStatuses.trusted || !trustedDevice.trustMaterialRef) {
      throw new Error("Trusted device is not in a completed trusted state.");
    }

    if (request.trustMaterialRef && !isSameTrustMaterialRef(request.trustMaterialRef, trustedDevice.trustMaterialRef)) {
      throw new Error("Pairing completion request conflicts with persisted trust material.");
    }

    return Object.freeze({
      pairingSession: sessionRecord,
      pairingToken: tokenRecord,
      trustedDevice: mapTrustedDeviceRecord(trustedDevice),
    });
  }

  private assertPairingBindings(
    token: PairingToken,
    session: PairingSession,
    request: {
      readonly pairingSessionId: string;
      readonly pairingTokenId?: string;
      readonly trustedDeviceId: string;
      readonly userIdentityId: string;
      readonly workspaceId?: string;
    },
  ): void {
    if (token.id !== (request.pairingTokenId ?? token.id)) {
      throw new Error("Pairing token does not match the requested pairing token id.");
    }

    if (token.pairingSessionId !== request.pairingSessionId || session.id !== request.pairingSessionId) {
      throw new Error("Pairing session/token linkage is invalid.");
    }

    if (token.trustedDeviceId !== request.trustedDeviceId || session.trustedDeviceId !== request.trustedDeviceId) {
      throw new Error("Pairing trusted device linkage is invalid.");
    }

    if (token.userIdentityId !== request.userIdentityId || session.userIdentityId !== request.userIdentityId) {
      throw new Error("Pairing user identity linkage is invalid.");
    }

    if (request.workspaceId && (token.workspaceId !== request.workspaceId || session.workspaceId !== request.workspaceId)) {
      throw new Error("Pairing workspace linkage is invalid.");
    }
  }

  private isPresentedTokenValid(token: PairingToken, presentedToken: string): boolean {
    const presentedHash = this.pairingTokenHasher(presentedToken);
    return secureHashEquals(token.tokenHash, presentedHash);
  }

  private isActorScopeAllowed(token: PairingToken, actingUserIdentityId: string): boolean {
    if (token.actorBinding.scope === PairingTokenActorScopes.sameUser && token.actorBinding.userIdentityId) {
      return token.actorBinding.userIdentityId === actingUserIdentityId;
    }
    return true;
  }

  private isExpired(token: PairingToken, now: Date): boolean {
    return new Date(token.expiresAt).getTime() <= now.getTime();
  }

  private expireActiveSession(session: PairingSession): PairingSession {
    if (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated) {
      return expirePairingSession(session, this.dependencies.clock.now());
    }
    return session;
  }

  private rejectReusableSession(session: PairingSession): PairingSession {
    if (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated) {
      return rejectPairingSession(session, {
        reason: "token-reused",
        rejectedAt: this.dependencies.clock.now().toISOString(),
      });
    }
    return session;
  }

  private rejectActorScopeViolation(session: PairingSession): PairingSession {
    if (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated) {
      return rejectPairingSession(session, {
        reason: "actor-scope-violation",
        rejectedAt: this.dependencies.clock.now().toISOString(),
      });
    }
    return session;
  }

  private rejectInvalidToken(session: PairingSession, note?: string): PairingSession {
    if (session.status === PairingSessionStatuses.initiated || session.status === PairingSessionStatuses.validated) {
      return rejectPairingSession(session, {
        reason: "invalid-token",
        rejectedAt: this.dependencies.clock.now().toISOString(),
        note,
      });
    }
    return session;
  }

  private invalidateOnInvalidCompletionToken(token: PairingToken, userIdentityId: string): PairingToken {
    return invalidatePairingToken(token, {
      reason: PairingTokenInvalidationReasons.invalidTokenPresented,
      invalidatedAt: this.dependencies.clock.now().toISOString(),
      invalidatedByUserIdentityId: userIdentityId,
      note: "pairing token mismatch",
    });
  }

  private async publishPairingFailureAudit(input: {
    readonly pairingSessionId: string;
    readonly pairingTokenId: string;
    readonly trustedDeviceId: string;
    readonly userIdentityId: string;
    readonly workspaceId?: string;
    readonly failureReason: "expired" | "invalid-token";
    readonly occurredAt: string;
    readonly actorUserIdentityId?: string;
  }): Promise<void> {
    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.trustedDevicePairingFailed,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: input.occurredAt,
        payload: {
          pairingSessionId: input.pairingSessionId,
          pairingTokenId: input.pairingTokenId,
          trustedDeviceId: input.trustedDeviceId,
          userIdentityId: input.userIdentityId,
          workspaceId: input.workspaceId,
          failureReason: input.failureReason,
          occurredAt: input.occurredAt,
          actorUserIdentityId: input.actorUserIdentityId,
        },
      }),
    );
  }
}

function issuePairingArtifact(type: TrustedDevicePairingArtifact["type"]): TrustedDevicePairingArtifact {
  const raw = randomBytes(24).toString("base64url");
  const hint = raw.length > 4 ? `****${raw.slice(-4)}` : "****";
  return Object.freeze({
    type,
    value: raw,
    redactedHint: hint,
  });
}

function hashPairingToken(token: string): string {
  const normalized = token.trim();
  if (!normalized) {
    return "";
  }

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function secureHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isSameTrustMaterialRef(left: DeviceTrustMaterialRef, right: DeviceTrustMaterialRef): boolean {
  return left.materialId === right.materialId
    && left.kind === right.kind
    && left.version === right.version
    && left.issuedAt === right.issuedAt
    && left.expiresAt === right.expiresAt;
}

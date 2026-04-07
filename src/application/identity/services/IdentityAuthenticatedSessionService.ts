import {
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  SessionRevocationReasons,
  expireSession,
  revokeSession,
  SessionAssuranceLevels,
  SessionDeviceTrustStates,
  type IdentitySessionAccessChannel,
  type SessionDeviceTrustContext,
  type SessionDeviceTrustInvalidationReason,
  type Session,
  type SessionRevocationReason,
} from "@domain/identity/IdentityDomain";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "../../contracts/IdentityLifecycleEventContracts";
import {
  IdentityErrorBoundaries,
  type IdentityErrorCode,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../ports/IIdentitySessionTokenMaterialRepository";
import type { IIdentitySessionTokenService } from "../ports/IIdentitySessionTokenService";
import type { IIdentitySessionTrustEvaluator } from "../ports/IIdentitySessionTrustEvaluator";
import { publishIdentityLifecycleEventBestEffort } from "./IdentityLifecycleEventPublishing";
import { IdentitySessionLifecycleService } from "./IdentitySessionLifecycleService";

export interface IssueAuthenticatedSessionInput {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly accessChannel: IdentitySessionAccessChannel;
  readonly client?: {
    readonly userAgent?: string;
    readonly ipAddress?: string;
    readonly deviceId?: string;
    readonly deviceTrust?: SessionDeviceTrustContext;
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
  };
}

export interface IssueAuthenticatedSessionResult {
  readonly session: Session;
  readonly token: string;
  readonly tokenType: "Bearer";
}

export interface ResolveAuthenticatedSessionByTokenInput {
  readonly token: string;
}

export interface ResolveAuthenticatedSessionByTokenResult {
  readonly session: Session;
  readonly deviceTrustContext?: SessionDeviceTrustContext;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export interface InvalidateAuthenticatedSessionInput {
  readonly token: string;
  readonly reason: SessionRevocationReason;
}

export interface InvalidateAuthenticatedSessionResult {
  readonly session: Session;
}

export interface RevokeAuthenticatedSessionByIdInput {
  readonly sessionId: string;
  readonly reason: SessionRevocationReason;
}

export interface RevokeAuthenticatedSessionByIdResult {
  readonly session: Session;
}

interface IdentityAuthenticatedSessionServiceDependencies {
  readonly lifecycleService: IdentitySessionLifecycleService;
  readonly sessionRepository: IIdentitySessionRepository;
  readonly tokenMaterialRepository: IIdentitySessionTokenMaterialRepository;
  readonly tokenService: IIdentitySessionTokenService;
  readonly clock: IIdentityClock;
  readonly sessionTrustEvaluator?: IIdentitySessionTrustEvaluator;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
}

export class IdentityAuthenticatedSessionService {
  public constructor(private readonly dependencies: IdentityAuthenticatedSessionServiceDependencies) {}

  public async issueAuthenticatedSession(
    input: IssueAuthenticatedSessionInput,
  ): Promise<IdentityOperationResult<
    IssueAuthenticatedSessionResult,
    typeof IdentityErrorCodes.invalidRequest
  >> {
    const issued = await this.dependencies.lifecycleService.issueSession({
      userIdentityId: input.userIdentityId,
      providerId: input.providerId,
      providerSubject: input.providerSubject,
      accessChannel: input.accessChannel,
      client: input.client,
    });
    if (!issued.ok) {
      return issued;
    }

    const tokenMaterial = this.dependencies.tokenService.issueToken();
    await this.dependencies.tokenMaterialRepository.saveSessionTokenMaterial(Object.freeze({
      sessionId: issued.value.session.id,
      tokenHash: tokenMaterial.tokenHash,
      hashAlgorithm: tokenMaterial.hashAlgorithm,
      tokenType: tokenMaterial.tokenType,
      createdAt: issued.value.session.issuedAt,
      updatedAt: issued.value.session.issuedAt,
      expiresAt: issued.value.session.expiresAt,
    }));

    const result = identitySuccess(Object.freeze({
      session: issued.value.session,
      token: tokenMaterial.token,
      tokenType: "Bearer",
    }));

    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.sessionCreated,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: result.value.session.issuedAt,
        payload: {
          sessionId: result.value.session.id,
          userIdentityId: result.value.session.userIdentityId,
          providerId: result.value.session.providerId,
          providerSubject: result.value.session.providerSubject,
          accessChannel: result.value.session.client?.accessChannel,
          issuedAt: result.value.session.issuedAt,
          expiresAt: result.value.session.expiresAt,
        },
      }),
    );

    return result;
  }

  public async resolveAuthenticatedSessionByToken(
    input: ResolveAuthenticatedSessionByTokenInput,
  ): Promise<IdentityOperationResult<
    ResolveAuthenticatedSessionByTokenResult,
    typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidSessionState | typeof IdentityErrorCodes.notFound
  >> {
    const token = normalizeToken(input.token);
    if (!token) {
      return this.failure(IdentityErrorCodes.invalidRequest, "Session token is required.");
    }

    const tokenHash = this.dependencies.tokenService.hashToken(token);
    const tokenMaterial = await this.dependencies.tokenMaterialRepository.getSessionTokenMaterialByTokenHash(tokenHash);
    if (!tokenMaterial) {
      return this.failure(IdentityErrorCodes.notFound, "Session token was not found.");
    }

    if (tokenMaterial.invalidatedAt) {
      return this.failure(IdentityErrorCodes.invalidSessionState, "Session token is invalidated.");
    }

    const session = await this.dependencies.sessionRepository.getSessionById(tokenMaterial.sessionId);
    if (!session) {
      return this.failure(IdentityErrorCodes.notFound, `Session '${tokenMaterial.sessionId}' was not found.`);
    }

    const now = this.dependencies.clock.now();
    const expiryTime = new Date(session.expiresAt).getTime();
    if (now.getTime() >= expiryTime) {
      if (session.status === IdentitySessionStatuses.active) {
        const expired = expireSession(session, now);
        await this.dependencies.sessionRepository.saveSession(expired);
      }
      await this.dependencies.tokenMaterialRepository.invalidateSessionTokenMaterial(
        session.id,
        now.toISOString(),
      );

      return this.failure(IdentityErrorCodes.invalidSessionState, "Session is expired.");
    }

    if (session.status !== IdentitySessionStatuses.active) {
      return this.failure(IdentityErrorCodes.invalidSessionState, "Session is not active.");
    }

    const trustEvaluation = this.dependencies.sessionTrustEvaluator
      ? await this.dependencies.sessionTrustEvaluator.evaluateSessionTrust({
          session,
          evaluatedAt: now.toISOString(),
        })
      : undefined;
    if (trustEvaluation && !trustEvaluation.allowed) {
      const nowIso = now.toISOString();
      const deniedTrustContext = mergeDeviceTrustContext(
        session.client?.deviceTrust,
        trustEvaluation.deviceTrustContext,
        Object.freeze({
          trustedDeviceBindingId: trustEvaluation.trustedDeviceBindingId,
          trustMarker: trustEvaluation.trustMarker,
        }),
      );
      const invalidatedSession = revokeSession(
        Object.freeze({
          ...session,
          client: mergeSessionTrustContext(session, deniedTrustContext, trustEvaluation),
        }),
        SessionRevocationReasons.security,
        now,
      );
      await this.dependencies.sessionRepository.saveSession(invalidatedSession);
      await this.dependencies.tokenMaterialRepository.invalidateSessionTokenMaterial(
        session.id,
        nowIso,
      );
      await publishIdentityLifecycleEventBestEffort(
        this.dependencies.eventPublisher,
        createIdentityLifecycleEvent({
          eventType: IdentityLifecycleEventTypes.sessionTrustInvalidated,
          contractVersion: IdentityLifecycleEventContractVersions.v1,
          occurredAt: nowIso,
          payload: {
            sessionId: session.id,
            userIdentityId: session.userIdentityId,
            trustedDeviceId: deniedTrustContext?.trustedDeviceId ?? session.client?.trustedDeviceBindingId,
            revocationReason: SessionRevocationReasons.security,
            invalidationReasons: trustEvaluation.invalidationReasons,
            invalidatedAt: nowIso,
            reason: trustEvaluation.reason,
          },
        }),
      );

      const failureDetails = Object.freeze({
        ...(trustEvaluation.details ?? {}),
        ...(trustEvaluation.invalidationReasons && trustEvaluation.invalidationReasons.length > 0
          ? { sessionTrustInvalidationReasons: trustEvaluation.invalidationReasons }
          : {}),
        sessionTrustFailureReason: trustEvaluation.reason,
        sessionTrustFailure: true,
        sessionInvalidated: true,
        sessionInvalidatedAt: nowIso,
        sessionId: session.id,
      });
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        "Session trust requirements were not satisfied.",
        failureDetails,
      );
    }

    const policyAccessChannel = session.client?.accessChannel ?? IdentitySessionAccessChannels.thinClient;
    const rolledExpiry = this.dependencies.lifecycleService.calculateSessionRollingExpiry(
      new Date(session.issuedAt),
      policyAccessChannel,
      now,
    );

    let resolvedSession = session;
    if (rolledExpiry && rolledExpiry.getTime() > new Date(session.expiresAt).getTime()) {
      resolvedSession = await this.dependencies.sessionRepository.saveSession(Object.freeze({
        ...session,
        expiresAt: rolledExpiry.toISOString(),
      }));
    }

    await this.dependencies.tokenMaterialRepository.saveSessionTokenMaterial(Object.freeze({
      ...tokenMaterial,
      updatedAt: now.toISOString(),
      expiresAt: resolvedSession.expiresAt,
    }));

    return identitySuccess(Object.freeze({
      session: resolvedSession,
      deviceTrustContext: mergeDeviceTrustContext(
        resolvedSession.client?.deviceTrust,
        trustEvaluation?.allowed ? trustEvaluation.deviceTrustContext : undefined,
        trustEvaluation?.allowed
          ? Object.freeze({
              trustedDeviceBindingId: trustEvaluation.trustedDeviceBindingId,
              trustMarker: trustEvaluation.trustMarker,
            })
          : undefined,
      ),
      trustedDeviceBindingId: trustEvaluation?.allowed
        ? trustEvaluation.trustedDeviceBindingId
          ?? trustEvaluation.deviceTrustContext?.trustedDeviceBindingId
          ?? trustEvaluation.deviceTrustContext?.trustedDeviceId
          ?? resolvedSession.client?.trustedDeviceBindingId
        : resolvedSession.client?.trustedDeviceBindingId,
      trustMarker: trustEvaluation?.allowed
        ? trustEvaluation.trustMarker
          ?? trustEvaluation.deviceTrustContext?.trustMarker
          ?? resolvedSession.client?.trustMarker
        : resolvedSession.client?.trustMarker,
    }));
  }

  public async invalidateAuthenticatedSession(
    input: InvalidateAuthenticatedSessionInput,
  ): Promise<IdentityOperationResult<
    InvalidateAuthenticatedSessionResult,
    typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidSessionState | typeof IdentityErrorCodes.notFound
  >> {
    const resolved = await this.resolveAuthenticatedSessionByToken({ token: input.token });
    if (!resolved.ok) {
      return resolved;
    }

    const revoked = await this.dependencies.lifecycleService.revokeSession({
      sessionId: resolved.value.session.id,
      reason: input.reason,
    });
    if (!revoked.ok) {
      return revoked;
    }

    await this.dependencies.tokenMaterialRepository.invalidateSessionTokenMaterial(
      revoked.value.session.id,
      this.dependencies.clock.now().toISOString(),
    );

    return identitySuccess(Object.freeze({
      session: revoked.value.session,
    }));
  }

  public async revokeAuthenticatedSessionById(
    input: RevokeAuthenticatedSessionByIdInput,
  ): Promise<IdentityOperationResult<
    RevokeAuthenticatedSessionByIdResult,
    typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidSessionState | typeof IdentityErrorCodes.notFound
  >> {
    const sessionId = normalizeRequired(input.sessionId);
    if (!sessionId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "Session id is required.");
    }

    const existingSession = await this.dependencies.sessionRepository.getSessionById(sessionId);
    if (!existingSession) {
      return this.failure(IdentityErrorCodes.notFound, `Session '${sessionId}' was not found.`);
    }

    const revoked = await this.dependencies.lifecycleService.revokeSession({
      sessionId,
      reason: input.reason,
    });
    if (!revoked.ok) {
      return revoked;
    }

    await this.dependencies.tokenMaterialRepository.invalidateSessionTokenMaterial(
      revoked.value.session.id,
      this.dependencies.clock.now().toISOString(),
    );

    return identitySuccess(Object.freeze({
      session: revoked.value.session,
    }));
  }

  private failure<TValue, TCode extends IdentityErrorCode>(
    code: TCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): IdentityOperationResult<TValue, TCode> {
    const error: IdentityOperationError<TCode> = Object.freeze({
      code,
      message,
      boundary: IdentityErrorBoundaries.application,
      retryable: false,
      details,
    });

    return identityFailure(error);
  }
}

function normalizeToken(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function mergeDeviceTrustContext(
  persisted?: SessionDeviceTrustContext,
  evaluated?: SessionDeviceTrustContext,
  legacyEvaluation?: {
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
  },
): SessionDeviceTrustContext | undefined {
  if (!persisted && !evaluated) {
    return undefined;
  }

  const fallbackAssurance = (
    evaluated?.issuedOnTrustedDevice
    ?? persisted?.issuedOnTrustedDevice
    ?? Boolean(evaluated?.trustedDeviceId || persisted?.trustedDeviceId || legacyEvaluation?.trustedDeviceBindingId)
  )
    ? SessionAssuranceLevels.authenticatedTrusted
    : SessionAssuranceLevels.authenticatedUntrusted;

  const invalidationReasons = evaluated?.invalidationReasons
    ?? persisted?.invalidationReasons
    ?? Object.freeze([] as SessionDeviceTrustInvalidationReason[]);

  return Object.freeze({
    trustedDeviceId: evaluated?.trustedDeviceId
      ?? persisted?.trustedDeviceId
      ?? evaluated?.trustedDeviceBindingId
      ?? persisted?.trustedDeviceBindingId
      ?? legacyEvaluation?.trustedDeviceBindingId,
    issuedOnTrustedDevice: evaluated?.issuedOnTrustedDevice
      ?? persisted?.issuedOnTrustedDevice
      ?? Boolean(evaluated?.trustedDeviceId || persisted?.trustedDeviceId || legacyEvaluation?.trustedDeviceBindingId),
    sessionAssuranceLevel: evaluated?.sessionAssuranceLevel ?? persisted?.sessionAssuranceLevel ?? fallbackAssurance,
    snapshot: Object.freeze({
      state: evaluated?.snapshot?.state
        ?? persisted?.snapshot?.state
        ?? SessionDeviceTrustStates.unknown,
      evaluatedAt: evaluated?.snapshot?.evaluatedAt
        ?? persisted?.snapshot?.evaluatedAt
        ?? "1970-01-01T00:00:00.000Z",
    }),
    invalidationReasons,
    trustedDeviceBindingId: evaluated?.trustedDeviceBindingId
      ?? persisted?.trustedDeviceBindingId
      ?? legacyEvaluation?.trustedDeviceBindingId
      ?? evaluated?.trustedDeviceId
      ?? persisted?.trustedDeviceId,
    trustMarker: evaluated?.trustMarker ?? persisted?.trustMarker ?? legacyEvaluation?.trustMarker,
  });
}

function mergeSessionTrustContext(
  session: Session,
  deviceTrustContext: SessionDeviceTrustContext | undefined,
  evaluation: {
    readonly trustedDeviceBindingId?: string;
    readonly trustMarker?: string;
  },
): Session["client"] {
  if (!session.client && !deviceTrustContext && !evaluation.trustedDeviceBindingId && !evaluation.trustMarker) {
    return undefined;
  }

  return Object.freeze({
    accessChannel: session.client?.accessChannel,
    userAgent: session.client?.userAgent,
    ipAddress: session.client?.ipAddress,
    deviceId: session.client?.deviceId,
    deviceTrust: deviceTrustContext,
    trustedDeviceBindingId: evaluation.trustedDeviceBindingId
      ?? deviceTrustContext?.trustedDeviceBindingId
      ?? deviceTrustContext?.trustedDeviceId
      ?? session.client?.trustedDeviceBindingId,
    trustMarker: evaluation.trustMarker
      ?? deviceTrustContext?.trustMarker
      ?? session.client?.trustMarker,
  });
}


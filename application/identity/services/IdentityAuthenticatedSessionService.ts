import {
  IdentitySessionAccessChannels,
  IdentitySessionStatuses,
  expireSession,
  type IdentitySessionAccessChannel,
  type Session,
  type SessionRevocationReason,
} from "../../../src/domain/identity/IdentityDomain";
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
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        "Session trust requirements were not satisfied.",
        trustEvaluation.details,
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
      trustedDeviceBindingId: trustEvaluation?.allowed
        ? trustEvaluation.trustedDeviceBindingId ?? resolvedSession.client?.trustedDeviceBindingId
        : resolvedSession.client?.trustedDeviceBindingId,
      trustMarker: trustEvaluation?.allowed
        ? trustEvaluation.trustMarker ?? resolvedSession.client?.trustMarker
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

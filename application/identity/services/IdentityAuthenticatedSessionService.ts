import {
  IdentitySessionStatuses,
  expireSession,
  type IdentitySessionAccessChannel,
  type Session,
  type SessionRevocationReason,
} from "../../../src/domain/identity/IdentityDomain";
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
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../ports/IIdentitySessionTokenMaterialRepository";
import type { IIdentitySessionTokenService } from "../ports/IIdentitySessionTokenService";
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
}

export interface InvalidateAuthenticatedSessionInput {
  readonly token: string;
  readonly reason: SessionRevocationReason;
}

export interface InvalidateAuthenticatedSessionResult {
  readonly session: Session;
}

interface IdentityAuthenticatedSessionServiceDependencies {
  readonly lifecycleService: IdentitySessionLifecycleService;
  readonly sessionRepository: IIdentitySessionRepository;
  readonly tokenMaterialRepository: IIdentitySessionTokenMaterialRepository;
  readonly tokenService: IIdentitySessionTokenService;
  readonly clock: IIdentityClock;
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

    return identitySuccess(Object.freeze({
      session: issued.value.session,
      token: tokenMaterial.token,
      tokenType: "Bearer",
    }));
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

    return identitySuccess(Object.freeze({ session }));
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

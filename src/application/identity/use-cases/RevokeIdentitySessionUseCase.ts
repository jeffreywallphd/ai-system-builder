import { SessionRevocationReasons, type SessionRevocationReason } from "@domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  type IdentityErrorCode,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "@application/contracts/IdentityApplicationContracts";
import type { IIdentitySessionRepository } from "@application/identity/ports/IIdentitySessionRepository";
import { type IdentityAuthenticatedSessionService } from "../services/IdentityAuthenticatedSessionService";

export type RevokeIdentitySessionErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidSessionState
  | typeof IdentityErrorCodes.notFound;

export interface RevokeIdentitySessionInput {
  readonly sessionId: string;
  readonly reason?: SessionRevocationReason;
  readonly actorUserIdentityId?: string;
}

export interface RevokeIdentitySessionResult {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly revokedAt: string;
  readonly revocationReason: SessionRevocationReason;
}

interface RevokeIdentitySessionDependencies {
  readonly sessionRepository: IIdentitySessionRepository;
  readonly authenticatedSessionService: Pick<IdentityAuthenticatedSessionService, "revokeAuthenticatedSessionById">;
}

export class RevokeIdentitySessionUseCase {
  public constructor(private readonly dependencies: RevokeIdentitySessionDependencies) {}

  public async execute(
    input: RevokeIdentitySessionInput,
  ): Promise<IdentityOperationResult<RevokeIdentitySessionResult, RevokeIdentitySessionErrorCode>> {
    const sessionId = normalizeRequired(input.sessionId);
    if (!sessionId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "sessionId is required.");
    }

    const actorUserIdentityId = normalizeOptional(input.actorUserIdentityId);
    const existingSession = await this.dependencies.sessionRepository.getSessionById(sessionId);
    if (!existingSession) {
      return this.failure(IdentityErrorCodes.notFound, `Session '${sessionId}' was not found.`);
    }

    if (actorUserIdentityId && existingSession.userIdentityId !== actorUserIdentityId) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        "The requested session cannot be revoked by this actor.",
      );
    }

    const revokeResult = await this.dependencies.authenticatedSessionService.revokeAuthenticatedSessionById({
      sessionId,
      reason: input.reason ?? SessionRevocationReasons.security,
    });
    if (!revokeResult.ok) {
      return revokeResult;
    }

    const revokedAt = revokeResult.value.session.revocation?.revokedAt;
    const revocationReason = revokeResult.value.session.revocation?.reason;
    if (!revokedAt || !revocationReason) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${revokeResult.value.session.id}' did not record revocation metadata.`,
      );
    }

    return identitySuccess(Object.freeze({
      sessionId: revokeResult.value.session.id,
      userIdentityId: revokeResult.value.session.userIdentityId,
      revokedAt,
      revocationReason,
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

function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}


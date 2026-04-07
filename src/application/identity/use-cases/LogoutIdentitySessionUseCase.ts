import { SessionRevocationReasons } from "../../../domain/identity/IdentityDomain";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "../../../../application/contracts/IdentityLifecycleEventContracts";
import {
  IdentityErrorBoundaries,
  type IdentityErrorCode,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityLifecycleEventPublisher } from "../../../../application/identity/ports/IIdentityLifecycleEventPublisher";
import { publishIdentityLifecycleEventBestEffort } from "../services/IdentityLifecycleEventPublishing";
import { type IdentityAuthenticatedSessionService } from "../services/IdentityAuthenticatedSessionService";

export type LogoutIdentitySessionErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidSessionState
  | typeof IdentityErrorCodes.notFound;

export interface LogoutIdentitySessionInput {
  readonly sessionToken: string;
}

export interface LogoutIdentitySessionResult {
  readonly sessionId: string;
  readonly userIdentityId: string;
  readonly revokedAt: string;
  readonly revocationReason: "logout";
}

interface LogoutIdentitySessionDependencies {
  readonly authenticatedSessionService: Pick<IdentityAuthenticatedSessionService, "invalidateAuthenticatedSession">;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
}

export class LogoutIdentitySessionUseCase {
  public constructor(private readonly dependencies: LogoutIdentitySessionDependencies) {}

  public async execute(
    input: LogoutIdentitySessionInput,
  ): Promise<IdentityOperationResult<LogoutIdentitySessionResult, LogoutIdentitySessionErrorCode>> {
    const token = normalizeRequired(input.sessionToken);
    if (!token) {
      return this.failure(IdentityErrorCodes.invalidRequest, "sessionToken is required.");
    }

    const invalidated = await this.dependencies.authenticatedSessionService.invalidateAuthenticatedSession({
      token,
      reason: SessionRevocationReasons.logout,
    });
    if (!invalidated.ok) {
      return invalidated;
    }

    const revokedAt = invalidated.value.session.revocation?.revokedAt;
    if (!revokedAt) {
      return this.failure(
        IdentityErrorCodes.invalidSessionState,
        `Session '${invalidated.value.session.id}' did not record revocation metadata.`,
      );
    }

    const result = identitySuccess(Object.freeze({
      sessionId: invalidated.value.session.id,
      userIdentityId: invalidated.value.session.userIdentityId,
      revokedAt,
      revocationReason: SessionRevocationReasons.logout,
    }));

    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.sessionLoggedOut,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: result.value.revokedAt,
        payload: {
          sessionId: result.value.sessionId,
          userIdentityId: result.value.userIdentityId,
          revocationReason: result.value.revocationReason,
          revokedAt: result.value.revokedAt,
        },
      }),
    );

    return result;
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

import {
  IdentitySessionStatuses,
  SessionRevocationReasons,
  UserIdentityStatuses,
  transitionUserIdentityStatus,
  type UserIdentity,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "../../../../application/contracts/IdentityLifecycleEventContracts";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../../../../application/identity/ports/IIdentitySessionRepository";
import { publishIdentityLifecycleEventBestEffort } from "../services/IdentityLifecycleEventPublishing";
import type { IdentityAuthenticatedSessionService } from "../services/IdentityAuthenticatedSessionService";
import type { IdentityAdministrativeActionContext } from "./IdentityAdministrativeContext";

export interface SetLocalIdentityAccountStatusInput {
  readonly context: IdentityAdministrativeActionContext;
  readonly userIdentityId: string;
  readonly action: "enable" | "disable";
  readonly providerId?: string;
}

export interface SetLocalIdentityAccountStatusResult {
  readonly userIdentityId: string;
  readonly status: UserIdentity["status"];
  readonly changed: boolean;
  readonly affectedSessionIds: ReadonlyArray<string>;
  readonly updatedAt: string;
}

export type SetLocalIdentityAccountStatusErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound
  | typeof IdentityErrorCodes.invalidState
  | typeof IdentityErrorCodes.invalidSessionState;

interface SetLocalIdentityAccountStatusDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly persistenceRepository: IIdentityPersistenceRepository;
  readonly sessionRepository: IIdentitySessionRepository;
  readonly authenticatedSessionService: Pick<IdentityAuthenticatedSessionService, "revokeAuthenticatedSessionById">;
  readonly clock: IIdentityClock;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
}

export const SetLocalIdentityAccountStatusDefaults = Object.freeze({
  localProviderId: "provider:local-password",
});

export class SetLocalIdentityAccountStatusUseCase {
  public constructor(private readonly dependencies: SetLocalIdentityAccountStatusDependencies) {}

  public async execute(
    input: SetLocalIdentityAccountStatusInput,
  ): Promise<IdentityOperationResult<SetLocalIdentityAccountStatusResult, SetLocalIdentityAccountStatusErrorCode>> {
    const actorUserIdentityId = normalizeRequired(input.context.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "context.actorUserIdentityId is required.");
    }

    const userIdentityId = normalizeRequired(input.userIdentityId);
    if (!userIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "userIdentityId is required.");
    }

    const providerId = normalizeRequired(input.providerId ?? SetLocalIdentityAccountStatusDefaults.localProviderId);
    if (!providerId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "providerId is required.");
    }

    const identity = await this.dependencies.lookupRepository.findUserIdentityById(userIdentityId);
    if (!identity) {
      return this.failure(IdentityErrorCodes.notFound, `User identity '${userIdentityId}' was not found.`);
    }

    const localProviderLink = identity.linkedProviders.find((entry) => (
      entry.providerId === providerId && !entry.unlinkedAt
    ));
    if (!localProviderLink) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        `User identity '${userIdentityId}' is not linked to local provider '${providerId}'.`,
      );
    }

    const nextStatus = this.resolveTargetStatus(input.action, identity.status);
    if (!nextStatus.ok) {
      return nextStatus;
    }

    if (nextStatus.value === identity.status) {
      return identitySuccess(Object.freeze({
        userIdentityId: identity.id,
        status: identity.status,
        changed: false,
        affectedSessionIds: Object.freeze([]),
        updatedAt: identity.updatedAt,
      }));
    }

    let transitionedIdentity: UserIdentity;
    try {
      transitionedIdentity = transitionUserIdentityStatus(
        identity,
        nextStatus.value,
        this.dependencies.clock.now(),
      );
    } catch (error) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Account status transition failed: ${normalizeError(error)}.`,
      );
    }

    await this.dependencies.persistenceRepository.saveUserIdentity(transitionedIdentity);
    let affectedSessionIds: ReadonlyArray<string> = Object.freeze([]);
    if (input.action === "disable") {
      try {
        affectedSessionIds = await this.revokeActiveSessionsForIdentity(identity.id);
      } catch (error) {
        return this.failure(
          IdentityErrorCodes.invalidSessionState,
          `Account disablement could not revoke active sessions: ${normalizeError(error)}.`,
        );
      }
    }

    const result = identitySuccess(Object.freeze({
      userIdentityId: transitionedIdentity.id,
      status: transitionedIdentity.status,
      changed: true,
      affectedSessionIds,
      updatedAt: transitionedIdentity.updatedAt,
    }));

    if (input.action === "disable") {
      await publishIdentityLifecycleEventBestEffort(
        this.dependencies.eventPublisher,
        createIdentityLifecycleEvent({
          eventType: IdentityLifecycleEventTypes.localAccountDisabled,
          contractVersion: IdentityLifecycleEventContractVersions.v1,
          occurredAt: result.value.updatedAt,
          payload: {
            userIdentityId: result.value.userIdentityId,
            actorUserIdentityId,
            providerId,
            status: result.value.status,
            affectedSessionIds: result.value.affectedSessionIds,
            disabledAt: result.value.updatedAt,
          },
        }),
      );
    }

    return result;
  }

  private async revokeActiveSessionsForIdentity(userIdentityId: string): Promise<ReadonlyArray<string>> {
    const activeSessions = await this.dependencies.sessionRepository.listSessionsByUserIdentityId({
      userIdentityId,
      includeStatuses: [IdentitySessionStatuses.active],
    });
    const revokedSessionIds: string[] = [];

    for (const session of activeSessions) {
      const revoked = await this.dependencies.authenticatedSessionService.revokeAuthenticatedSessionById({
        sessionId: session.id,
        reason: SessionRevocationReasons.admin,
      });
      if (
        !revoked.ok
        && revoked.error.code !== IdentityErrorCodes.invalidSessionState
        && revoked.error.code !== IdentityErrorCodes.notFound
      ) {
        throw new Error(
          `Failed to revoke active session '${session.id}' during account disablement.`,
        );
      }
      revokedSessionIds.push(session.id);
    }

    return Object.freeze(revokedSessionIds);
  }

  private resolveTargetStatus(
    action: SetLocalIdentityAccountStatusInput["action"],
    currentStatus: UserIdentity["status"],
  ): IdentityOperationResult<UserIdentity["status"], SetLocalIdentityAccountStatusErrorCode> {
    if (action === "disable") {
      if (currentStatus === UserIdentityStatuses.deactivated) {
        return this.failure(
          IdentityErrorCodes.invalidState,
          "Deactivated accounts cannot be disabled.",
        );
      }
      return identitySuccess(UserIdentityStatuses.suspended);
    }

    if (currentStatus === UserIdentityStatuses.deactivated) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        "Deactivated accounts cannot be enabled.",
      );
    }
    return identitySuccess(UserIdentityStatuses.active);
  }

  private failure<TValue, TCode extends SetLocalIdentityAccountStatusErrorCode>(
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

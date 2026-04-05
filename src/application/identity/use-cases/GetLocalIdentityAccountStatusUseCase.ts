import type { UserIdentity } from "../../../domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentitySessionRepository } from "../../../../application/identity/ports/IIdentitySessionRepository";
import type { IdentityAdministrativeActionContext } from "./IdentityAdministrativeContext";
import type { LocalIdentityAccountSummary } from "./ListLocalIdentityAccountsUseCase";

export interface GetLocalIdentityAccountStatusInput {
  readonly context: IdentityAdministrativeActionContext;
  readonly userIdentityId: string;
  readonly providerId?: string;
}

export interface GetLocalIdentityAccountStatusResult {
  readonly account: LocalIdentityAccountSummary;
}

export type GetLocalIdentityAccountStatusErrorCode =
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.notFound;

interface GetLocalIdentityAccountStatusDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly sessionRepository: IIdentitySessionRepository;
}

export const GetLocalIdentityAccountStatusDefaults = Object.freeze({
  localProviderId: "provider:local-password",
});

export class GetLocalIdentityAccountStatusUseCase {
  public constructor(private readonly dependencies: GetLocalIdentityAccountStatusDependencies) {}

  public async execute(
    input: GetLocalIdentityAccountStatusInput,
  ): Promise<IdentityOperationResult<GetLocalIdentityAccountStatusResult, GetLocalIdentityAccountStatusErrorCode>> {
    const actorUserIdentityId = normalizeRequired(input.context.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "context.actorUserIdentityId is required.");
    }

    const userIdentityId = normalizeRequired(input.userIdentityId);
    if (!userIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "userIdentityId is required.");
    }

    const providerId = normalizeRequired(input.providerId ?? GetLocalIdentityAccountStatusDefaults.localProviderId);
    if (!providerId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "providerId is required.");
    }

    const identity = await this.dependencies.lookupRepository.findUserIdentityById(userIdentityId);
    if (!identity) {
      return this.failure(IdentityErrorCodes.notFound, `User identity '${userIdentityId}' was not found.`);
    }

    const account = await this.buildSummary(identity, providerId);
    if (!account) {
      return this.failure(
        IdentityErrorCodes.notFound,
        `User identity '${userIdentityId}' does not include local provider '${providerId}'.`,
      );
    }

    return identitySuccess(Object.freeze({ account }));
  }

  private async buildSummary(
    identity: UserIdentity,
    providerId: string,
  ): Promise<LocalIdentityAccountSummary | undefined> {
    const link = identity.linkedProviders.find((entry) => (
      entry.providerId === providerId && !entry.unlinkedAt
    ));
    if (!link) {
      return undefined;
    }

    const activeSessions = await this.dependencies.sessionRepository.listSessionsByUserIdentityId({
      userIdentityId: identity.id,
      includeStatuses: ["active"],
    });

    return Object.freeze({
      userIdentityId: identity.id,
      username: identity.username,
      email: identity.email,
      displayName: identity.displayName,
      accountStatus: identity.status,
      providerId: link.providerId,
      providerSubject: link.providerSubject,
      credentialStatus: link.credentialState?.status,
      credentialDisabledAt: link.credentialState?.disabledAt,
      linkedAt: link.linkedAt,
      lastAuthenticatedAt: link.lastAuthenticatedAt,
      activeSessionCount: activeSessions.length,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    });
  }

  private failure<TValue, TCode extends GetLocalIdentityAccountStatusErrorCode>(
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

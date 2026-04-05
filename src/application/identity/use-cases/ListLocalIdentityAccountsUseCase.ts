import {
  CredentialStatuses,
  type CredentialState,
  type UserIdentity,
} from "../../../domain/identity/IdentityDomain";
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

export interface ListLocalIdentityAccountsInput {
  readonly context: IdentityAdministrativeActionContext;
  readonly providerId?: string;
  readonly includeStatuses?: ReadonlyArray<UserIdentity["status"]>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface LocalIdentityAccountSummary {
  readonly userIdentityId: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly accountStatus: UserIdentity["status"];
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialStatus?: CredentialState["status"];
  readonly credentialDisabledAt?: string;
  readonly linkedAt: string;
  readonly lastAuthenticatedAt?: string;
  readonly activeSessionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListLocalIdentityAccountsResult {
  readonly accounts: ReadonlyArray<LocalIdentityAccountSummary>;
}

export type ListLocalIdentityAccountsErrorCode =
  | typeof IdentityErrorCodes.invalidRequest;

interface ListLocalIdentityAccountsDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly sessionRepository: IIdentitySessionRepository;
}

export const ListLocalIdentityAccountsDefaults = Object.freeze({
  localProviderId: "provider:local-password",
  limit: 50,
});

export class ListLocalIdentityAccountsUseCase {
  public constructor(private readonly dependencies: ListLocalIdentityAccountsDependencies) {}

  public async execute(
    input: ListLocalIdentityAccountsInput,
  ): Promise<IdentityOperationResult<ListLocalIdentityAccountsResult, ListLocalIdentityAccountsErrorCode>> {
    const actorUserIdentityId = normalizeRequired(input.context.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "context.actorUserIdentityId is required.");
    }

    const providerId = normalizeRequired(input.providerId ?? ListLocalIdentityAccountsDefaults.localProviderId);
    if (!providerId) {
      return this.failure(IdentityErrorCodes.invalidRequest, "providerId is required.");
    }

    const limit = this.normalizeOptionalPositiveInt(input.limit) ?? ListLocalIdentityAccountsDefaults.limit;
    const offset = this.normalizeOptionalNonNegativeInt(input.offset);

    const identities = await this.dependencies.lookupRepository.listUserIdentities({
      providerId,
      includeStatuses: input.includeStatuses,
      limit,
      offset,
    });

    const accounts = await Promise.all(identities.map(async (identity) => {
      const link = identity.linkedProviders.find((entry) => (
        entry.providerId === providerId && !entry.unlinkedAt
      ));
      if (!link) {
        return undefined;
      }

      const sessions = await this.dependencies.sessionRepository.listSessionsByUserIdentityId({
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
        credentialDisabledAt: link.credentialState?.status === CredentialStatuses.disabled
          ? link.credentialState.disabledAt
          : undefined,
        linkedAt: link.linkedAt,
        lastAuthenticatedAt: link.lastAuthenticatedAt,
        activeSessionCount: sessions.length,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
      });
    }));

    return identitySuccess(Object.freeze({
      accounts: Object.freeze(accounts.filter((account): account is LocalIdentityAccountSummary => Boolean(account))),
    }));
  }

  private normalizeOptionalPositiveInt(value?: number): number | undefined {
    if (!Number.isInteger(value) || (value ?? 0) <= 0) {
      return undefined;
    }
    return value;
  }

  private normalizeOptionalNonNegativeInt(value?: number): number | undefined {
    if (!Number.isInteger(value) || (value ?? -1) < 0) {
      return undefined;
    }
    return value;
  }

  private failure<TValue, TCode extends ListLocalIdentityAccountsErrorCode>(
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

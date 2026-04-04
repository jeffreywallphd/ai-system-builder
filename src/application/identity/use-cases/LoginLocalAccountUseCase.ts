import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  CredentialStatuses,
  UserIdentityStatuses,
  type AuthProvider,
  type UserIdentity,
  type UserIdentityProviderLink,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { ILocalPasswordCredentialService } from "../../../../application/identity/ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";

export type LoginLocalAccountErrorCode =
  | typeof IdentityErrorCodes.invalidCredentials
  | typeof IdentityErrorCodes.inactiveAccount
  | typeof IdentityErrorCodes.unsupportedProvider
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState
  | typeof IdentityErrorCodes.notFound;

export interface LoginLocalAccountCredentialInput {
  readonly candidate: string;
}

export interface LoginLocalAccountInput {
  readonly providerId?: string;
  readonly providerSubject: string;
  readonly credential: LoginLocalAccountCredentialInput;
}

export interface LoginLocalAccountResult {
  readonly userIdentityId: string;
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialMaterialId: string;
  readonly authPath: typeof AuthProviderKinds.localPassword;
  readonly authenticatedAt: string;
}

interface LoginLocalAccountDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly passwordCredentialService: ILocalPasswordCredentialService;
  readonly clock: IIdentityClock;
}

export const LoginLocalAccountDefaults = Object.freeze({
  localProviderId: "provider:local-password",
});

export class LoginLocalAccountUseCase {
  public constructor(private readonly dependencies: LoginLocalAccountDependencies) {}

  public async execute(
    input: LoginLocalAccountInput,
  ): Promise<IdentityOperationResult<LoginLocalAccountResult, LoginLocalAccountErrorCode>> {
    const providerIdResult = this.requireNonEmpty(
      input.providerId ?? LoginLocalAccountDefaults.localProviderId,
      "providerId",
    );
    if (!providerIdResult.ok) {
      return providerIdResult;
    }

    const candidateResult = this.requireSecretCandidate(
      this.dependencies.passwordCredentialService.normalizePassword(input.credential.candidate),
      "credential.candidate",
    );
    if (!candidateResult.ok) {
      return candidateResult;
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId: providerIdResult.value,
      providerSubject: input.providerSubject,
      providerKind: AuthProviderKinds.localPassword,
    });
    if (!normalizedProviderReference.valid || !normalizedProviderReference.value) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        "Provider reference is invalid for local login.",
        {
          issueCodes: normalizedProviderReference.issues.map((issue) => issue.code),
        },
      );
    }

    const providerResult = await this.resolveLocalProvider(normalizedProviderReference.value.providerId);
    if (!providerResult.ok) {
      return providerResult;
    }

    const userIdentity = await this.dependencies.lookupRepository.findUserIdentityByProviderSubject({
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
    });
    if (!userIdentity) {
      return this.failure(
        IdentityErrorCodes.notFound,
        "Identity was not found for the requested local login path.",
      );
    }

    const accountStateResult = this.ensureAccountIsAuthenticatable(
      userIdentity,
      providerResult.value.id,
      normalizedProviderReference.value.providerSubject,
    );
    if (!accountStateResult.ok) {
      return accountStateResult;
    }

    const credentialMaterial = await this.dependencies.credentialMaterialRepository.getActiveCredentialMaterial({
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
    });
    if (!credentialMaterial) {
      return this.invalidCredentialsFailure();
    }

    const isValidCredential = await this.dependencies.passwordCredentialService.verifyPassword(
      candidateResult.value,
      {
        hashAlgorithm: credentialMaterial.hashAlgorithm,
        hashValue: credentialMaterial.hashValue,
        salt: credentialMaterial.salt,
        pepperVersion: credentialMaterial.pepperVersion,
      },
    );
    if (!isValidCredential) {
      return this.invalidCredentialsFailure();
    }

    return identitySuccess(Object.freeze({
      userIdentityId: userIdentity.id,
      username: userIdentity.username,
      email: userIdentity.email,
      displayName: userIdentity.displayName,
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
      credentialMaterialId: credentialMaterial.id,
      authPath: AuthProviderKinds.localPassword,
      authenticatedAt: this.dependencies.clock.now().toISOString(),
    }));
  }

  private async resolveLocalProvider(
    providerId: string,
  ): Promise<IdentityOperationResult<AuthProvider, LoginLocalAccountErrorCode>> {
    const provider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (!provider) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Login provider '${providerId}' is not configured.`,
      );
    }

    if (
      provider.kind !== AuthProviderKinds.localPassword
      || provider.category !== AuthProviderCategories.local
    ) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Login provider '${providerId}' is not a local password provider.`,
      );
    }

    if (provider.status !== AuthProviderStatuses.active) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Login provider '${providerId}' is not active.`,
      );
    }

    return identitySuccess(provider);
  }

  private ensureAccountIsAuthenticatable(
    userIdentity: UserIdentity,
    providerId: string,
    providerSubject: string,
  ): IdentityOperationResult<UserIdentityProviderLink, LoginLocalAccountErrorCode> {
    if (userIdentity.status !== UserIdentityStatuses.active) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `User identity '${userIdentity.id}' is not active.`,
      );
    }

    const link = userIdentity.linkedProviders.find((entry) => (
      entry.providerId === providerId && entry.providerSubject === providerSubject
    ));
    if (!link) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `User identity '${userIdentity.id}' is missing local provider link '${providerId}|${providerSubject}'.`,
      );
    }

    if (link.unlinkedAt) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `Local provider link '${providerId}|${providerSubject}' is inactive.`,
      );
    }

    const credentialStatus = link.credentialState?.status;
    if (!credentialStatus) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Local provider link '${providerId}|${providerSubject}' does not define credential state.`,
      );
    }

    if (
      credentialStatus === CredentialStatuses.locked
      || credentialStatus === CredentialStatuses.compromised
      || credentialStatus === CredentialStatuses.disabled
    ) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `Local credential state '${credentialStatus}' does not allow login.`,
      );
    }

    return identitySuccess(link);
  }

  private invalidCredentialsFailure(): IdentityOperationResult<never, typeof IdentityErrorCodes.invalidCredentials> {
    return this.failure(
      IdentityErrorCodes.invalidCredentials,
      "Invalid credentials.",
    );
  }

  private requireNonEmpty(
    value: string,
    field: string,
  ): IdentityOperationResult<string, LoginLocalAccountErrorCode> {
    const normalized = value.trim();
    if (!normalized) {
      return this.failure(IdentityErrorCodes.invalidRequest, `${field} is required.`);
    }

    return identitySuccess(normalized);
  }

  private requireSecretCandidate(
    value: string,
    field: string,
  ): IdentityOperationResult<string, LoginLocalAccountErrorCode> {
    if (value.length === 0) {
      return this.failure(IdentityErrorCodes.invalidCredentials, `${field} is required.`);
    }

    return identitySuccess(value);
  }

  private failure<TValue, TCode extends LoginLocalAccountErrorCode>(
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

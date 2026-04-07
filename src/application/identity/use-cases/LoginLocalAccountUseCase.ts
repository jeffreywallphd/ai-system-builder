import {
  CredentialStatuses,
  UserIdentityStatuses,
  type AuthProvider,
  type UserIdentity,
  type UserIdentityProviderLink,
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
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityCredentialAuthenticator } from "../../../../application/identity/ports/IIdentityCredentialAuthenticator";
import type { IIdentityLifecycleEventPublisher } from "../../../../application/identity/ports/IIdentityLifecycleEventPublisher";
import { publishIdentityLifecycleEventBestEffort } from "../services/IdentityLifecycleEventPublishing";
import { IdentityPolicyService } from "../services/IdentityPolicyService";
import { validateIdentityProvider } from "../services/IdentityProviderCatalog";

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
  readonly authPath: string;
  readonly authenticatedAt: string;
}

interface LoginLocalAccountDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly credentialAuthenticator: IIdentityCredentialAuthenticator;
  readonly clock: IIdentityClock;
  readonly eventPublisher?: IIdentityLifecycleEventPublisher;
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
      this.dependencies.credentialAuthenticator.normalizeCandidate(input.credential.candidate),
      "credential.candidate",
    );
    if (!candidateResult.ok) {
      return candidateResult;
    }

    const providerResult = await this.resolveLocalProvider(providerIdResult.value);
    if (!providerResult.ok) {
      return providerResult;
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId: providerResult.value.id,
      providerSubject: input.providerSubject,
      providerKind: providerResult.value.kind,
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

    const userIdentity = await this.dependencies.lookupRepository.findUserIdentityByProviderSubject({
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
    });
    if (!userIdentity) {
      await this.emitFailedLoginEvent(
        providerResult.value.id,
        normalizedProviderReference.value.providerSubject,
        IdentityErrorCodes.notFound,
      );
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
      await this.emitFailedLoginEvent(
        providerResult.value.id,
        normalizedProviderReference.value.providerSubject,
        accountStateResult.error.code,
      );
      return accountStateResult;
    }

    const credentialMaterial = await this.dependencies.credentialMaterialRepository.getActiveCredentialMaterial({
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
    });
    if (!credentialMaterial) {
      await this.emitFailedLoginEvent(
        providerResult.value.id,
        normalizedProviderReference.value.providerSubject,
        IdentityErrorCodes.invalidCredentials,
      );
      return this.invalidCredentialsFailure();
    }

    const verifyCandidate = this.dependencies.credentialAuthenticator.verifyCandidate;
    if (!verifyCandidate || !this.dependencies.credentialAuthenticator.capabilities.canVerifyCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot verify credential material.`,
      );
    }

    const isValidCredential = await verifyCandidate.call(this.dependencies.credentialAuthenticator, candidateResult.value, {
      hashAlgorithm: credentialMaterial.hashAlgorithm,
      hashValue: credentialMaterial.hashValue,
      salt: credentialMaterial.salt,
      pepperVersion: credentialMaterial.pepperVersion,
    });
    if (!isValidCredential) {
      await this.emitFailedLoginEvent(
        providerResult.value.id,
        normalizedProviderReference.value.providerSubject,
        IdentityErrorCodes.invalidCredentials,
      );
      return this.invalidCredentialsFailure();
    }

    const result = identitySuccess(Object.freeze({
      userIdentityId: userIdentity.id,
      username: userIdentity.username,
      email: userIdentity.email,
      displayName: userIdentity.displayName,
      providerId: providerResult.value.id,
      providerSubject: normalizedProviderReference.value.providerSubject,
      credentialMaterialId: credentialMaterial.id,
      authPath: this.dependencies.credentialAuthenticator.kind,
      authenticatedAt: this.dependencies.clock.now().toISOString(),
    }));

    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.localAccountLoginSucceeded,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: result.value.authenticatedAt,
        payload: {
          userIdentityId: result.value.userIdentityId,
          providerId: result.value.providerId,
          providerSubject: result.value.providerSubject,
          credentialMaterialId: result.value.credentialMaterialId,
          authenticatedAt: result.value.authenticatedAt,
          authPath: result.value.authPath,
        },
      }),
    );

    return result;
  }

  private async emitFailedLoginEvent(
    providerId: string,
    providerSubject: string,
    errorCode: string,
  ): Promise<void> {
    await publishIdentityLifecycleEventBestEffort(
      this.dependencies.eventPublisher,
      createIdentityLifecycleEvent({
        eventType: IdentityLifecycleEventTypes.localAccountLoginFailed,
        contractVersion: IdentityLifecycleEventContractVersions.v1,
        occurredAt: this.dependencies.clock.now().toISOString(),
        payload: {
          providerId,
          providerSubject,
          errorCode,
          attemptedAt: this.dependencies.clock.now().toISOString(),
        },
      }),
    );
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

    const providerValidation = validateIdentityProvider(provider, {
      expectedCategory: "local",
      authenticatorKind: this.dependencies.credentialAuthenticator.kind,
      requireCredentialPolicy: true,
      requireCredentialMaterialRecords: true,
    });
    if (!providerValidation.ok) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        providerValidation.failure.message,
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

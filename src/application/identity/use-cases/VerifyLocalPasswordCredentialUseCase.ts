import { AuthProviderCategories, AuthProviderStatuses, type AuthProvider } from "../../../domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityCredentialAuthenticator } from "../../../../application/identity/ports/IIdentityCredentialAuthenticator";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";
import { providerSupportsAuthenticator } from "../../../../application/identity/services/IdentityProviderCatalog";

export type VerifyLocalPasswordCredentialErrorCode =
  | typeof IdentityErrorCodes.invalidCredentials
  | typeof IdentityErrorCodes.unsupportedProvider
  | typeof IdentityErrorCodes.invalidRequest;

export interface VerifyLocalPasswordCredentialInput {
  readonly providerId: string;
  readonly providerSubject: string;
  readonly candidate: string;
}

export interface VerifyLocalPasswordCredentialResult {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialMaterialId: string;
  readonly hashAlgorithm: string;
}

interface VerifyLocalPasswordCredentialDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly credentialAuthenticator: IIdentityCredentialAuthenticator;
}

export class VerifyLocalPasswordCredentialUseCase {
  public constructor(private readonly dependencies: VerifyLocalPasswordCredentialDependencies) {}

  public async execute(
    input: VerifyLocalPasswordCredentialInput,
  ): Promise<IdentityOperationResult<VerifyLocalPasswordCredentialResult, VerifyLocalPasswordCredentialErrorCode>> {
    const providerIdResult = this.requireNonEmpty(input.providerId, "providerId");
    if (!providerIdResult.ok) {
      return providerIdResult;
    }
    const providerResult = await this.resolveLocalProvider(providerIdResult.value);
    if (!providerResult.ok) {
      return providerResult;
    }

    const normalizedCandidateResult = this.requireSecretCandidate(
      this.dependencies.credentialAuthenticator.normalizeCandidate(input.candidate),
      "candidate",
    );
    if (!normalizedCandidateResult.ok) {
      return normalizedCandidateResult;
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId: providerResult.value.id,
      providerSubject: input.providerSubject,
      providerKind: providerResult.value.kind,
    });
    if (!normalizedProviderReference.valid || !normalizedProviderReference.value) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        "Provider reference is invalid for local-password verification.",
        {
          issueCodes: normalizedProviderReference.issues.map((issue) => issue.code),
        },
      );
    }

    const credentialMaterial = await this.dependencies.credentialMaterialRepository.getActiveCredentialMaterial({
      providerId: normalizedProviderReference.value.providerId,
      providerSubject: normalizedProviderReference.value.providerSubject,
    });
    if (!credentialMaterial) {
      return this.invalidCredentialsFailure();
    }

    const verifyCandidate = this.dependencies.credentialAuthenticator.verifyCandidate;
    if (!verifyCandidate || !this.dependencies.credentialAuthenticator.capabilities.canVerifyCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot verify credential material.`,
      );
    }

    const isValid = await verifyCandidate.call(this.dependencies.credentialAuthenticator, normalizedCandidateResult.value, {
      hashAlgorithm: credentialMaterial.hashAlgorithm,
      hashValue: credentialMaterial.hashValue,
      salt: credentialMaterial.salt,
      pepperVersion: credentialMaterial.pepperVersion,
    });
    if (!isValid) {
      return this.invalidCredentialsFailure();
    }

    return identitySuccess(Object.freeze({
      userIdentityId: credentialMaterial.userIdentityId,
      providerId: credentialMaterial.providerId,
      providerSubject: credentialMaterial.providerSubject,
      credentialMaterialId: credentialMaterial.id,
      hashAlgorithm: credentialMaterial.hashAlgorithm,
    }));
  }

  private invalidCredentialsFailure(): IdentityOperationResult<never, typeof IdentityErrorCodes.invalidCredentials> {
    return this.failure(
      IdentityErrorCodes.invalidCredentials,
      "Invalid credentials.",
    );
  }

  private async resolveLocalProvider(
    providerId: string,
  ): Promise<IdentityOperationResult<AuthProvider, VerifyLocalPasswordCredentialErrorCode>> {
    const provider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (!provider) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Verification provider '${providerId}' is not configured.`,
      );
    }

    if (provider.category !== AuthProviderCategories.local) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Verification provider '${providerId}' is not a local provider.`,
      );
    }

    if (!providerSupportsAuthenticator(provider, this.dependencies.credentialAuthenticator.kind)) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Verification provider '${providerId}' does not support authenticator '${this.dependencies.credentialAuthenticator.kind}'.`,
      );
    }

    if (provider.status !== AuthProviderStatuses.active) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Verification provider '${providerId}' is not active.`,
      );
    }

    return identitySuccess(provider);
  }

  private requireNonEmpty(
    value: string,
    field: string,
    code: typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidCredentials = IdentityErrorCodes.invalidRequest,
  ): IdentityOperationResult<string, VerifyLocalPasswordCredentialErrorCode> {
    const normalized = value.trim();
    if (!normalized) {
      return this.failure(code, `${field} is required.`);
    }
    return identitySuccess(normalized);
  }

  private requireSecretCandidate(
    value: string,
    field: string,
  ): IdentityOperationResult<string, VerifyLocalPasswordCredentialErrorCode> {
    if (value.length === 0) {
      return this.failure(IdentityErrorCodes.invalidCredentials, `${field} is required.`);
    }

    return identitySuccess(value);
  }

  private failure<TValue, TCode extends VerifyLocalPasswordCredentialErrorCode>(
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

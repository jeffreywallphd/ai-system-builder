import { AuthProviderKinds } from "../../../domain/identity/IdentityDomain";
import {
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { ILocalPasswordCredentialService } from "../../../../application/identity/ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";

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
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly passwordCredentialService: ILocalPasswordCredentialService;
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
    const normalizedCandidateResult = this.requireSecretCandidate(
      this.dependencies.passwordCredentialService.normalizePassword(input.candidate),
      "candidate",
    );
    if (!normalizedCandidateResult.ok) {
      return normalizedCandidateResult;
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId: providerIdResult.value,
      providerSubject: input.providerSubject,
      providerKind: AuthProviderKinds.localPassword,
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

    const isValid = await this.dependencies.passwordCredentialService.verifyPassword(
      normalizedCandidateResult.value,
      {
        hashAlgorithm: credentialMaterial.hashAlgorithm,
        hashValue: credentialMaterial.hashValue,
        salt: credentialMaterial.salt,
        pepperVersion: credentialMaterial.pepperVersion,
      },
    );
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

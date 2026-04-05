import {
  UserIdentityStatuses,
  createLocalCredentialState,
  createUserIdentity,
  type AuthProvider,
  type CredentialPolicy,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  IdentityIdNamespaces,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../../../application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import type { IIdentityCredentialAuthenticator } from "../../../../application/identity/ports/IIdentityCredentialAuthenticator";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";
import { validateIdentityProvider } from "../../../../application/identity/services/IdentityProviderCatalog";

export type RegisterLocalAccountErrorCode =
  | typeof IdentityErrorCodes.duplicateIdentity
  | typeof IdentityErrorCodes.invalidCredentials
  | typeof IdentityErrorCodes.policyViolation
  | typeof IdentityErrorCodes.unsupportedProvider
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState;

export interface RegisterLocalAccountCredentialInput {
  readonly candidate: string;
}

export interface RegisterLocalAccountInput {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerId?: string;
  readonly providerSubject?: string;
  readonly credentialPolicyId?: string;
  readonly credential: RegisterLocalAccountCredentialInput;
}

export interface RegisterLocalAccountResult {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialPolicyId: string;
  readonly credentialMaterialId: string;
  readonly registeredAt: string;
}

interface RegisterLocalAccountDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly persistenceRepository: IIdentityPersistenceRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly credentialAuthenticator: IIdentityCredentialAuthenticator;
  readonly idGenerator: IIdentityIdGenerator;
  readonly clock: IIdentityClock;
}

export const RegisterLocalAccountDefaults = Object.freeze({
  localProviderId: "provider:local-password",
  localCredentialPolicyId: "policy:local-password",
});

export class RegisterLocalAccountUseCase {
  public constructor(private readonly dependencies: RegisterLocalAccountDependencies) {}

  public async execute(
    input: RegisterLocalAccountInput,
  ): Promise<IdentityOperationResult<RegisterLocalAccountResult, RegisterLocalAccountErrorCode>> {
    const providerIdResult = this.requireNonEmpty(
      input.providerId ?? RegisterLocalAccountDefaults.localProviderId,
      "providerId",
    );
    if (!providerIdResult.ok) {
      return providerIdResult;
    }

    const credentialPolicyIdResult = this.requireNonEmpty(
      input.credentialPolicyId ?? RegisterLocalAccountDefaults.localCredentialPolicyId,
      "credentialPolicyId",
    );
    if (!credentialPolicyIdResult.ok) {
      return credentialPolicyIdResult;
    }

    const credentialCandidateResult = this.requireSecretCandidate(
      this.dependencies.credentialAuthenticator.normalizeCandidate(input.credential.candidate),
      "credential.candidate",
    );
    if (!credentialCandidateResult.ok) {
      return credentialCandidateResult;
    }

    const providerId = providerIdResult.value;
    const credentialPolicyId = credentialPolicyIdResult.value;
    const providerResult = await this.resolveLocalProvider(providerId);
    if (!providerResult.ok) {
      return providerResult;
    }

    const normalizedProfile = this.dependencies.identityPolicyService.normalizeRegistrationInput({
      username: input.username,
      email: input.email,
      displayName: input.displayName,
    });
    if (!normalizedProfile.valid || !normalizedProfile.value) {
      return this.failure(
        IdentityErrorCodes.policyViolation,
        this.withIssueDetails(
          "Registration profile is invalid.",
          normalizedProfile.issues.map((issue) => issue.message),
        ),
        {
          issueCodes: normalizedProfile.issues.map((issue) => issue.code),
        },
      );
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId,
      providerSubject: input.providerSubject ?? normalizedProfile.value.username,
      providerKind: providerResult.value.kind,
    });
    if (!normalizedProviderReference.valid || !normalizedProviderReference.value) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        this.withIssueDetails(
          "Registration provider reference is invalid.",
          normalizedProviderReference.issues.map((issue) => issue.message),
        ),
        {
          issueCodes: normalizedProviderReference.issues.map((issue) => issue.code),
        },
      );
    }

    const credentialPolicyResult = await this.resolveCredentialPolicy(credentialPolicyId);
    if (!credentialPolicyResult.ok) {
      return credentialPolicyResult;
    }

    const uniqueness = await this.dependencies.identityPolicyService.checkAccountUniqueness({
      username: normalizedProfile.value.username,
      email: normalizedProfile.value.email,
      displayName: normalizedProfile.value.displayName,
      providerReference: {
        providerId,
        providerSubject: normalizedProviderReference.value.providerSubject,
        providerKind: providerResult.value.kind,
      },
    });
    if (!uniqueness.outcome.ok) {
      return uniqueness.outcome;
    }

    const credentialValidation = this.dependencies.identityPolicyService.evaluateCredentialCandidate(
      credentialPolicyResult.value,
      credentialCandidateResult.value,
    );
    if (!credentialValidation.valid) {
      return this.failure(
        IdentityErrorCodes.policyViolation,
        this.withIssueDetails(
          "Credential policy validation failed.",
          credentialValidation.issues.map((issue) => issue.message),
        ),
        {
          issueCodes: credentialValidation.issues.map((issue) => issue.code),
        },
      );
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();
    const userIdentityId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.userIdentity);
    const credentialMaterialId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.credentialMaterial);
    const providerSubject = normalizedProviderReference.value.providerSubject;
    const issueCredentialMaterial = this.dependencies.credentialAuthenticator.issueCredentialMaterial;
    if (!issueCredentialMaterial || !this.dependencies.credentialAuthenticator.capabilities.canIssueCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot issue credential material.`,
      );
    }

    const hashedCredentialMaterial = await issueCredentialMaterial.call(
      this.dependencies.credentialAuthenticator,
      credentialCandidateResult.value,
    );
    const hashAlgorithm = this.normalizeOptional(hashedCredentialMaterial.hashAlgorithm);
    const hashValue = this.normalizeOptional(hashedCredentialMaterial.hashValue);
    if (!hashAlgorithm || !hashValue) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        "Password credential service returned invalid hash material.",
      );
    }

    const userIdentity = createUserIdentity({
      id: userIdentityId,
      username: normalizedProfile.value.username,
      email: normalizedProfile.value.email,
      displayName: normalizedProfile.value.displayName,
      status: UserIdentityStatuses.active,
      linkedProviders: [{
        providerId: providerResult.value.id,
        providerSubject,
        isPrimary: true,
        linkedAt: now,
        credentialState: createLocalCredentialState({
          policy: credentialPolicyResult.value,
          passwordChangedAt: now,
        }),
      }],
      now,
    });

    await this.dependencies.persistenceRepository.saveUserIdentity(userIdentity);
    await this.dependencies.credentialMaterialRepository.saveCredentialMaterial({
      id: credentialMaterialId,
      userIdentityId,
      providerId: providerResult.value.id,
      providerSubject,
      hashAlgorithm,
      hashValue,
      salt: this.normalizeOptional(hashedCredentialMaterial.salt),
      pepperVersion: this.normalizeOptional(hashedCredentialMaterial.pepperVersion),
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return identitySuccess(Object.freeze({
      userIdentityId,
      providerId: providerResult.value.id,
      providerSubject,
      credentialPolicyId: credentialPolicyResult.value.id,
      credentialMaterialId,
      registeredAt: nowIso,
    }));
  }

  private async resolveLocalProvider(
    providerId: string,
  ): Promise<IdentityOperationResult<AuthProvider, RegisterLocalAccountErrorCode>> {
    const provider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (!provider) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Registration provider '${providerId}' is not configured.`,
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

  private async resolveCredentialPolicy(
    policyId: string,
  ): Promise<IdentityOperationResult<CredentialPolicy, RegisterLocalAccountErrorCode>> {
    const policy = await this.dependencies.lookupRepository.findCredentialPolicyById(policyId);
    if (!policy) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Credential policy '${policyId}' is not configured.`,
      );
    }

    return identitySuccess(policy);
  }

  private requireNonEmpty(
    value: string,
    field: string,
    code: typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidCredentials = IdentityErrorCodes.invalidRequest,
  ): IdentityOperationResult<string, RegisterLocalAccountErrorCode> {
    const normalized = value.trim();
    if (!normalized) {
      return this.failure(code, `${field} is required.`);
    }

    return identitySuccess(normalized);
  }

  private normalizeOptional(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private requireSecretCandidate(
    value: string,
    field: string,
  ): IdentityOperationResult<string, RegisterLocalAccountErrorCode> {
    if (value.length === 0) {
      return this.failure(IdentityErrorCodes.invalidCredentials, `${field} is required.`);
    }

    return identitySuccess(value);
  }

  private withIssueDetails(prefix: string, issues: ReadonlyArray<string>): string {
    if (issues.length === 0) {
      return prefix;
    }

    return `${prefix} ${issues.join(" ")}`;
  }

  private failure<TValue, TCode extends RegisterLocalAccountErrorCode>(
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

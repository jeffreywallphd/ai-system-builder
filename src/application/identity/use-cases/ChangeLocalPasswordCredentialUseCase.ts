import {
  CredentialStatuses,
  UserIdentityStatuses,
  createLocalCredentialState,
  withUserIdentityProviderCredentialState,
  type AuthProvider,
  type CredentialPolicy,
  type UserIdentity,
  type UserIdentityProviderLink,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  IdentityIdNamespaces,
  identityFailure,
  identitySuccess,
  type IdentityCredentialMaterialRecord,
  type IdentityOperationError,
  type IdentityOperationResult,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityCredentialAuthenticator } from "../../../../application/identity/ports/IIdentityCredentialAuthenticator";
import type { IIdentityCredentialResetVerifier } from "../../../../application/identity/ports/IIdentityCredentialResetVerifier";
import type { IIdentityIdGenerator } from "../../../../application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";
import { validateIdentityProvider } from "../../../../application/identity/services/IdentityProviderCatalog";

export const ChangeLocalPasswordCredentialVerificationModes = Object.freeze({
  currentCredential: "current-credential",
  resetAssertion: "reset-assertion",
});

export type ChangeLocalPasswordCredentialVerificationMode =
  typeof ChangeLocalPasswordCredentialVerificationModes[keyof typeof ChangeLocalPasswordCredentialVerificationModes];

export interface ChangeLocalPasswordCredentialCurrentCredentialVerification {
  readonly mode?: typeof ChangeLocalPasswordCredentialVerificationModes.currentCredential;
  readonly currentCredential: string;
}

export interface ChangeLocalPasswordCredentialResetAssertionVerification {
  readonly mode: typeof ChangeLocalPasswordCredentialVerificationModes.resetAssertion;
  readonly resetAssertion: string;
}

export type ChangeLocalPasswordCredentialVerificationInput =
  | ChangeLocalPasswordCredentialCurrentCredentialVerification
  | ChangeLocalPasswordCredentialResetAssertionVerification;

export type ChangeLocalPasswordCredentialErrorCode =
  | typeof IdentityErrorCodes.invalidCredentials
  | typeof IdentityErrorCodes.inactiveAccount
  | typeof IdentityErrorCodes.policyViolation
  | typeof IdentityErrorCodes.unsupportedProvider
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState
  | typeof IdentityErrorCodes.notFound;

export interface ChangeLocalPasswordCredentialInput {
  readonly userIdentityId: string;
  readonly providerId?: string;
  readonly providerSubject?: string;
  readonly credentialPolicyId?: string;
  readonly newCredential: {
    readonly candidate: string;
  };
  readonly verification: ChangeLocalPasswordCredentialVerificationInput;
}

export interface ChangeLocalPasswordCredentialResult {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialPolicyId: string;
  readonly supersededCredentialMaterialId: string;
  readonly credentialMaterialId: string;
  readonly changedAt: string;
  readonly verificationMode: ChangeLocalPasswordCredentialVerificationMode;
}

type LocalCredentialProviderLink = UserIdentityProviderLink & {
  readonly credentialState: NonNullable<UserIdentityProviderLink["credentialState"]>;
};

interface ChangeLocalPasswordCredentialDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly persistenceRepository: IIdentityPersistenceRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly credentialAuthenticator: IIdentityCredentialAuthenticator;
  readonly idGenerator: IIdentityIdGenerator;
  readonly clock: IIdentityClock;
  readonly credentialResetVerifier?: IIdentityCredentialResetVerifier;
}

export const ChangeLocalPasswordCredentialDefaults = Object.freeze({
  localProviderId: "provider:local-password",
  localCredentialPolicyId: "policy:local-password",
});

export class ChangeLocalPasswordCredentialUseCase {
  public constructor(private readonly dependencies: ChangeLocalPasswordCredentialDependencies) {}

  public async execute(
    input: ChangeLocalPasswordCredentialInput,
  ): Promise<IdentityOperationResult<ChangeLocalPasswordCredentialResult, ChangeLocalPasswordCredentialErrorCode>> {
    const userIdentityIdResult = this.requireNonEmpty(input.userIdentityId, "userIdentityId");
    if (!userIdentityIdResult.ok) {
      return userIdentityIdResult;
    }

    const providerIdResult = this.requireNonEmpty(
      input.providerId ?? ChangeLocalPasswordCredentialDefaults.localProviderId,
      "providerId",
    );
    if (!providerIdResult.ok) {
      return providerIdResult;
    }
    const providerId = providerIdResult.value;

    const providerResult = await this.resolveLocalProvider(providerId);
    if (!providerResult.ok) {
      return providerResult;
    }

    const userIdentity = await this.dependencies.lookupRepository.findUserIdentityById(userIdentityIdResult.value);
    if (!userIdentity) {
      return this.failure(
        IdentityErrorCodes.notFound,
        `User identity '${userIdentityIdResult.value}' was not found.`,
      );
    }

    const providerLinkResult = this.resolveActiveProviderLink(userIdentity, providerId, input.providerSubject);
    if (!providerLinkResult.ok) {
      return providerLinkResult;
    }
    const providerLink = providerLinkResult.value;

    const credentialPolicyId = this.normalizeOptional(input.credentialPolicyId)
      ?? providerLink.credentialState.policyId
      ?? ChangeLocalPasswordCredentialDefaults.localCredentialPolicyId;
    const credentialPolicyResult = await this.resolveCredentialPolicy(credentialPolicyId);
    if (!credentialPolicyResult.ok) {
      return credentialPolicyResult;
    }

    const normalizedNewCredentialResult = this.requireSecretCandidate(
      this.dependencies.credentialAuthenticator.normalizeCandidate(input.newCredential.candidate),
      "newCredential.candidate",
    );
    if (!normalizedNewCredentialResult.ok) {
      return normalizedNewCredentialResult;
    }

    const credentialValidation = this.dependencies.identityPolicyService.evaluateCredentialCandidate(
      credentialPolicyResult.value,
      normalizedNewCredentialResult.value,
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

    const minAgeCheck = this.enforceMinimumCredentialAge(credentialPolicyResult.value, providerLink, this.dependencies.clock.now());
    if (!minAgeCheck.ok) {
      return minAgeCheck;
    }

    const activeCredentialMaterial = await this.dependencies.credentialMaterialRepository.getActiveCredentialMaterial({
      providerId,
      providerSubject: providerLink.providerSubject,
    });
    if (!activeCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Active credential material is missing for provider link '${providerId}|${providerLink.providerSubject}'.`,
      );
    }

    const verificationResult = await this.verifyCredentialChangeAuthorization({
      input,
      providerId,
      providerSubject: providerLink.providerSubject,
      userIdentityId: userIdentity.id,
      activeCredentialMaterial,
    });
    if (!verificationResult.ok) {
      return verificationResult;
    }

    const historyPolicyCheck = await this.enforceCredentialHistoryPolicy({
      providerId,
      providerSubject: providerLink.providerSubject,
      policy: credentialPolicyResult.value,
      candidate: normalizedNewCredentialResult.value,
    });
    if (!historyPolicyCheck.ok) {
      return historyPolicyCheck;
    }

    const issueCredentialMaterial = this.dependencies.credentialAuthenticator.issueCredentialMaterial;
    if (!issueCredentialMaterial || !this.dependencies.credentialAuthenticator.capabilities.canIssueCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot issue credential material.`,
      );
    }

    const hashedCredentialMaterial = await issueCredentialMaterial.call(
      this.dependencies.credentialAuthenticator,
      normalizedNewCredentialResult.value,
    );
    const hashAlgorithm = this.normalizeOptional(hashedCredentialMaterial.hashAlgorithm);
    const hashValue = this.normalizeOptional(hashedCredentialMaterial.hashValue);
    if (!hashAlgorithm || !hashValue) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        "Password credential service returned invalid hash material.",
      );
    }

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();
    const supersedeResult = await this.dependencies.credentialMaterialRepository.markCredentialMaterialSuperseded(
      activeCredentialMaterial.id,
      nowIso,
    );
    if (!supersedeResult.ok) {
      return this.failure(
        IdentityErrorCodes.invalidRequest,
        supersedeResult.error.message,
        supersedeResult.error.details,
      );
    }
    if (!supersedeResult.value.changed) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Credential material '${activeCredentialMaterial.id}' could not be superseded.`,
      );
    }

    const newCredentialMaterialId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.credentialMaterial);
    await this.dependencies.credentialMaterialRepository.saveCredentialMaterial({
      id: newCredentialMaterialId,
      userIdentityId: userIdentity.id,
      providerId,
      providerSubject: providerLink.providerSubject,
      hashAlgorithm,
      hashValue,
      salt: this.normalizeOptional(hashedCredentialMaterial.salt),
      pepperVersion: this.normalizeOptional(hashedCredentialMaterial.pepperVersion),
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const updatedCredentialState = createLocalCredentialState({
      policy: credentialPolicyResult.value,
      passwordChangedAt: now,
    });
    const updatedIdentity = withUserIdentityProviderCredentialState(
      userIdentity,
      providerId,
      providerLink.providerSubject,
      updatedCredentialState,
      now,
    );
    await this.dependencies.persistenceRepository.saveUserIdentity(updatedIdentity);

    return identitySuccess(Object.freeze({
      userIdentityId: userIdentity.id,
      providerId,
      providerSubject: providerLink.providerSubject,
      credentialPolicyId: credentialPolicyResult.value.id,
      supersededCredentialMaterialId: activeCredentialMaterial.id,
      credentialMaterialId: newCredentialMaterialId,
      changedAt: nowIso,
      verificationMode: verificationResult.value.verificationMode,
    }));
  }

  private async verifyCredentialChangeAuthorization(input: {
    readonly input: ChangeLocalPasswordCredentialInput;
    readonly userIdentityId: string;
    readonly providerId: string;
    readonly providerSubject: string;
    readonly activeCredentialMaterial: IdentityCredentialMaterialRecord;
  }): Promise<IdentityOperationResult<
    { readonly verificationMode: ChangeLocalPasswordCredentialVerificationMode },
    ChangeLocalPasswordCredentialErrorCode
  >> {
    const mode = input.input.verification.mode ?? ChangeLocalPasswordCredentialVerificationModes.currentCredential;
    if (mode === ChangeLocalPasswordCredentialVerificationModes.resetAssertion) {
      const resetAssertionResult = this.requireNonEmpty(input.input.verification.resetAssertion, "verification.resetAssertion");
      if (!resetAssertionResult.ok) {
        return resetAssertionResult;
      }

      if (!this.dependencies.credentialResetVerifier) {
        return this.failure(
          IdentityErrorCodes.invalidRequest,
          "Reset assertion verification is not configured.",
        );
      }

      const verification = await this.dependencies.credentialResetVerifier.verifyResetAssertion({
        userIdentityId: input.userIdentityId,
        providerId: input.providerId,
        providerSubject: input.providerSubject,
        resetAssertion: resetAssertionResult.value,
      });
      if (!verification.ok) {
        return this.failure(
          verification.error.code,
          verification.error.message,
          verification.error.details,
        );
      }

      return identitySuccess(Object.freeze({
        verificationMode: mode,
      }));
    }

    const currentCredentialResult = this.requireSecretCandidate(
      this.dependencies.credentialAuthenticator.normalizeCandidate(input.input.verification.currentCredential),
      "verification.currentCredential",
    );
    if (!currentCredentialResult.ok) {
      return currentCredentialResult;
    }

    const verifyCandidate = this.dependencies.credentialAuthenticator.verifyCandidate;
    if (!verifyCandidate || !this.dependencies.credentialAuthenticator.capabilities.canVerifyCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot verify credential material.`,
      );
    }

    const isValidCredential = await verifyCandidate.call(this.dependencies.credentialAuthenticator, currentCredentialResult.value, {
      hashAlgorithm: input.activeCredentialMaterial.hashAlgorithm,
      hashValue: input.activeCredentialMaterial.hashValue,
      salt: input.activeCredentialMaterial.salt,
      pepperVersion: input.activeCredentialMaterial.pepperVersion,
    });
    if (!isValidCredential) {
      return this.failure(
        IdentityErrorCodes.invalidCredentials,
        "Invalid credentials.",
      );
    }

    return identitySuccess(Object.freeze({
      verificationMode: mode,
    }));
  }

  private async enforceCredentialHistoryPolicy(input: {
    readonly providerId: string;
    readonly providerSubject: string;
    readonly policy: CredentialPolicy;
    readonly candidate: string;
  }): Promise<IdentityOperationResult<void, ChangeLocalPasswordCredentialErrorCode>> {
    if (input.policy.passwordHistoryCount <= 0) {
      return identitySuccess(undefined);
    }

    const verifyCandidate = this.dependencies.credentialAuthenticator.verifyCandidate;
    if (!verifyCandidate || !this.dependencies.credentialAuthenticator.capabilities.canVerifyCredentialMaterial) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Authenticator '${this.dependencies.credentialAuthenticator.kind}' cannot verify credential history.`,
      );
    }

    const history = await this.dependencies.credentialMaterialRepository.listCredentialMaterialHistory({
      reference: {
        providerId: input.providerId,
        providerSubject: input.providerSubject,
      },
      includeInactive: true,
    });
    const recentHistory = [...history]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.policy.passwordHistoryCount);

    for (const entry of recentHistory) {
      const matchesHistory = await verifyCandidate.call(this.dependencies.credentialAuthenticator, input.candidate, {
        hashAlgorithm: entry.hashAlgorithm,
        hashValue: entry.hashValue,
        salt: entry.salt,
        pepperVersion: entry.pepperVersion,
      });
      if (matchesHistory) {
        return this.failure(
          IdentityErrorCodes.policyViolation,
          "Credential policy validation failed. Credential cannot reuse recent credential history.",
          {
            issueCodes: ["credential-history-reuse"],
          },
        );
      }
    }

    return identitySuccess(undefined);
  }

  private enforceMinimumCredentialAge(
    policy: CredentialPolicy,
    providerLink: LocalCredentialProviderLink,
    now: Date,
  ): IdentityOperationResult<void, ChangeLocalPasswordCredentialErrorCode> {
    if (policy.minPasswordAgeDays <= 0) {
      return identitySuccess(undefined);
    }

    const passwordChangedAt = this.normalizeOptional(providerLink.credentialState.passwordChangedAt);
    if (!passwordChangedAt) {
      return identitySuccess(undefined);
    }

    const lastChangedAt = new Date(passwordChangedAt);
    if (Number.isNaN(lastChangedAt.getTime())) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Credential state for provider link '${providerLink.providerId}|${providerLink.providerSubject}' has invalid passwordChangedAt.`,
      );
    }

    const earliestAllowed = new Date(lastChangedAt.getTime() + policy.minPasswordAgeDays * 24 * 60 * 60 * 1000);
    if (now.getTime() < earliestAllowed.getTime()) {
      return this.failure(
        IdentityErrorCodes.policyViolation,
        `Credential policy validation failed. Credential cannot be changed before ${earliestAllowed.toISOString()}.`,
        {
          issueCodes: ["credential-min-age"],
        },
      );
    }

    return identitySuccess(undefined);
  }

  private resolveActiveProviderLink(
    userIdentity: UserIdentity,
    providerId: string,
    providerSubject?: string,
  ): IdentityOperationResult<LocalCredentialProviderLink, ChangeLocalPasswordCredentialErrorCode> {
    if (userIdentity.status !== UserIdentityStatuses.active) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `User identity '${userIdentity.id}' is not active.`,
      );
    }

    const normalizedProviderSubject = this.normalizeOptional(providerSubject)?.toLowerCase();
    const providerLinks = userIdentity.linkedProviders.filter((entry) => entry.providerId === providerId);
    const resolvedLink = normalizedProviderSubject
      ? providerLinks.find((entry) => entry.providerSubject === normalizedProviderSubject)
      : providerLinks.find((entry) => entry.isPrimary) ?? providerLinks[0];

    if (!resolvedLink) {
      return this.failure(
        IdentityErrorCodes.notFound,
        `Provider link '${providerId}' was not found on user identity '${userIdentity.id}'.`,
      );
    }

    if (resolvedLink.unlinkedAt) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `Provider link '${providerId}|${resolvedLink.providerSubject}' is inactive.`,
      );
    }

    if (!resolvedLink.credentialState) {
      return this.failure(
        IdentityErrorCodes.invalidState,
        `Provider link '${providerId}|${resolvedLink.providerSubject}' does not define credential state.`,
      );
    }

    if (
      resolvedLink.credentialState.status === CredentialStatuses.disabled
      || resolvedLink.credentialState.status === CredentialStatuses.compromised
    ) {
      return this.failure(
        IdentityErrorCodes.inactiveAccount,
        `Credential state '${resolvedLink.credentialState.status}' does not allow credential change.`,
      );
    }

    return identitySuccess(resolvedLink as LocalCredentialProviderLink);
  }

  private async resolveLocalProvider(
    providerId: string,
  ): Promise<IdentityOperationResult<AuthProvider, ChangeLocalPasswordCredentialErrorCode>> {
    const provider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (!provider) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        `Credential change provider '${providerId}' is not configured.`,
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
  ): Promise<IdentityOperationResult<CredentialPolicy, ChangeLocalPasswordCredentialErrorCode>> {
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
  ): IdentityOperationResult<string, ChangeLocalPasswordCredentialErrorCode> {
    const normalized = value.trim();
    if (!normalized) {
      return this.failure(code, `${field} is required.`);
    }

    return identitySuccess(normalized);
  }

  private requireSecretCandidate(
    value: string,
    field: string,
  ): IdentityOperationResult<string, ChangeLocalPasswordCredentialErrorCode> {
    if (value.length === 0) {
      return this.failure(IdentityErrorCodes.invalidCredentials, `${field} is required.`);
    }

    return identitySuccess(value);
  }

  private normalizeOptional(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private withIssueDetails(prefix: string, issues: ReadonlyArray<string>): string {
    if (issues.length === 0) {
      return prefix;
    }

    return `${prefix} ${issues.join(" ")}`;
  }

  private failure<TValue, TCode extends ChangeLocalPasswordCredentialErrorCode>(
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

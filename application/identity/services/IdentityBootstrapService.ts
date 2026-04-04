import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  UserIdentityStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
  createUserIdentity,
  type AuthProvider,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorBoundaries,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
  type IdentityOperationError,
  type IdentityOperationResult,
  IdentityIdNamespaces,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import { IdentityPolicyService } from "./IdentityPolicyService";

export type IdentityBootstrapErrorCode =
  | typeof IdentityErrorCodes.duplicateIdentity
  | typeof IdentityErrorCodes.invalidCredentials
  | typeof IdentityErrorCodes.policyViolation
  | typeof IdentityErrorCodes.unsupportedProvider
  | typeof IdentityErrorCodes.invalidRequest
  | typeof IdentityErrorCodes.invalidState;

export interface BootstrapCredentialMaterialInput {
  readonly hashAlgorithm: string;
  readonly hashValue: string;
  readonly salt?: string;
  readonly pepperVersion?: string;
}

export interface BootstrapLocalAdminInput {
  readonly username: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly providerSubject?: string;
  readonly providerId?: string;
  readonly providerDisplayName?: string;
  readonly credentialPolicyId?: string;
  readonly credential: BootstrapCredentialMaterialInput;
}

export interface IdentityBootstrapStatus {
  readonly canBootstrap: boolean;
  readonly userIdentityCount: number;
}

export interface IdentityBootstrapResult {
  readonly userIdentityId: string;
  readonly providerId: string;
  readonly providerSubject: string;
  readonly credentialPolicyId: string;
  readonly credentialMaterialId: string;
  readonly bootstrappedAt: string;
}

interface IdentityBootstrapDependencies {
  readonly lookupRepository: IIdentityLookupRepository;
  readonly persistenceRepository: IIdentityPersistenceRepository;
  readonly credentialMaterialRepository: ICredentialMaterialRepository;
  readonly identityPolicyService: IdentityPolicyService;
  readonly idGenerator: IIdentityIdGenerator;
  readonly clock: IIdentityClock;
}

export const IdentityBootstrapDefaults = Object.freeze({
  localProviderId: "provider:local-password",
  localProviderDisplayName: "Local Password",
  localCredentialPolicyId: "policy:local-password",
});

export class IdentityBootstrapService {
  public constructor(private readonly dependencies: IdentityBootstrapDependencies) {}

  public async getBootstrapStatus(): Promise<IdentityBootstrapStatus> {
    const userIdentityCount = await this.dependencies.lookupRepository.countUserIdentities();
    return Object.freeze({
      canBootstrap: userIdentityCount === 0,
      userIdentityCount,
    });
  }

  public async bootstrapFirstLocalAdmin(
    input: BootstrapLocalAdminInput,
  ): Promise<IdentityOperationResult<IdentityBootstrapResult, IdentityBootstrapErrorCode>> {
    const status = await this.getBootstrapStatus();
    if (!status.canBootstrap) {
      return this.failure(
        IdentityErrorCodes.duplicateIdentity,
        "Identity bootstrap is blocked because identity state already exists.",
        {
          userIdentityCount: status.userIdentityCount,
        },
      );
    }

    const providerIdResult = this.requireNonEmpty(
      input.providerId ?? IdentityBootstrapDefaults.localProviderId,
      "providerId",
    );
    if (!providerIdResult.ok) {
      return providerIdResult;
    }

    const providerDisplayNameResult = this.requireNonEmpty(
      input.providerDisplayName ?? IdentityBootstrapDefaults.localProviderDisplayName,
      "providerDisplayName",
    );
    if (!providerDisplayNameResult.ok) {
      return providerDisplayNameResult;
    }

    const credentialPolicyIdResult = this.requireNonEmpty(
      input.credentialPolicyId ?? IdentityBootstrapDefaults.localCredentialPolicyId,
      "credentialPolicyId",
    );
    if (!credentialPolicyIdResult.ok) {
      return credentialPolicyIdResult;
    }

    const providerId = providerIdResult.value;
    const providerDisplayName = providerDisplayNameResult.value;
    const credentialPolicyId = credentialPolicyIdResult.value;

    const normalizedProfile = this.dependencies.identityPolicyService.normalizeRegistrationInput({
      username: input.username,
      email: input.email,
      displayName: input.displayName,
    });
    if (!normalizedProfile.valid || !normalizedProfile.value) {
      return this.failure(
        IdentityErrorCodes.policyViolation,
        this.withIssueDetails("Bootstrap profile is invalid.", normalizedProfile.issues.map((issue) => issue.message)),
      );
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId,
      providerSubject: input.providerSubject ?? normalizedProfile.value.username,
      providerKind: AuthProviderKinds.localPassword,
    });
    if (!normalizedProviderReference.valid || !normalizedProviderReference.value) {
      return this.failure(
        IdentityErrorCodes.unsupportedProvider,
        this.withIssueDetails(
          "Bootstrap provider reference is invalid.",
          normalizedProviderReference.issues.map((issue) => issue.message),
        ),
      );
    }

    const uniqueness = await this.dependencies.identityPolicyService.checkAccountUniqueness({
      username: normalizedProfile.value.username,
      email: normalizedProfile.value.email,
      displayName: normalizedProfile.value.displayName,
      providerReference: {
        providerId,
        providerSubject: normalizedProviderReference.value.providerSubject,
        providerKind: AuthProviderKinds.localPassword,
      },
    });
    if (!uniqueness.outcome.ok) {
      return uniqueness.outcome;
    }

    const hashAlgorithmResult = this.requireNonEmpty(
      input.credential.hashAlgorithm,
      "credential.hashAlgorithm",
      IdentityErrorCodes.invalidCredentials,
    );
    if (!hashAlgorithmResult.ok) {
      return hashAlgorithmResult;
    }
    const hashAlgorithm = hashAlgorithmResult.value;

    const hashValueResult = this.requireNonEmpty(
      input.credential.hashValue,
      "credential.hashValue",
      IdentityErrorCodes.invalidCredentials,
    );
    if (!hashValueResult.ok) {
      return hashValueResult;
    }
    const hashValue = hashValueResult.value;

    const salt = this.normalizeOptional(input.credential.salt);
    const pepperVersion = this.normalizeOptional(input.credential.pepperVersion);

    const providerResult = await this.resolveBootstrapProvider(providerId, providerDisplayName);
    if (!providerResult.ok) {
      return providerResult;
    }
    const provider = providerResult.value;

    const credentialPolicy = await this.resolveCredentialPolicy(credentialPolicyId);

    const now = this.dependencies.clock.now();
    const nowIso = now.toISOString();
    const userIdentityId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.userIdentity);
    const credentialMaterialId = this.dependencies.idGenerator.nextId(IdentityIdNamespaces.credentialMaterial);
    const providerSubject = normalizedProviderReference.value.providerSubject;

    const userIdentity = createUserIdentity({
      id: userIdentityId,
      username: normalizedProfile.value.username,
      email: normalizedProfile.value.email,
      displayName: normalizedProfile.value.displayName,
      status: UserIdentityStatuses.active,
      linkedProviders: [{
        providerId: provider.id,
        providerSubject,
        isPrimary: true,
        linkedAt: now,
        credentialState: createLocalCredentialState({
          policy: credentialPolicy,
          passwordChangedAt: now,
        }),
      }],
      now,
    });

    await this.dependencies.persistenceRepository.saveUserIdentity(userIdentity);
    await this.dependencies.credentialMaterialRepository.saveCredentialMaterial({
      id: credentialMaterialId,
      userIdentityId,
      providerId: provider.id,
      providerSubject,
      hashAlgorithm,
      hashValue,
      salt,
      pepperVersion,
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return identitySuccess(Object.freeze({
      userIdentityId,
      providerId: provider.id,
      providerSubject,
      credentialPolicyId: credentialPolicy.id,
      credentialMaterialId,
      bootstrappedAt: nowIso,
    }));
  }

  private async resolveBootstrapProvider(
    providerId: string,
    providerDisplayName: string,
  ): Promise<IdentityOperationResult<AuthProvider, IdentityBootstrapErrorCode>> {
    const existingProvider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (existingProvider) {
      if (
        existingProvider.kind !== AuthProviderKinds.localPassword
        || existingProvider.category !== AuthProviderCategories.local
      ) {
        return this.failure(
          IdentityErrorCodes.unsupportedProvider,
          `Bootstrap provider '${providerId}' is not a local password provider.`,
        );
      }
      if (existingProvider.status !== AuthProviderStatuses.active) {
        return this.failure(
          IdentityErrorCodes.invalidState,
          `Bootstrap provider '${providerId}' must be active.`,
        );
      }
      return identitySuccess(existingProvider);
    }

    const provider = await this.dependencies.persistenceRepository.saveAuthProvider(createAuthProvider({
      id: providerId,
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: providerDisplayName,
      isFirstParty: true,
      status: AuthProviderStatuses.active,
      now: this.dependencies.clock.now(),
    }));

    return identitySuccess(provider);
  }

  private async resolveCredentialPolicy(policyId: string) {
    const existingPolicy = await this.dependencies.lookupRepository.findCredentialPolicyById(policyId);
    if (existingPolicy) {
      return existingPolicy;
    }

    return this.dependencies.persistenceRepository.saveCredentialPolicy(createCredentialPolicy({
      id: policyId,
    }));
  }

  private withIssueDetails(prefix: string, issues: ReadonlyArray<string>): string {
    if (issues.length === 0) {
      return prefix;
    }
    return `${prefix} ${issues.join(" ")}`;
  }

  private requireNonEmpty(
    value: string,
    field: string,
    code: typeof IdentityErrorCodes.invalidRequest | typeof IdentityErrorCodes.invalidCredentials = IdentityErrorCodes.invalidRequest,
  ): IdentityOperationResult<string, IdentityBootstrapErrorCode> {
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

  private failure<TValue, TCode extends IdentityBootstrapErrorCode>(
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

import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  UserIdentityStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
  createUserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityIdNamespaces,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import { IdentityPolicyService } from "./IdentityPolicyService";

export const IdentityBootstrapErrorCodes = Object.freeze({
  blocked: "identity-bootstrap-blocked",
  invalidRequest: "identity-bootstrap-invalid-request",
  invalidState: "identity-bootstrap-invalid-state",
});

export type IdentityBootstrapErrorCode =
  typeof IdentityBootstrapErrorCodes[keyof typeof IdentityBootstrapErrorCodes];

export class IdentityBootstrapError extends Error {
  public readonly code: IdentityBootstrapErrorCode;

  constructor(code: IdentityBootstrapErrorCode, message: string) {
    super(message);
    this.name = "IdentityBootstrapError";
    this.code = code;
  }
}

export class IdentityBootstrapBlockedError extends IdentityBootstrapError {
  constructor(message = "Identity bootstrap is blocked because identity state already exists.") {
    super(IdentityBootstrapErrorCodes.blocked, message);
    this.name = "IdentityBootstrapBlockedError";
  }
}

export class IdentityBootstrapInvalidRequestError extends IdentityBootstrapError {
  constructor(message: string) {
    super(IdentityBootstrapErrorCodes.invalidRequest, message);
    this.name = "IdentityBootstrapInvalidRequestError";
  }
}

export class IdentityBootstrapInvalidStateError extends IdentityBootstrapError {
  constructor(message: string) {
    super(IdentityBootstrapErrorCodes.invalidState, message);
    this.name = "IdentityBootstrapInvalidStateError";
  }
}

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

  public async bootstrapFirstLocalAdmin(input: BootstrapLocalAdminInput): Promise<IdentityBootstrapResult> {
    const status = await this.getBootstrapStatus();
    if (!status.canBootstrap) {
      throw new IdentityBootstrapBlockedError();
    }

    const providerId = this.requireNonEmpty(
      input.providerId ?? IdentityBootstrapDefaults.localProviderId,
      "providerId",
    );
    const providerDisplayName = this.requireNonEmpty(
      input.providerDisplayName ?? IdentityBootstrapDefaults.localProviderDisplayName,
      "providerDisplayName",
    );
    const credentialPolicyId = this.requireNonEmpty(
      input.credentialPolicyId ?? IdentityBootstrapDefaults.localCredentialPolicyId,
      "credentialPolicyId",
    );

    const normalizedProfile = this.dependencies.identityPolicyService.normalizeRegistrationInput({
      username: input.username,
      email: input.email,
      displayName: input.displayName,
    });
    if (!normalizedProfile.valid || !normalizedProfile.value) {
      throw new IdentityBootstrapInvalidRequestError(
        this.withIssueDetails("Bootstrap profile is invalid.", normalizedProfile.issues.map((issue) => issue.message)),
      );
    }

    const normalizedProviderReference = this.dependencies.identityPolicyService.normalizeProviderReference({
      providerId,
      providerSubject: input.providerSubject ?? normalizedProfile.value.username,
      providerKind: AuthProviderKinds.localPassword,
    });
    if (!normalizedProviderReference.valid || !normalizedProviderReference.value) {
      throw new IdentityBootstrapInvalidRequestError(
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
    if (!uniqueness.valid) {
      throw new IdentityBootstrapInvalidRequestError(
        this.withIssueDetails("Bootstrap account uniqueness check failed.", uniqueness.issues.map((issue) => issue.message)),
      );
    }
    if (!uniqueness.available) {
      throw new IdentityBootstrapBlockedError("Identity bootstrap is blocked because identity uniqueness conflicts already exist.");
    }

    const hashAlgorithm = this.requireNonEmpty(input.credential.hashAlgorithm, "credential.hashAlgorithm");
    const hashValue = this.requireNonEmpty(input.credential.hashValue, "credential.hashValue");
    const salt = this.normalizeOptional(input.credential.salt);
    const pepperVersion = this.normalizeOptional(input.credential.pepperVersion);

    const provider = await this.resolveBootstrapProvider(providerId, providerDisplayName);
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

    return Object.freeze({
      userIdentityId,
      providerId: provider.id,
      providerSubject,
      credentialPolicyId: credentialPolicy.id,
      credentialMaterialId,
      bootstrappedAt: nowIso,
    });
  }

  private async resolveBootstrapProvider(providerId: string, providerDisplayName: string) {
    const existingProvider = await this.dependencies.lookupRepository.findAuthProviderById(providerId);
    if (existingProvider) {
      if (
        existingProvider.kind !== AuthProviderKinds.localPassword
        || existingProvider.category !== AuthProviderCategories.local
      ) {
        throw new IdentityBootstrapInvalidStateError(
          `Bootstrap provider '${providerId}' is not a local password provider.`,
        );
      }
      if (existingProvider.status !== AuthProviderStatuses.active) {
        throw new IdentityBootstrapInvalidStateError(
          `Bootstrap provider '${providerId}' must be active.`,
        );
      }
      return existingProvider;
    }

    return this.dependencies.persistenceRepository.saveAuthProvider(createAuthProvider({
      id: providerId,
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: providerDisplayName,
      isFirstParty: true,
      status: AuthProviderStatuses.active,
      now: this.dependencies.clock.now(),
    }));
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

  private requireNonEmpty(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new IdentityBootstrapInvalidRequestError(`${field} is required.`);
    }
    return normalized;
  }

  private normalizeOptional(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}

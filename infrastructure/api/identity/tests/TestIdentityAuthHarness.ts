import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  createAuthProvider,
  createCredentialPolicy,
  type AuthProvider,
  type CredentialPolicy,
  type UserIdentity,
} from "../../../../src/domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorCodes,
  IdentityPrincipalLookupKinds,
  identityFailure,
  identitySuccess,
  type IdentityCredentialHistoryQuery,
  type IdentityCredentialMaterialRecord,
  type IdentityIdNamespace,
  type IdentityMutationOutcome,
  type IdentityOperationResult,
  type IdentityPrincipalLookup,
  type IdentityProviderSubjectReference,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../../../application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import type {
  ILocalPasswordCredentialService,
  LocalPasswordCredentialMaterial,
} from "../../../../application/identity/ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../../../../application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentityAuthBackendApi } from "../IdentityAuthBackendApi";
import { RegisterLocalAccountUseCase } from "../../../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "../../../../src/application/identity/use-cases/LoginLocalAccountUseCase";

class InMemoryIdentityAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentityClock,
    IIdentityIdGenerator {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private idCounter = 0;

  public now(): Date {
    return new Date("2026-04-04T18:00:00.000Z");
  }

  public nextId(namespace: IdentityIdNamespace): string {
    this.idCounter += 1;
    return `${namespace}:${this.idCounter}`;
  }

  public async countUserIdentities(): Promise<number> {
    return this.users.size;
  }

  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    return this.users.get(userIdentityId.trim());
  }

  public async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    const normalized = lookup.value.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (lookup.kind === IdentityPrincipalLookupKinds.username && user.username === normalized) {
        return user;
      }
      if (lookup.kind === IdentityPrincipalLookupKinds.email && user.email === normalized) {
        return user;
      }
    }
    return undefined;
  }

  public async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference): Promise<UserIdentity | undefined> {
    const providerId = reference.providerId.trim();
    const providerSubject = reference.providerSubject.trim();
    for (const user of this.users.values()) {
      const matches = user.linkedProviders.some((entry) => (
        entry.providerId === providerId && entry.providerSubject === providerSubject
      ));
      if (matches) {
        return user;
      }
    }
    return undefined;
  }

  public async findAuthProviderById(providerId: string): Promise<AuthProvider | undefined> {
    return this.providers.get(providerId.trim());
  }

  public async findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined> {
    return this.policies.get(policyId.trim());
  }

  public async saveUserIdentity(identity: UserIdentity): Promise<UserIdentity> {
    this.users.set(identity.id, identity);
    return identity;
  }

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.policies.set(policy.id, policy);
    return policy;
  }

  public async getActiveCredentialMaterial(
    reference: IdentityProviderSubjectReference,
  ): Promise<IdentityCredentialMaterialRecord | undefined> {
    for (const record of this.credentialMaterial.values()) {
      if (
        record.providerId === reference.providerId
        && record.providerSubject === reference.providerSubject
        && record.status === IdentityCredentialMaterialStatuses.active
      ) {
        return record;
      }
    }
    return undefined;
  }

  public async listCredentialMaterialHistory(
    query: IdentityCredentialHistoryQuery,
  ): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>> {
    const filtered = [...this.credentialMaterial.values()].filter((record) => (
      record.providerId === query.reference.providerId && record.providerSubject === query.reference.providerSubject
    ));
    return Object.freeze(filtered);
  }

  public async saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord> {
    this.credentialMaterial.set(record.id, record);
    return record;
  }

  public async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidRequest>> {
    const record = this.credentialMaterial.get(recordId.trim());
    if (!record) {
      return identityFailure({
        code: IdentityErrorCodes.invalidRequest,
        message: "Credential material record was not found.",
        boundary: "infrastructure",
        retryable: false,
      });
    }

    this.credentialMaterial.set(record.id, {
      ...record,
      status: IdentityCredentialMaterialStatuses.superseded,
      supersededAt,
      updatedAt: supersededAt,
    });

    return identitySuccess(Object.freeze({ changed: true }));
  }
}

class StubPasswordCredentialService implements ILocalPasswordCredentialService {
  public normalizePassword(candidate: string): string {
    return candidate.normalize("NFKC");
  }

  public async hashPassword(candidate: string): Promise<LocalPasswordCredentialMaterial> {
    return Object.freeze({
      hashAlgorithm: "stub-password",
      hashValue: `hashed:${candidate}`,
    });
  }

  public async verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    return material.hashValue === `hashed:${candidate}`;
  }
}

export interface IdentityAuthTestHarness {
  readonly backendApi: IdentityAuthBackendApi;
  readonly adapter: InMemoryIdentityAdapter;
}

export async function createIdentityAuthTestHarness(): Promise<IdentityAuthTestHarness> {
  const adapter = new InMemoryIdentityAdapter();

  await adapter.saveAuthProvider(createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
    status: AuthProviderStatuses.active,
  }));
  await adapter.saveCredentialPolicy(createCredentialPolicy({
    id: "policy:local-password",
  }));

  const identityPolicyService = new IdentityPolicyService(adapter);
  const credentialAuthenticator = new LocalPasswordIdentityAuthenticator(new StubPasswordCredentialService());

  const backendApi = new IdentityAuthBackendApi({
    registerLocalAccountUseCase: new RegisterLocalAccountUseCase({
      lookupRepository: adapter,
      persistenceRepository: adapter,
      credentialMaterialRepository: adapter,
      identityPolicyService,
      credentialAuthenticator,
      idGenerator: adapter,
      clock: adapter,
    }),
    loginLocalAccountUseCase: new LoginLocalAccountUseCase({
      lookupRepository: adapter,
      credentialMaterialRepository: adapter,
      identityPolicyService,
      credentialAuthenticator,
      clock: adapter,
    }),
  });

  return Object.freeze({ backendApi, adapter });
}

export { InMemoryIdentityAdapter };

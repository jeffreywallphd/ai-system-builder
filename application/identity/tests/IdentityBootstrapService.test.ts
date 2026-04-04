import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  createAuthProvider,
  createCredentialPolicy,
  createUserIdentity,
  type AuthProvider,
  type CredentialPolicy,
  type UserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import type {
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityIdNamespace,
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityCredentialMaterialStatuses, IdentityPrincipalLookupKinds } from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import { IdentityBootstrapBlockedError, IdentityBootstrapInvalidRequestError, IdentityBootstrapInvalidStateError, IdentityBootstrapService } from "../services/IdentityBootstrapService";
import { IdentityPolicyService } from "../services/IdentityPolicyService";

class InMemoryIdentityBootstrapAdapter
  implements IIdentityLookupRepository, IIdentityPersistenceRepository, ICredentialMaterialRepository, IIdentityClock, IIdentityIdGenerator {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private sequence = 0;

  public now(): Date {
    return new Date("2026-04-04T12:00:00.000Z");
  }

  public nextId(namespace: IdentityIdNamespace): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }

  public async countUserIdentities(): Promise<number> {
    return this.users.size;
  }

  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    return this.users.get(userIdentityId.trim());
  }

  public async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    const normalizedValue = lookup.value.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (lookup.kind === IdentityPrincipalLookupKinds.username && user.username === normalizedValue) {
        return user;
      }
      if (lookup.kind === IdentityPrincipalLookupKinds.email && user.email === normalizedValue) {
        return user;
      }
    }
    return undefined;
  }

  public async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference): Promise<UserIdentity | undefined> {
    for (const user of this.users.values()) {
      const link = user.linkedProviders.find((entry) => (
        entry.providerId === reference.providerId && entry.providerSubject === reference.providerSubject
      ));
      if (link) {
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
    return [...this.credentialMaterial.values()]
      .filter((record) => (
        record.providerId === query.reference.providerId
        && record.providerSubject === query.reference.providerSubject
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord> {
    this.credentialMaterial.set(record.id, record);
    return record;
  }

  public async markCredentialMaterialSuperseded(recordId: string, supersededAt: string): Promise<boolean> {
    const record = this.credentialMaterial.get(recordId.trim());
    if (!record) {
      return false;
    }

    this.credentialMaterial.set(record.id, {
      ...record,
      status: IdentityCredentialMaterialStatuses.superseded,
      supersededAt,
      updatedAt: supersededAt,
    });
    return true;
  }
}

function createService(adapter: InMemoryIdentityBootstrapAdapter): IdentityBootstrapService {
  return new IdentityBootstrapService({
    lookupRepository: adapter,
    persistenceRepository: adapter,
    credentialMaterialRepository: adapter,
    identityPolicyService: new IdentityPolicyService(adapter),
    clock: adapter,
    idGenerator: adapter,
  });
}

describe("IdentityBootstrapService", () => {
  it("bootstraps the first local admin account when identity state is empty", async () => {
    const adapter = new InMemoryIdentityBootstrapAdapter();
    const service = createService(adapter);

    const result = await service.bootstrapFirstLocalAdmin({
      username: " Admin.User ",
      email: "admin@example.com",
      displayName: "Admin User",
      credential: {
        hashAlgorithm: "argon2id",
        hashValue: "argon2id$v=19$m=65536,t=3,p=4$seed$safehashvalue",
      },
    });

    expect(result.userIdentityId).toBe("user-identity:1");
    expect(result.credentialMaterialId).toBe("credential-material:2");
    expect(result.providerId).toBe("provider:local-password");

    const user = await adapter.findUserIdentityById(result.userIdentityId);
    expect(user?.status).toBe("active");
    expect(user?.username).toBe("admin.user");
    expect(user?.linkedProviders).toHaveLength(1);
    expect(user?.linkedProviders[0]?.providerId).toBe("provider:local-password");

    const credential = await adapter.getActiveCredentialMaterial({
      providerId: result.providerId,
      providerSubject: result.providerSubject,
    });
    expect(credential?.hashAlgorithm).toBe("argon2id");
    expect(credential?.hashValue).toBe("argon2id$v=19$m=65536,t=3,p=4$seed$safehashvalue");

    const status = await service.getBootstrapStatus();
    expect(status.canBootstrap).toBe(false);
    expect(status.userIdentityCount).toBe(1);
  });

  it("blocks bootstrap once any identity already exists", async () => {
    const adapter = new InMemoryIdentityBootstrapAdapter();
    const service = createService(adapter);

    await service.bootstrapFirstLocalAdmin({
      username: "admin",
      credential: {
        hashAlgorithm: "argon2id",
        hashValue: "hash:value:one",
      },
    });

    await expect(service.bootstrapFirstLocalAdmin({
      username: "admin-two",
      credential: {
        hashAlgorithm: "argon2id",
        hashValue: "hash:value:two",
      },
    })).rejects.toBeInstanceOf(IdentityBootstrapBlockedError);
  });

  it("rejects bootstrap requests with missing credential material", async () => {
    const adapter = new InMemoryIdentityBootstrapAdapter();
    const service = createService(adapter);

    await expect(service.bootstrapFirstLocalAdmin({
      username: "admin",
      credential: {
        hashAlgorithm: "   ",
        hashValue: "   ",
      },
    })).rejects.toBeInstanceOf(IdentityBootstrapInvalidRequestError);

    expect(await adapter.countUserIdentities()).toBe(0);
  });

  it("rejects bootstrap when configured provider id is already non-local", async () => {
    const adapter = new InMemoryIdentityBootstrapAdapter();
    await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.oidc,
      category: AuthProviderCategories.external,
      displayName: "Wrong Provider",
    }));
    await adapter.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local-password",
    }));

    const service = createService(adapter);

    await expect(service.bootstrapFirstLocalAdmin({
      username: "admin",
      credential: {
        hashAlgorithm: "argon2id",
        hashValue: "hash:value:one",
      },
    })).rejects.toBeInstanceOf(IdentityBootstrapInvalidStateError);
  });

  it("blocks bootstrap when identity state is pre-seeded", async () => {
    const adapter = new InMemoryIdentityBootstrapAdapter();
    await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    await adapter.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local-password",
    }));
    await adapter.saveUserIdentity(createUserIdentity({
      id: "user:existing",
      username: "existing-admin",
      status: "active",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "existing-admin",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    }));

    const service = createService(adapter);
    await expect(service.bootstrapFirstLocalAdmin({
      username: "new-admin",
      credential: {
        hashAlgorithm: "argon2id",
        hashValue: "hash:value:new",
      },
    })).rejects.toBeInstanceOf(IdentityBootstrapBlockedError);
  });
});

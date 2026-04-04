import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
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
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
} from "../../contracts/IdentityApplicationContracts";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorCodes,
  IdentityPrincipalLookupKinds,
  identityFailure,
  identitySuccess,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import { IdentityPolicyService } from "../services/IdentityPolicyService";
import { RegisterLocalAccountUseCase } from "../../../src/application/identity/use-cases/RegisterLocalAccountUseCase";

class InMemoryIdentityRegistrationAdapter
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

  public async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, "identity-invalid-request">> {
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
    return identitySuccess({ changed: true });
  }
}

function createUseCase(adapter: InMemoryIdentityRegistrationAdapter): RegisterLocalAccountUseCase {
  return new RegisterLocalAccountUseCase({
    lookupRepository: adapter,
    persistenceRepository: adapter,
    credentialMaterialRepository: adapter,
    identityPolicyService: new IdentityPolicyService(adapter),
    idGenerator: adapter,
    clock: adapter,
  });
}

async function seedLocalProviderAndPolicy(adapter: InMemoryIdentityRegistrationAdapter): Promise<void> {
  await adapter.saveAuthProvider(createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
    status: AuthProviderStatuses.active,
  }));
  await adapter.saveCredentialPolicy(createCredentialPolicy({
    id: "policy:local-password",
    minLength: 12,
    blockedSubstrings: ["admin"],
  }));
}

describe("RegisterLocalAccountUseCase", () => {
  it("registers a valid local account and persists identity plus credential material", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await seedLocalProviderAndPolicy(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      username: "  New.User  ",
      email: " NEW.USER@example.com ",
      displayName: " New User ",
      credential: {
        candidate: "Str0ng!Passphrase",
        hashAlgorithm: "argon2id",
        hashValue: "argon2id$v=19$m=65536,t=3,p=4$seed$registeredhash",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected registration success");
    }

    expect(result.value.userIdentityId).toBe("user-identity:1");
    expect(result.value.credentialMaterialId).toBe("credential-material:2");
    expect(result.value.providerId).toBe("provider:local-password");
    expect(result.value.providerSubject).toBe("new.user");

    const user = await adapter.findUserIdentityById(result.value.userIdentityId);
    expect(user?.username).toBe("new.user");
    expect(user?.email).toBe("new.user@example.com");
    expect(user?.displayName).toBe("New User");
    expect(user?.status).toBe("active");

    const credential = await adapter.getActiveCredentialMaterial({
      providerId: result.value.providerId,
      providerSubject: result.value.providerSubject,
    });
    expect(credential?.hashAlgorithm).toBe("argon2id");
    expect(credential?.hashValue).toBe("argon2id$v=19$m=65536,t=3,p=4$seed$registeredhash");
  });

  it("rejects invalid registration profile input with structured policy error", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await seedLocalProviderAndPolicy(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      username: "   ",
      credential: {
        candidate: "Str0ng!Passphrase",
        hashAlgorithm: "argon2id",
        hashValue: "hash",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-policy-violation",
      }),
    });
    expect(await adapter.countUserIdentities()).toBe(0);
  });

  it("rejects duplicate registrations with deterministic duplicate errors", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await seedLocalProviderAndPolicy(adapter);
    const useCase = createUseCase(adapter);

    await adapter.saveUserIdentity(createUserIdentity({
      id: "user:existing",
      username: "existing.user",
      email: "existing@example.com",
      status: "active",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "existing.user",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    }));

    const duplicate = await useCase.execute({
      username: " Existing.User ",
      email: "existing@example.com",
      credential: {
        candidate: "Str0ng!Passphrase",
        hashAlgorithm: "argon2id",
        hashValue: "hash",
      },
    });

    expect(duplicate).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-duplicate",
      }),
    });
    expect(await adapter.countUserIdentities()).toBe(1);
  });

  it("rejects credentials that fail policy evaluation", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await seedLocalProviderAndPolicy(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      username: "valid.user",
      credential: {
        candidate: "weak",
        hashAlgorithm: "argon2id",
        hashValue: "hash",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-policy-violation",
      }),
    });
    expect(await adapter.countUserIdentities()).toBe(0);
  });

  it("rejects registration when local provider is misconfigured", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.oidc,
      category: AuthProviderCategories.external,
      displayName: "Wrong Provider",
      status: AuthProviderStatuses.active,
    }));
    await adapter.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local-password",
    }));

    const useCase = createUseCase(adapter);
    const result = await useCase.execute({
      username: "valid.user",
      credential: {
        candidate: "Str0ng!Passphrase",
        hashAlgorithm: "argon2id",
        hashValue: "hash",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-unsupported-provider",
      }),
    });
  });

  it("rejects missing credential hash material with invalid-credentials error", async () => {
    const adapter = new InMemoryIdentityRegistrationAdapter();
    await seedLocalProviderAndPolicy(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      username: "valid.user",
      credential: {
        candidate: "Str0ng!Passphrase",
        hashAlgorithm: "   ",
        hashValue: "   ",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-credentials",
      }),
    });
  });
});

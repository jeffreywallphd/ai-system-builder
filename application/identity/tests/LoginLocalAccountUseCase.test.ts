import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  CredentialStatuses,
  UserIdentityStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
  createUserIdentity,
  disableCredential,
  type AuthProvider,
  type CredentialPolicy,
  type UserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import type {
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
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
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { ILocalPasswordCredentialService, LocalPasswordCredentialMaterial } from "../ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../services/LocalPasswordIdentityAuthenticator";
import { LoginLocalAccountUseCase } from "../../../src/application/identity/use-cases/LoginLocalAccountUseCase";

class InMemoryLoginAdapter implements IIdentityLookupRepository, ICredentialMaterialRepository, IIdentityClock {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();

  public now(): Date {
    return new Date("2026-04-04T13:00:00.000Z");
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
      const hasMatch = user.linkedProviders.some((entry) => (
        entry.providerId === reference.providerId && entry.providerSubject === reference.providerSubject
      ));
      if (hasMatch) {
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
    return [...this.credentialMaterial.values()].filter((record) => (
      record.providerId === query.reference.providerId && record.providerSubject === query.reference.providerSubject
    ));
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
    return identitySuccess({ changed: true });
  }

  public async saveUser(user: UserIdentity): Promise<void> {
    this.users.set(user.id, user);
  }

  public async saveProvider(provider: AuthProvider): Promise<void> {
    this.providers.set(provider.id, provider);
  }
}

class StubLocalPasswordCredentialService implements ILocalPasswordCredentialService {
  public normalizePassword(candidate: string): string {
    return candidate.normalize("NFKC");
  }

  public async hashPassword(_candidate: string): Promise<LocalPasswordCredentialMaterial> {
    return {
      hashAlgorithm: "scrypt",
      hashValue: "unused",
    };
  }

  public async verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    return material.hashValue === `hashed:${candidate}`;
  }
}

function createUseCase(
  adapter: InMemoryLoginAdapter,
  passwordCredentialService: ILocalPasswordCredentialService = new StubLocalPasswordCredentialService(),
): LoginLocalAccountUseCase {
  return new LoginLocalAccountUseCase({
    lookupRepository: adapter,
    credentialMaterialRepository: adapter,
    identityPolicyService: new IdentityPolicyService(adapter),
    credentialAuthenticator: new LocalPasswordIdentityAuthenticator(passwordCredentialService),
    clock: adapter,
  });
}

async function seedActiveLocalIdentity(adapter: InMemoryLoginAdapter): Promise<void> {
  const provider = createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
    status: AuthProviderStatuses.active,
  });
  const policy = createCredentialPolicy({
    id: "policy:local-password",
  });
  const user = createUserIdentity({
    id: "user:1",
    username: "valid.user",
    email: "valid.user@example.com",
    status: UserIdentityStatuses.active,
    linkedProviders: [{
      providerId: provider.id,
      providerSubject: "valid.user",
      isPrimary: true,
      linkedAt: "2026-04-04T12:00:00.000Z",
      credentialState: createLocalCredentialState({
        policy,
        passwordChangedAt: new Date("2026-04-04T12:00:00.000Z"),
      }),
    }],
  });

  await adapter.saveProvider(provider);
  await adapter.saveUser(user);
  await adapter.saveCredentialMaterial({
    id: "credential:1",
    userIdentityId: user.id,
    providerId: provider.id,
    providerSubject: "valid.user",
    hashAlgorithm: "scrypt",
    hashValue: "hashed:Str0ng!Passphrase",
    status: IdentityCredentialMaterialStatuses.active,
    createdAt: "2026-04-04T12:00:00.000Z",
    updatedAt: "2026-04-04T12:00:00.000Z",
  });
}

describe("LoginLocalAccountUseCase", () => {
  it("authenticates an active local identity and returns an authenticated principal payload", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerSubject: " Valid.User ",
      credential: {
        candidate: "Str0ng!Passphrase",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected local login success");
    }

    expect(result.value).toEqual({
      userIdentityId: "user:1",
      username: "valid.user",
      email: "valid.user@example.com",
      displayName: undefined,
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      credentialMaterialId: "credential:1",
      authPath: "password",
      authenticatedAt: "2026-04-04T13:00:00.000Z",
    });
  });

  it("returns not-found when no identity exists for the local provider subject", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerSubject: "missing.user",
      credential: {
        candidate: "Str0ng!Passphrase",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-not-found",
      }),
    });
  });

  it("returns invalid-credentials when the candidate does not match active credential material", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerSubject: "valid.user",
      credential: {
        candidate: "wrong-password",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-credentials",
      }),
    });
  });

  it("returns inactive-account when the identity is not active", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    const existing = await adapter.findUserIdentityById("user:1");
    if (!existing) {
      throw new Error("missing seeded identity");
    }

    await adapter.saveUser({
      ...existing,
      status: UserIdentityStatuses.suspended,
    });

    const useCase = createUseCase(adapter);
    const result = await useCase.execute({
      providerSubject: "valid.user",
      credential: {
        candidate: "Str0ng!Passphrase",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-inactive-account",
      }),
    });
  });

  it("returns inactive-account when the provider credential state is disabled", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    const existing = await adapter.findUserIdentityById("user:1");
    if (!existing) {
      throw new Error("missing seeded identity");
    }

    const disabledCredentialState = disableCredential(
      existing.linkedProviders[0].credentialState ?? {
        status: CredentialStatuses.active,
        policyId: "policy:local-password",
        failedAttempts: 0,
      },
      new Date("2026-04-04T12:30:00.000Z"),
    );
    await adapter.saveUser({
      ...existing,
      linkedProviders: [{
        ...existing.linkedProviders[0],
        credentialState: disabledCredentialState,
      }],
    });

    const useCase = createUseCase(adapter);
    const result = await useCase.execute({
      providerSubject: "valid.user",
      credential: {
        candidate: "Str0ng!Passphrase",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-inactive-account",
      }),
    });
  });

  it("returns unsupported-provider when the selected auth path is not local-password", async () => {
    const adapter = new InMemoryLoginAdapter();
    await seedActiveLocalIdentity(adapter);
    await adapter.saveProvider(createAuthProvider({
      id: "provider:oidc",
      kind: AuthProviderKinds.oidc,
      category: AuthProviderCategories.external,
      displayName: "External OIDC",
      status: AuthProviderStatuses.active,
    }));
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerId: "provider:oidc",
      providerSubject: "valid.user",
      credential: {
        candidate: "Str0ng!Passphrase",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-unsupported-provider",
      }),
    });
  });
});

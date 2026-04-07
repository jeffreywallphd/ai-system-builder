import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
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
  IdentityUserIdentityListQuery,
} from "../../contracts/IdentityApplicationContracts";
import {
  IdentityLifecycleEventTypes,
  type IdentityLifecycleEvent,
  IdentityCredentialMaterialStatuses,
  IdentityErrorCodes,
  IdentityPrincipalLookupKinds,
  identityFailure,
  identitySuccess,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityCredentialResetVerifier } from "../ports/IIdentityCredentialResetVerifier";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLifecycleEventPublisher } from "../ports/IIdentityLifecycleEventPublisher";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import type { ILocalPasswordCredentialService, LocalPasswordCredentialMaterial } from "../ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../../../src/application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../../../src/application/identity/services/LocalPasswordIdentityAuthenticator";
import { ChangeLocalPasswordCredentialUseCase } from "../../../src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase";
import type { IPlatformTransactionManager } from "../../../src/application/common/ports/PlatformTransactionPorts";

interface IdentityCredentialChangeAdapterSnapshot {
  readonly users: Map<string, UserIdentity>;
  readonly credentialMaterial: Map<string, IdentityCredentialMaterialRecord>;
}

class InMemoryCredentialChangeAdapter
  implements IIdentityLookupRepository, IIdentityPersistenceRepository, ICredentialMaterialRepository, IIdentityClock, IIdentityIdGenerator {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private sequence = 0;
  public failCredentialSave = false;

  public now(): Date {
    return new Date("2026-04-04T14:00:00.000Z");
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

  public async listUserIdentities(_query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>> {
    return Object.freeze([...this.users.values()]);
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
        && ((query.includeInactive ?? false) || record.status === IdentityCredentialMaterialStatuses.active)
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public async saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord> {
    if (this.failCredentialSave) {
      throw new Error("credential persistence failure");
    }
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

  public createSnapshot(): IdentityCredentialChangeAdapterSnapshot {
    return Object.freeze({
      users: new Map(this.users),
      credentialMaterial: new Map(this.credentialMaterial),
    });
  }

  public restoreSnapshot(snapshot: IdentityCredentialChangeAdapterSnapshot): void {
    this.users.clear();
    this.credentialMaterial.clear();
    for (const [key, value] of snapshot.users.entries()) {
      this.users.set(key, value);
    }
    for (const [key, value] of snapshot.credentialMaterial.entries()) {
      this.credentialMaterial.set(key, value);
    }
  }
}

class InMemoryCredentialChangeTransactionManager implements IPlatformTransactionManager {
  public callCount = 0;

  public constructor(private readonly adapter: InMemoryCredentialChangeAdapter) {}

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    this.callCount += 1;
    const snapshot = this.adapter.createSnapshot();
    try {
      return await operation();
    } catch (error) {
      this.adapter.restoreSnapshot(snapshot);
      throw error;
    }
  }
}

class StubLocalPasswordCredentialService implements ILocalPasswordCredentialService {
  public normalizePassword(candidate: string): string {
    return candidate.normalize("NFKC");
  }

  public async hashPassword(candidate: string): Promise<LocalPasswordCredentialMaterial> {
    return {
      hashAlgorithm: "scrypt",
      hashValue: `hashed:${candidate}`,
      salt: `salt:${candidate.length}`,
    };
  }

  public async verifyPassword(candidate: string, material: LocalPasswordCredentialMaterial): Promise<boolean> {
    return material.hashValue === `hashed:${candidate}`;
  }
}

class StubCredentialResetVerifier implements IIdentityCredentialResetVerifier {
  public async verifyResetAssertion(): Promise<IdentityOperationResult<{ verificationId: string; verifiedAt: string }, "identity-invalid-request">> {
    return identitySuccess({
      verificationId: "reset-verification:1",
      verifiedAt: "2026-04-04T14:00:00.000Z",
    });
  }
}

function createUseCase(
  adapter: InMemoryCredentialChangeAdapter,
  resetVerifier?: IIdentityCredentialResetVerifier,
  eventPublisher?: IIdentityLifecycleEventPublisher,
  transactionManager?: IPlatformTransactionManager,
): ChangeLocalPasswordCredentialUseCase {
  return new ChangeLocalPasswordCredentialUseCase({
    lookupRepository: adapter,
    persistenceRepository: adapter,
    credentialMaterialRepository: adapter,
    transactionManager,
    identityPolicyService: new IdentityPolicyService(adapter),
    credentialAuthenticator: new LocalPasswordIdentityAuthenticator(new StubLocalPasswordCredentialService()),
    idGenerator: adapter,
    clock: adapter,
    credentialResetVerifier: resetVerifier,
    eventPublisher,
  });
}

async function seedIdentity(
  adapter: InMemoryCredentialChangeAdapter,
  policyOverrides?: Partial<CredentialPolicy>,
  passwordChangedAt: Date = new Date("2026-04-01T14:00:00.000Z"),
): Promise<void> {
  await adapter.saveAuthProvider(createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
    status: AuthProviderStatuses.active,
  }));

  const policy = createCredentialPolicy({
    id: "policy:local-password",
    minLength: 12,
    passwordHistoryCount: 3,
    ...policyOverrides,
  });
  await adapter.saveCredentialPolicy(policy);

  const user = createUserIdentity({
    id: "user:1",
    username: "valid.user",
    email: "valid.user@example.com",
    status: "active",
    linkedProviders: [{
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      isPrimary: true,
      linkedAt: "2026-04-01T14:00:00.000Z",
      credentialState: createLocalCredentialState({
        policy,
        passwordChangedAt,
      }),
    }],
  });
  await adapter.saveUserIdentity(user);
  await adapter.saveCredentialMaterial({
    id: "credential:active",
    userIdentityId: "user:1",
    providerId: "provider:local-password",
    providerSubject: "valid.user",
    hashAlgorithm: "scrypt",
    hashValue: "hashed:Current!Pass123",
    salt: "salt:16",
    status: IdentityCredentialMaterialStatuses.active,
    createdAt: "2026-04-01T14:00:00.000Z",
    updatedAt: "2026-04-01T14:00:00.000Z",
  });
}

describe("ChangeLocalPasswordCredentialUseCase", () => {
  it("changes credential with old-credential verification and rotates active credential material", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const events: IdentityLifecycleEvent[] = [];
    const useCase = createUseCase(adapter, undefined, {
      publish: async (event) => {
        events.push(event);
      },
    });

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected credential change success");
    }

    expect(result.value.verificationMode).toBe("current-credential");
    expect(result.value.supersededCredentialMaterialId).toBe("credential:active");

    const activeMaterial = await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "valid.user",
    });
    expect(activeMaterial?.id).toBe("credential-material:1");
    expect(activeMaterial?.hashValue).toBe("hashed:N3w!CredentialValue");

    const history = await adapter.listCredentialMaterialHistory({
      reference: {
        providerId: "provider:local-password",
        providerSubject: "valid.user",
      },
      includeInactive: true,
    });
    expect(history).toHaveLength(2);
    expect(history[0]?.status).toBe("superseded");
    expect(history[1]?.status).toBe("active");

    const updatedUser = await adapter.findUserIdentityById("user:1");
    const providerLink = updatedUser?.linkedProviders[0];
    expect(providerLink?.credentialState?.status).toBe("active");
    expect(providerLink?.credentialState?.passwordChangedAt).toBe("2026-04-04T14:00:00.000Z");
    expect(providerLink?.credentialState?.failedAttempts).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      eventType: IdentityLifecycleEventTypes.localCredentialChanged,
      payload: expect.objectContaining({
        userIdentityId: "user:1",
        providerId: "provider:local-password",
        providerSubject: "valid.user",
      }),
    }));
  });

  it("rejects credential changes when old credential verification fails", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        currentCredential: "wrong-current",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-credentials",
      }),
    });
    expect((await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "valid.user",
    }))?.id).toBe("credential:active");
  });

  it("rejects replacement credentials that fail policy validation", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "weak",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-policy-violation",
      }),
    });
  });

  it("rejects reset-assertion mode when no reset verifier is configured", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        mode: "reset-assertion",
        resetAssertion: "reset-token:v1",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-request",
      }),
    });
  });

  it("supports reset-assertion verification through the reset verifier seam", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const useCase = createUseCase(adapter, new StubCredentialResetVerifier());

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        mode: "reset-assertion",
        resetAssertion: "reset-token:v1",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected reset assertion credential change success");
    }

    expect(result.value.verificationMode).toBe("reset-assertion");
    expect((await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "valid.user",
    }))?.hashValue).toBe("hashed:N3w!CredentialValue");
  });

  it("enforces policy min-password-age and recent history reuse checks", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(
      adapter,
      {
        minPasswordAgeDays: 3,
        passwordHistoryCount: 3,
      },
      new Date("2026-04-03T22:00:00.000Z"),
    );
    await adapter.saveCredentialMaterial({
      id: "credential:old:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      hashAlgorithm: "scrypt",
      hashValue: "hashed:Reuse!Pass123",
      status: IdentityCredentialMaterialStatuses.superseded,
      createdAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:00:00.000Z",
      supersededAt: "2026-04-01T14:00:00.000Z",
    });
    const useCase = createUseCase(adapter);

    const minAgeViolation = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    });
    expect(minAgeViolation).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-policy-violation",
      }),
    });

    const user = await adapter.findUserIdentityById("user:1");
    if (!user) {
      throw new Error("missing seeded identity");
    }
    await adapter.saveUserIdentity({
      ...user,
      linkedProviders: [{
        ...user.linkedProviders[0],
        credentialState: {
          ...user.linkedProviders[0].credentialState!,
          passwordChangedAt: "2026-03-20T12:00:00.000Z",
        },
      }],
    });

    const historyViolation = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "Reuse!Pass123",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    });
    expect(historyViolation).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-policy-violation",
      }),
    });
  });

  it("routes credential rotation writes through the configured transaction manager", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    const transactionManager = new InMemoryCredentialChangeTransactionManager(adapter);
    const useCase = createUseCase(adapter, undefined, undefined, transactionManager);

    const result = await useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    });

    expect(result.ok).toBeTrue();
    expect(transactionManager.callCount).toBe(1);
  });

  it("rolls back credential supersede when persistence fails inside the transaction boundary", async () => {
    const adapter = new InMemoryCredentialChangeAdapter();
    await seedIdentity(adapter);
    adapter.failCredentialSave = true;
    const transactionManager = new InMemoryCredentialChangeTransactionManager(adapter);
    const useCase = createUseCase(adapter, undefined, undefined, transactionManager);

    await expect(useCase.execute({
      userIdentityId: "user:1",
      newCredential: {
        candidate: "N3w!CredentialValue",
      },
      verification: {
        currentCredential: "Current!Pass123",
      },
    })).rejects.toThrow("credential persistence failure");

    expect(transactionManager.callCount).toBe(1);
    const activeMaterial = await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "valid.user",
    });
    expect(activeMaterial?.id).toBe("credential:active");
    const history = await adapter.listCredentialMaterialHistory({
      reference: {
        providerId: "provider:local-password",
        providerSubject: "valid.user",
      },
      includeInactive: true,
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("active");
  });
});

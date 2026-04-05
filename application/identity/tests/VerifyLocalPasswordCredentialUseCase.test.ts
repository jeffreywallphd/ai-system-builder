import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  AuthProviderStatuses,
  createAuthProvider,
  type AuthProvider,
} from "../../../src/domain/identity/IdentityDomain";
import type {
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
  IdentityUserIdentityListQuery,
} from "../../contracts/IdentityApplicationContracts";
import {
  IdentityCredentialMaterialStatuses,
  IdentityErrorCodes,
  identityFailure,
  identitySuccess,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { ILocalPasswordCredentialService, LocalPasswordCredentialMaterial } from "../ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../services/LocalPasswordIdentityAuthenticator";
import { VerifyLocalPasswordCredentialUseCase } from "../../../src/application/identity/use-cases/VerifyLocalPasswordCredentialUseCase";

class InMemoryCredentialAdapter implements ICredentialMaterialRepository, IIdentityLookupRepository {
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private readonly providers = new Map<string, AuthProvider>();

  public async countUserIdentities(): Promise<number> {
    return 0;
  }

  public async findUserIdentityById(_userIdentityId: string): Promise<undefined> {
    return undefined;
  }

  public async listUserIdentities(_query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<never>> {
    return Object.freeze([]);
  }

  public async findUserIdentityByPrincipal(_lookup: IdentityPrincipalLookup): Promise<undefined> {
    return undefined;
  }

  public async findUserIdentityByProviderSubject(_reference: IdentityProviderSubjectReference): Promise<undefined> {
    return undefined;
  }

  public async findAuthProviderById(providerId: string): Promise<AuthProvider | undefined> {
    return this.providers.get(providerId.trim());
  }

  public async findCredentialPolicyById(_policyId: string): Promise<undefined> {
    return undefined;
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

  public async saveProvider(provider: AuthProvider): Promise<void> {
    this.providers.set(provider.id, provider);
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
  adapter: InMemoryCredentialAdapter,
  passwordCredentialService: ILocalPasswordCredentialService = new StubLocalPasswordCredentialService(),
): VerifyLocalPasswordCredentialUseCase {
  return new VerifyLocalPasswordCredentialUseCase({
    lookupRepository: adapter,
    credentialMaterialRepository: adapter,
    identityPolicyService: new IdentityPolicyService(adapter),
    credentialAuthenticator: new LocalPasswordIdentityAuthenticator(passwordCredentialService),
  });
}

describe("VerifyLocalPasswordCredentialUseCase", () => {
  it("verifies a valid local password credential against active material", async () => {
    const adapter = new InMemoryCredentialAdapter();
    await adapter.saveProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
      status: AuthProviderStatuses.active,
    }));
    await adapter.saveCredentialMaterial({
      id: "credential:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      hashAlgorithm: "scrypt",
      hashValue: "hashed:Str0ng!Passphrase",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerId: "provider:local-password",
      providerSubject: " Valid.User ",
      candidate: "Str0ng!Passphrase",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected verification success");
    }

    expect(result.value.userIdentityId).toBe("user:1");
    expect(result.value.credentialMaterialId).toBe("credential:1");
    expect(result.value.providerSubject).toBe("valid.user");
  });

  it("returns invalid-credentials for wrong password candidate", async () => {
    const adapter = new InMemoryCredentialAdapter();
    await adapter.saveProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
      status: AuthProviderStatuses.active,
    }));
    await adapter.saveCredentialMaterial({
      id: "credential:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      hashAlgorithm: "scrypt",
      hashValue: "hashed:Str0ng!Passphrase",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });
    const useCase = createUseCase(adapter);

    const result = await useCase.execute({
      providerId: "provider:local-password",
      providerSubject: "valid.user",
      candidate: "wrong-password",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "identity-invalid-credentials",
      }),
    });
  });
});

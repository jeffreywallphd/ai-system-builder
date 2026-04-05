import {
  Session,
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
  type IdentitySessionListQuery,
  type IdentitySessionTokenMaterialRecord,
  type IdentityUserIdentityListQuery,
} from "../../../../application/contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../../../../application/identity/ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../../../../application/identity/ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../../../../application/identity/ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../../../../application/identity/ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../../../../application/identity/ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../../../../application/identity/ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../../../../application/identity/ports/IIdentitySessionTokenMaterialRepository";
import type { IIdentitySessionTokenService } from "../../../../application/identity/ports/IIdentitySessionTokenService";
import type {
  ILocalPasswordCredentialService,
  LocalPasswordCredentialMaterial,
} from "../../../../application/identity/ports/ILocalPasswordCredentialService";
import { IdentityPolicyService } from "../../../../application/identity/services/IdentityPolicyService";
import { LocalPasswordIdentityAuthenticator } from "../../../../application/identity/services/LocalPasswordIdentityAuthenticator";
import { IdentitySessionLifecycleService } from "../../../../application/identity/services/IdentitySessionLifecycleService";
import { IdentityAuthenticatedSessionService } from "../../../../application/identity/services/IdentityAuthenticatedSessionService";
import { IdentityAuthBackendApi } from "../IdentityAuthBackendApi";
import { RegisterLocalAccountUseCase } from "../../../../src/application/identity/use-cases/RegisterLocalAccountUseCase";
import { LoginLocalAccountUseCase } from "../../../../src/application/identity/use-cases/LoginLocalAccountUseCase";
import { LogoutIdentitySessionUseCase } from "../../../../src/application/identity/use-cases/LogoutIdentitySessionUseCase";
import { RevokeIdentitySessionUseCase } from "../../../../src/application/identity/use-cases/RevokeIdentitySessionUseCase";
import { ListLocalIdentityAccountsUseCase } from "../../../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import { GetLocalIdentityAccountStatusUseCase } from "../../../../src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import { SetLocalIdentityAccountStatusUseCase } from "../../../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";
import type { IdentityAuthObservabilityOptions } from "../IdentityAuthObservability";

class InMemoryIdentityAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    IIdentitySessionTokenMaterialRepository,
    IIdentityClock,
    IIdentityIdGenerator,
    IIdentitySessionTokenService {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private readonly sessions = new Map<string, Session>();
  private readonly sessionTokenMaterialBySessionId = new Map<string, IdentitySessionTokenMaterialRecord>();
  private readonly sessionTokenMaterialByHash = new Map<string, IdentitySessionTokenMaterialRecord>();
  private idCounter = 0;
  private tokenCounter = 0;
  private current = new Date("2026-04-04T18:00:00.000Z");

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(value: string): void {
    this.current = new Date(value);
  }

  public nextId(namespace: IdentityIdNamespace): string {
    this.idCounter += 1;
    return `${namespace}:${this.idCounter}`;
  }

  public issueToken(): ReturnType<IIdentitySessionTokenService["issueToken"]> {
    this.tokenCounter += 1;
    const token = `session-token-${this.tokenCounter}`;
    return Object.freeze({
      token,
      tokenHash: this.hashToken(token),
      hashAlgorithm: "sha256" as const,
      tokenType: "opaque-bearer" as const,
    });
  }

  public hashToken(token: string): string {
    return `hash:${token.trim()}`;
  }

  public async countUserIdentities(): Promise<number> {
    return this.users.size;
  }

  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    return this.users.get(userIdentityId.trim());
  }

  public async listUserIdentities(query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>> {
    const filtered = [...this.users.values()]
      .filter((user) => {
        if (!query.providerId) {
          return true;
        }

        return user.linkedProviders.some((link) => (
          !link.unlinkedAt && link.providerId === query.providerId
        ));
      })
      .filter((user) => (
        !query.includeStatuses || query.includeStatuses.length === 0 || query.includeStatuses.includes(user.status)
      ))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = Number.isInteger(query.offset) && (query.offset ?? -1) >= 0 ? (query.offset as number) : 0;
    const limit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0 ? (query.limit as number) : filtered.length;
    return Object.freeze(filtered.slice(offset, offset + limit));
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

  public async saveSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId.trim());
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    return Object.freeze([...this.sessions.values()].filter((session) => session.userIdentityId === query.userIdentityId));
  }

  public async removeSession(
    _sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    return identitySuccess(Object.freeze({ changed: false }));
  }

  public async saveSessionTokenMaterial(
    record: IdentitySessionTokenMaterialRecord,
  ): Promise<IdentitySessionTokenMaterialRecord> {
    this.sessionTokenMaterialBySessionId.set(record.sessionId, record);
    this.sessionTokenMaterialByHash.set(record.tokenHash, record);
    return record;
  }

  public async getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    return this.sessionTokenMaterialBySessionId.get(sessionId.trim());
  }

  public async getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    return this.sessionTokenMaterialByHash.get(tokenHash.trim());
  }

  public async invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const record = this.sessionTokenMaterialBySessionId.get(sessionId.trim());
    if (!record) {
      return undefined;
    }

    const updated = Object.freeze({
      ...record,
      invalidatedAt,
      updatedAt: invalidatedAt,
    });
    this.sessionTokenMaterialBySessionId.set(record.sessionId, updated);
    this.sessionTokenMaterialByHash.set(record.tokenHash, updated);
    return updated;
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

export async function createIdentityAuthTestHarness(
  options: { readonly observability?: IdentityAuthObservabilityOptions } = {},
): Promise<IdentityAuthTestHarness> {
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
  const sessionLifecycleService = new IdentitySessionLifecycleService({
    sessionRepository: adapter,
    clock: adapter,
    idGenerator: adapter,
  });
  const authenticatedSessionService = new IdentityAuthenticatedSessionService({
    lifecycleService: sessionLifecycleService,
    sessionRepository: adapter,
    tokenMaterialRepository: adapter,
    tokenService: adapter,
    clock: adapter,
  });

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
    logoutIdentitySessionUseCase: new LogoutIdentitySessionUseCase({
      authenticatedSessionService,
    }),
    revokeIdentitySessionUseCase: new RevokeIdentitySessionUseCase({
      sessionRepository: adapter,
      authenticatedSessionService,
    }),
    listLocalIdentityAccountsUseCase: new ListLocalIdentityAccountsUseCase({
      lookupRepository: adapter,
      sessionRepository: adapter,
    }),
    getLocalIdentityAccountStatusUseCase: new GetLocalIdentityAccountStatusUseCase({
      lookupRepository: adapter,
      sessionRepository: adapter,
    }),
    setLocalIdentityAccountStatusUseCase: new SetLocalIdentityAccountStatusUseCase({
      lookupRepository: adapter,
      persistenceRepository: adapter,
      sessionRepository: adapter,
      authenticatedSessionService,
      clock: adapter,
    }),
    identityLookupRepository: adapter,
    authenticatedSessionService,
    observability: options.observability,
  });

  return Object.freeze({ backendApi, adapter });
}

export { InMemoryIdentityAdapter };

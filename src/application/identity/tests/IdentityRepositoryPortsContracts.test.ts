import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  IdentitySessionStatuses,
  UserIdentityStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createSession,
  createUserIdentity,
  type AuthProvider,
  type CredentialPolicy,
  type Session,
  type UserIdentity,
} from "../../../domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityPrincipalLookupKinds,
  normalizeIdentityPersistenceOperationKey,
  type IdentityCredentialHistoryQuery,
  type IdentityCredentialMaterialRecord,
  type IdentityPersistenceDeletionResult,
  type IdentityPersistenceMutationContext,
  type IdentityPersistenceMutationResult,
  type IdentityPrincipalLookup,
  type IdentityProviderSubjectReference,
  type IdentitySessionListQuery,
  type IdentitySessionTokenMaterialLookupQuery,
  type IdentitySessionTokenMaterialRecord,
  type IdentityUserIdentityListQuery,
} from "../../../shared/dto/identity/IdentityPersistenceDtos";
import type {
  ICredentialMaterialRepository,
} from "../ports/ICredentialMaterialRepository";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import type { IIdentitySessionTokenMaterialRepository } from "../ports/IIdentitySessionTokenMaterialRepository";
import type {
  IdentityQueryRepositoryPorts,
  IdentityRepositoryPorts,
  IdentityWriteRepositoryPorts,
} from "../ports/IdentityRepositoryPorts";
import type { IPlatformTransactionManager } from "../../common/ports/PlatformTransactionPorts";

class InMemoryIdentityRepositoryAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    IIdentitySessionTokenMaterialRepository {
  private readonly usersById = new Map<string, UserIdentity>();
  private readonly providersById = new Map<string, AuthProvider>();
  private readonly policiesById = new Map<string, CredentialPolicy>();
  private readonly credentialMaterialById = new Map<string, IdentityCredentialMaterialRecord>();
  private readonly sessionsById = new Map<string, Session>();
  private readonly sessionTokenMaterialBySessionId = new Map<string, IdentitySessionTokenMaterialRecord>();

  async countUserIdentities(): Promise<number> {
    return this.usersById.size;
  }

  async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    return this.usersById.get(userIdentityId.trim());
  }

  async listUserIdentities(query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>> {
    const rows = [...this.usersById.values()]
      .filter((entry) => {
        if (!query.providerId) {
          return true;
        }
        return entry.linkedProviders.some((link) => link.providerId === query.providerId);
      })
      .filter((entry) => {
        if (!query.includeStatuses || query.includeStatuses.length === 0) {
          return true;
        }
        return query.includeStatuses.includes(entry.status);
      });

    return this.page(rows, query.limit, query.offset);
  }

  async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    const normalizedValue = lookup.value.trim().toLowerCase();
    for (const user of this.usersById.values()) {
      if (lookup.kind === IdentityPrincipalLookupKinds.username && user.username === normalizedValue) {
        return user;
      }
      if (lookup.kind === IdentityPrincipalLookupKinds.email && user.email === normalizedValue) {
        return user;
      }
    }
    return undefined;
  }

  async findUserIdentityByProviderSubject(
    reference: IdentityProviderSubjectReference,
  ): Promise<UserIdentity | undefined> {
    for (const user of this.usersById.values()) {
      if (user.linkedProviders.some((link) => (
        link.providerId === reference.providerId && link.providerSubject === reference.providerSubject
      ))) {
        return user;
      }
    }
    return undefined;
  }

  async findAuthProviderById(providerId: string): Promise<AuthProvider | undefined> {
    return this.providersById.get(providerId.trim());
  }

  async findCredentialPolicyById(policyId: string): Promise<CredentialPolicy | undefined> {
    return this.policiesById.get(policyId.trim());
  }

  async saveUserIdentity(identity: UserIdentity): Promise<UserIdentity> {
    this.usersById.set(identity.id, identity);
    return identity;
  }

  async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.providersById.set(provider.id, provider);
    return provider;
  }

  async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.policiesById.set(policy.id, policy);
    return policy;
  }

  async getActiveCredentialMaterial(
    reference: IdentityProviderSubjectReference,
  ): Promise<IdentityCredentialMaterialRecord | undefined> {
    for (const record of this.credentialMaterialById.values()) {
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

  async listCredentialMaterialHistory(
    query: IdentityCredentialHistoryQuery,
  ): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>> {
    const rows = [...this.credentialMaterialById.values()]
      .filter((record) => (
        record.providerId === query.reference.providerId
        && record.providerSubject === query.reference.providerSubject
      ))
      .filter((record) => query.includeInactive || record.status === IdentityCredentialMaterialStatuses.active)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    return limit ? rows.slice(0, limit) : rows;
  }

  async saveCredentialMaterial(
    record: IdentityCredentialMaterialRecord,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentityCredentialMaterialRecord>> {
    const existing = this.credentialMaterialById.get(record.id);
    this.credentialMaterialById.set(record.id, record);
    return Object.freeze({
      record,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(record),
      wasReplay: mutation ? normalizeIdentityPersistenceOperationKey(mutation.operationKey) === "replay" : false,
    });
  }

  async markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityPersistenceMutationResult<IdentityCredentialMaterialRecord | undefined>> {
    const existing = this.credentialMaterialById.get(recordId);
    if (!existing) {
      return Object.freeze({
        record: undefined,
        changed: false,
        wasReplay: false,
      });
    }

    const updated = Object.freeze({
      ...existing,
      status: IdentityCredentialMaterialStatuses.superseded,
      supersededAt,
      updatedAt: supersededAt,
    });
    this.credentialMaterialById.set(recordId, updated);
    return Object.freeze({
      record: updated,
      changed: true,
      wasReplay: false,
    });
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessionsById.get(sessionId.trim());
  }

  async listSessions(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    const rows = [...this.sessionsById.values()]
      .filter((session) => !query.userIdentityId || session.userIdentityId === query.userIdentityId)
      .filter((session) => !query.providerId || session.providerId === query.providerId)
      .filter((session) => !query.providerSubject || session.providerSubject === query.providerSubject)
      .filter((session) => {
        if (query.includeStatuses && query.includeStatuses.length > 0) {
          return query.includeStatuses.includes(session.status);
        }
        if (query.includeExpired) {
          return true;
        }
        return session.status !== IdentitySessionStatuses.expired;
      })
      .filter((session) => !query.expiresBefore || Date.parse(session.expiresAt) < Date.parse(query.expiresBefore))
      .filter((session) => !query.expiresAfter || Date.parse(session.expiresAt) > Date.parse(query.expiresAfter));

    return this.page(rows, query.limit, query.offset);
  }

  async saveSession(
    session: Session,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<Session>> {
    const existing = this.sessionsById.get(session.id);
    this.sessionsById.set(session.id, session);
    return Object.freeze({
      record: session,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(session),
      wasReplay: mutation ? normalizeIdentityPersistenceOperationKey(mutation.operationKey) === "replay" : false,
    });
  }

  async removeSession(
    sessionId: string,
  ): Promise<IdentityPersistenceDeletionResult> {
    return Object.freeze({
      changed: this.sessionsById.delete(sessionId),
      wasReplay: false,
    });
  }

  async getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    return this.sessionTokenMaterialBySessionId.get(sessionId.trim());
  }

  async getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined> {
    const normalizedTokenHash = tokenHash.trim().toLowerCase();
    for (const record of this.sessionTokenMaterialBySessionId.values()) {
      if (record.tokenHash.trim().toLowerCase() === normalizedTokenHash) {
        return record;
      }
    }
    return undefined;
  }

  async listSessionTokenMaterial(
    query: IdentitySessionTokenMaterialLookupQuery,
  ): Promise<ReadonlyArray<IdentitySessionTokenMaterialRecord>> {
    const rows = [...this.sessionTokenMaterialBySessionId.values()]
      .filter((record) => !query.sessionId || record.sessionId === query.sessionId)
      .filter((record) => !query.tokenHash || record.tokenHash === query.tokenHash)
      .filter((record) => query.includeInvalidated || !record.invalidatedAt)
      .filter((record) => !query.expiresBefore || Date.parse(record.expiresAt) < Date.parse(query.expiresBefore))
      .filter((record) => !query.expiresAfter || Date.parse(record.expiresAt) > Date.parse(query.expiresAfter));

    return this.page(rows, query.limit, query.offset);
  }

  async saveSessionTokenMaterial(
    record: IdentitySessionTokenMaterialRecord,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentitySessionTokenMaterialRecord>> {
    const existing = this.sessionTokenMaterialBySessionId.get(record.sessionId);
    this.sessionTokenMaterialBySessionId.set(record.sessionId, record);
    return Object.freeze({
      record,
      changed: !existing || JSON.stringify(existing) !== JSON.stringify(record),
      wasReplay: mutation ? normalizeIdentityPersistenceOperationKey(mutation.operationKey) === "replay" : false,
    });
  }

  async invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
  ): Promise<IdentityPersistenceMutationResult<IdentitySessionTokenMaterialRecord | undefined>> {
    const existing = this.sessionTokenMaterialBySessionId.get(sessionId);
    if (!existing) {
      return Object.freeze({
        record: undefined,
        changed: false,
        wasReplay: false,
      });
    }

    const updated = Object.freeze({
      ...existing,
      invalidatedAt,
      updatedAt: invalidatedAt,
    });
    this.sessionTokenMaterialBySessionId.set(sessionId, updated);
    return Object.freeze({
      record: updated,
      changed: true,
      wasReplay: false,
    });
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = offset && offset > 0 ? offset : 0;
    const normalizedLimit = limit && limit > 0 ? limit : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

describe("identity repository ports for authoritative persistence", () => {
  it("supports identity user/provider/policy writes and principal/provider-subject lookup reads", async () => {
    const adapter = new InMemoryIdentityRepositoryAdapter();

    const provider = await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    const policy = await adapter.saveCredentialPolicy(createCredentialPolicy({
      id: "policy:local-password",
    }));

    const user = await adapter.saveUserIdentity(createUserIdentity({
      id: "user-identity-001",
      username: "authoritative-user",
      email: "authoritative@example.com",
      status: UserIdentityStatuses.active,
      linkedProviders: [{
        providerId: provider.id,
        providerSubject: "authoritative-user",
        isPrimary: true,
        linkedAt: "2026-04-05T12:00:00.000Z",
      }],
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    const byPrincipal = await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: "AUTHORITATIVE-USER",
    });
    const byProviderSubject = await adapter.findUserIdentityByProviderSubject({
      providerId: provider.id,
      providerSubject: "authoritative-user",
    });
    const listed = await adapter.listUserIdentities({
      providerId: provider.id,
      includeStatuses: [UserIdentityStatuses.active],
    });

    expect(policy.id).toBe("policy:local-password");
    expect(byPrincipal?.id).toBe(user.id);
    expect(byProviderSubject?.id).toBe(user.id);
    expect(listed).toHaveLength(1);
    expect(await adapter.countUserIdentities()).toBe(1);
  });

  it("supports credential material write/query separation and status lineage lookups", async () => {
    const adapter = new InMemoryIdentityRepositoryAdapter();

    await adapter.saveCredentialMaterial({
      id: "cred-001",
      userIdentityId: "user-identity-001",
      providerId: "provider:local-password",
      providerSubject: "authoritative-user",
      hashAlgorithm: "scrypt",
      hashValue: "hash-v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-05T12:00:00.000Z",
      updatedAt: "2026-04-05T12:00:00.000Z",
    }, {
      operationKey: "op-credential-save-001",
      actorUserIdentityId: "system:identity",
    });

    const activeCredential = await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "authoritative-user",
    });
    const supersede = await adapter.markCredentialMaterialSuperseded(
      "cred-001",
      "2026-04-05T12:10:00.000Z",
    );
    const history = await adapter.listCredentialMaterialHistory({
      reference: {
        providerId: "provider:local-password",
        providerSubject: "authoritative-user",
      },
      includeInactive: true,
    });

    expect(activeCredential?.id).toBe("cred-001");
    expect(supersede.record?.status).toBe(IdentityCredentialMaterialStatuses.superseded);
    expect(history).toHaveLength(1);
    expect(history[0]?.supersededAt).toBe("2026-04-05T12:10:00.000Z");
  });

  it("supports session and token-material persistence with filter-based query access", async () => {
    const adapter = new InMemoryIdentityRepositoryAdapter();

    const session = createSession({
      id: "session-001",
      userIdentityId: "user-identity-001",
      providerId: "provider:local-password",
      providerSubject: "authoritative-user",
      issuedAt: new Date("2026-04-05T13:00:00.000Z"),
      expiresAt: new Date("2026-04-05T15:00:00.000Z"),
    });

    await adapter.saveSession(session, {
      operationKey: "op-session-save-001",
      actorUserIdentityId: "system:identity",
    });

    await adapter.saveSessionTokenMaterial({
      sessionId: session.id,
      tokenHash: "token-hash-001",
      hashAlgorithm: "sha256",
      tokenType: "opaque-bearer",
      createdAt: "2026-04-05T13:00:00.000Z",
      updatedAt: "2026-04-05T13:00:00.000Z",
      expiresAt: "2026-04-05T15:00:00.000Z",
    }, {
      operationKey: "op-session-token-save-001",
      actorUserIdentityId: "system:identity",
    });

    const listedSessions = await adapter.listSessions({
      userIdentityId: "user-identity-001",
      includeStatuses: [IdentitySessionStatuses.active],
      includeExpired: false,
    });
    const tokenByHash = await adapter.getSessionTokenMaterialByTokenHash("TOKEN-HASH-001");

    const invalidation = await adapter.invalidateSessionTokenMaterial(
      "session-001",
      "2026-04-05T13:30:00.000Z",
    );
    const tokenRows = await adapter.listSessionTokenMaterial({
      sessionId: "session-001",
      includeInvalidated: true,
    });

    expect(listedSessions).toHaveLength(1);
    expect(tokenByHash?.sessionId).toBe("session-001");
    expect(invalidation.record?.invalidatedAt).toBe("2026-04-05T13:30:00.000Z");
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0]?.invalidatedAt).toBe("2026-04-05T13:30:00.000Z");
  });

  it("supports split query/write bundles for policy-aware application composition", async () => {
    const adapter = new InMemoryIdentityRepositoryAdapter();

    const queryPorts: IdentityQueryRepositoryPorts = {
      identityLookupRepository: adapter,
      credentialMaterialQueryRepository: adapter,
      sessionQueryRepository: adapter,
      sessionTokenMaterialQueryRepository: adapter,
    };
    const writePorts: IdentityWriteRepositoryPorts = {
      identityPersistenceRepository: adapter,
      credentialMaterialWriteRepository: adapter,
      sessionWriteRepository: adapter,
      sessionTokenMaterialWriteRepository: adapter,
    };
    const allPorts: IdentityRepositoryPorts = {
      ...queryPorts,
      ...writePorts,
      credentialMaterialRepository: adapter,
      sessionRepository: adapter,
      sessionTokenMaterialRepository: adapter,
      transactionManager: {
        runInTransaction: async <TValue>(operation: () => Promise<TValue>) => operation(),
      } satisfies IPlatformTransactionManager,
    };

    expect(normalizeIdentityPersistenceOperationKey("  OP-Identity-Persist-001  ")).toBe("op-identity-persist-001");
    expect(allPorts.identityLookupRepository).toBe(adapter);
    expect(allPorts.sessionRepository).toBe(adapter);
    expect(allPorts.sessionTokenMaterialRepository).toBe(adapter);
    expect(allPorts.transactionManager).toBeDefined();
  });
});

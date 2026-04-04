import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  CredentialStatuses,
  IdentitySessionStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createSession,
  createUserIdentity,
  revokeSession,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityCredentialMaterialStatuses,
  IdentityIdNamespaces,
  IdentityPrincipalLookupKinds,
  type IdentityCredentialHistoryQuery,
  type IdentityCredentialMaterialRecord,
  type IdentityPrincipalLookup,
  type IdentityProviderSubjectReference,
  type IdentitySessionListQuery,
} from "../../contracts/IdentityApplicationContracts";
import type { ICredentialMaterialRepository } from "../ports/ICredentialMaterialRepository";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityIdGenerator } from "../ports/IIdentityIdGenerator";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";

class InMemoryIdentityPortAdapter
  implements
    IIdentityLookupRepository,
    IIdentityPersistenceRepository,
    ICredentialMaterialRepository,
    IIdentitySessionRepository,
    IIdentityClock,
    IIdentityIdGenerator {
  private readonly users = new Map<string, ReturnType<typeof createUserIdentity>>();
  private readonly providers = new Map<string, ReturnType<typeof createAuthProvider>>();
  private readonly policies = new Map<string, ReturnType<typeof createCredentialPolicy>>();
  private readonly credentialMaterial = new Map<string, IdentityCredentialMaterialRecord>();
  private readonly sessions = new Map<string, ReturnType<typeof createSession>>();
  private sequence = 0;

  now(): Date {
    return new Date("2026-04-04T12:00:00.000Z");
  }

  nextId(namespace: typeof IdentityIdNamespaces[keyof typeof IdentityIdNamespaces]): string {
    this.sequence += 1;
    return `${namespace}:${this.sequence}`;
  }

  async saveUserIdentity(identity: ReturnType<typeof createUserIdentity>) {
    this.users.set(identity.id, identity);
    return identity;
  }

  async saveAuthProvider(provider: ReturnType<typeof createAuthProvider>) {
    this.providers.set(provider.id, provider);
    return provider;
  }

  async saveCredentialPolicy(policy: ReturnType<typeof createCredentialPolicy>) {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async findUserIdentityById(userIdentityId: string) {
    return this.users.get(userIdentityId.trim());
  }

  async countUserIdentities() {
    return this.users.size;
  }

  async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup) {
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

  async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference) {
    for (const user of this.users.values()) {
      const link = user.linkedProviders.find((entry) => (
        entry.providerId === reference.providerId &&
        entry.providerSubject === reference.providerSubject
      ));
      if (link) {
        return user;
      }
    }
    return undefined;
  }

  async findAuthProviderById(providerId: string) {
    return this.providers.get(providerId.trim());
  }

  async findCredentialPolicyById(policyId: string) {
    return this.policies.get(policyId.trim());
  }

  async getActiveCredentialMaterial(reference: IdentityProviderSubjectReference) {
    for (const material of this.credentialMaterial.values()) {
      if (
        material.providerId === reference.providerId &&
        material.providerSubject === reference.providerSubject &&
        material.status === IdentityCredentialMaterialStatuses.active
      ) {
        return material;
      }
    }
    return undefined;
  }

  async listCredentialMaterialHistory(query: IdentityCredentialHistoryQuery) {
    const includeInactive = query.includeInactive ?? false;
    const records = [...this.credentialMaterial.values()]
      .filter((material) => (
        material.providerId === query.reference.providerId &&
        material.providerSubject === query.reference.providerSubject &&
        (includeInactive || material.status === IdentityCredentialMaterialStatuses.active)
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    if (query.limit && query.limit > 0) {
      return records.slice(0, query.limit);
    }
    return records;
  }

  async saveCredentialMaterial(record: IdentityCredentialMaterialRecord) {
    this.credentialMaterial.set(record.id, record);
    return record;
  }

  async markCredentialMaterialSuperseded(recordId: string, supersededAt: string) {
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

  async saveSession(session: ReturnType<typeof createSession>) {
    this.sessions.set(session.id, session);
    return session;
  }

  async getSessionById(sessionId: string) {
    return this.sessions.get(sessionId.trim());
  }

  async listSessionsByUserIdentityId(query: IdentitySessionListQuery) {
    const includeStatuses = query.includeStatuses;
    const expiresBefore = query.expiresBefore ? new Date(query.expiresBefore).getTime() : undefined;
    const expiresAfter = query.expiresAfter ? new Date(query.expiresAfter).getTime() : undefined;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;

    const sessions = [...this.sessions.values()].filter((session) => {
      if (session.userIdentityId !== query.userIdentityId) {
        return false;
      }
      if (includeStatuses && includeStatuses.length > 0 && !includeStatuses.includes(session.status)) {
        return false;
      }
      const expiresAt = new Date(session.expiresAt).getTime();
      if (expiresBefore !== undefined && expiresAt >= expiresBefore) {
        return false;
      }
      if (expiresAfter !== undefined && expiresAt <= expiresAfter) {
        return false;
      }
      return true;
    });

    return limit ? sessions.slice(0, limit) : sessions;
  }

  async removeSession(sessionId: string) {
    return this.sessions.delete(sessionId.trim());
  }
}

describe("identity application ports contracts", () => {
  it("supports registration and login lookup seams across principal and provider subject", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const provider = await adapter.saveAuthProvider(createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    }));
    const policy = await adapter.saveCredentialPolicy(createCredentialPolicy({ id: "policy:local" }));
    const user = await adapter.saveUserIdentity(createUserIdentity({
      id: "user:1",
      username: "Alice",
      email: "Alice@example.com",
      linkedProviders: [{
        providerId: provider.id,
        providerSubject: "alice-local",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
        credentialState: {
          status: CredentialStatuses.active,
          policyId: policy.id,
          failedAttempts: 0,
        },
      }],
    }));

    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.username,
      value: "alice",
    }))?.id).toBe(user.id);
    expect(await adapter.countUserIdentities()).toBe(1);

    expect((await adapter.findUserIdentityByPrincipal({
      kind: IdentityPrincipalLookupKinds.email,
      value: "ALICE@EXAMPLE.COM",
    }))?.id).toBe(user.id);

    expect((await adapter.findUserIdentityByProviderSubject({
      providerId: provider.id,
      providerSubject: "alice-local",
    }))?.id).toBe(user.id);
  });

  it("supports credential material history and session persistence seams", async () => {
    const adapter = new InMemoryIdentityPortAdapter();
    const recordId = adapter.nextId(IdentityIdNamespaces.credentialMaterial);
    await adapter.saveCredentialMaterial({
      id: recordId,
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      hashAlgorithm: "argon2id",
      hashValue: "hash:v1",
      status: IdentityCredentialMaterialStatuses.active,
      createdAt: "2026-04-04T12:00:00.000Z",
      updatedAt: "2026-04-04T12:00:00.000Z",
    });

    const activeCredential = await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "alice-local",
    });
    expect(activeCredential?.id).toBe(recordId);

    const superseded = await adapter.markCredentialMaterialSuperseded(recordId, "2026-04-04T13:00:00.000Z");
    expect(superseded).toBe(true);
    expect((await adapter.getActiveCredentialMaterial({
      providerId: "provider:local-password",
      providerSubject: "alice-local",
    }))?.id).toBeUndefined();

    const fullHistory = await adapter.listCredentialMaterialHistory({
      reference: { providerId: "provider:local-password", providerSubject: "alice-local" },
      includeInactive: true,
    });
    expect(fullHistory).toHaveLength(1);
    expect(fullHistory[0]?.status).toBe(IdentityCredentialMaterialStatuses.superseded);

    const activeSession = await adapter.saveSession(createSession({
      id: "session:1",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
    }));
    const revokedSession = await adapter.saveSession(revokeSession(createSession({
      id: "session:2",
      userIdentityId: "user:1",
      providerId: "provider:local-password",
      providerSubject: "alice-local",
      issuedAt: new Date("2026-04-04T12:00:00.000Z"),
      expiresAt: new Date("2026-04-04T14:00:00.000Z"),
    }), "logout", new Date("2026-04-04T12:30:00.000Z")));

    const list = await adapter.listSessionsByUserIdentityId({
      userIdentityId: "user:1",
      includeStatuses: [IdentitySessionStatuses.active],
    });
    expect(list.map((session) => session.id)).toEqual([activeSession.id]);
    expect(revokedSession.status).toBe(IdentitySessionStatuses.revoked);
  });

  it("provides deterministic id and clock seams for use-case orchestration", () => {
    const adapter = new InMemoryIdentityPortAdapter();
    expect(adapter.nextId(IdentityIdNamespaces.userIdentity)).toBe("user-identity:1");
    expect(adapter.nextId(IdentityIdNamespaces.identitySession)).toBe("identity-session:2");
    expect(adapter.now().toISOString()).toBe("2026-04-04T12:00:00.000Z");
  });
});

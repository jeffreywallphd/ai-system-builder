import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  IdentitySessionStatuses,
  UserIdentityStatuses,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
  createSession,
  createUserIdentity,
  revokeSession,
  type AuthProvider,
  type CredentialPolicy,
  type Session,
  type UserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import {
  IdentityLifecycleEventTypes,
  type IdentityLifecycleEvent,
} from "../../contracts/IdentityLifecycleEventContracts";
import type {
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityPrincipalLookup,
  IdentityProviderSubjectReference,
  IdentitySessionListQuery,
  IdentityUserIdentityListQuery,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes, identitySuccess } from "../../contracts/IdentityApplicationContracts";
import type { IIdentityClock } from "../ports/IIdentityClock";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IIdentityPersistenceRepository } from "../ports/IIdentityPersistenceRepository";
import type { IIdentitySessionRepository } from "../ports/IIdentitySessionRepository";
import { ListLocalIdentityAccountsUseCase } from "../../../src/application/identity/use-cases/ListLocalIdentityAccountsUseCase";
import { GetLocalIdentityAccountStatusUseCase } from "../../../src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase";
import { SetLocalIdentityAccountStatusUseCase } from "../../../src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase";

class InMemoryIdentityAdminAdapter
  implements IIdentityLookupRepository, IIdentityPersistenceRepository, IIdentitySessionRepository, IIdentityClock {
  private readonly users = new Map<string, UserIdentity>();
  private readonly providers = new Map<string, AuthProvider>();
  private readonly policies = new Map<string, CredentialPolicy>();
  private readonly sessions = new Map<string, Session>();
  private current = new Date("2026-04-04T18:00:00.000Z");

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public async countUserIdentities(): Promise<number> {
    return this.users.size;
  }

  public async findUserIdentityById(userIdentityId: string): Promise<UserIdentity | undefined> {
    return this.users.get(userIdentityId.trim());
  }

  public async listUserIdentities(query: IdentityUserIdentityListQuery): Promise<ReadonlyArray<UserIdentity>> {
    const filtered = [...this.users.values()]
      .filter((user) => (
        !query.providerId || user.linkedProviders.some((link) => !link.unlinkedAt && link.providerId === query.providerId)
      ))
      .filter((user) => (
        !query.includeStatuses || query.includeStatuses.length === 0 || query.includeStatuses.includes(user.status)
      ))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = Number.isInteger(query.offset) && (query.offset ?? -1) >= 0 ? (query.offset as number) : 0;
    const limit = Number.isInteger(query.limit) && (query.limit ?? 0) > 0 ? (query.limit as number) : filtered.length;
    return Object.freeze(filtered.slice(offset, offset + limit));
  }

  public async findUserIdentityByPrincipal(_lookup: IdentityPrincipalLookup): Promise<UserIdentity | undefined> {
    return undefined;
  }

  public async findUserIdentityByProviderSubject(_reference: IdentityProviderSubjectReference): Promise<UserIdentity | undefined> {
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

  public async saveSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId.trim());
  }

  public async listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>> {
    let sessions = [...this.sessions.values()].filter((session) => session.userIdentityId === query.userIdentityId);
    if (query.includeStatuses && query.includeStatuses.length > 0) {
      sessions = sessions.filter((session) => query.includeStatuses?.includes(session.status));
    }
    return Object.freeze(sessions);
  }

  public async removeSession(
    _sessionId: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidSessionState>> {
    return identitySuccess({ changed: false });
  }
}

function createAdminContext() {
  return Object.freeze({
    actorUserIdentityId: "user:admin",
    authorization: Object.freeze({
      assertions: Object.freeze(["identity:accounts:manage"]),
    }),
    audit: Object.freeze({
      reason: "operations",
    }),
  });
}

async function seedAdminIdentity(adapter: InMemoryIdentityAdminAdapter): Promise<void> {
  const provider = createAuthProvider({
    id: "provider:local-password",
    kind: AuthProviderKinds.localPassword,
    category: AuthProviderCategories.local,
    displayName: "Local Password",
  });
  const policy = createCredentialPolicy({
    id: "policy:local-password",
  });
  const user = createUserIdentity({
    id: "user:member",
    username: "member.user",
    email: "member@example.com",
    status: UserIdentityStatuses.active,
    linkedProviders: [Object.freeze({
      providerId: provider.id,
      providerSubject: "member.user",
      isPrimary: true,
      linkedAt: "2026-04-04T18:00:00.000Z",
      credentialState: createLocalCredentialState({
        policy,
        passwordChangedAt: new Date("2026-04-04T18:00:00.000Z"),
      }),
    })],
  });

  await adapter.saveAuthProvider(provider);
  await adapter.saveCredentialPolicy(policy);
  await adapter.saveUserIdentity(user);
  await adapter.saveSession(createSession({
    id: "session:active:1",
    userIdentityId: user.id,
    providerId: provider.id,
    providerSubject: "member.user",
    issuedAt: new Date("2026-04-04T18:00:00.000Z"),
    expiresAt: new Date("2026-04-05T18:00:00.000Z"),
  }));
}

describe("Local identity administration use cases", () => {
  it("lists local accounts with active session counts", async () => {
    const adapter = new InMemoryIdentityAdminAdapter();
    await seedAdminIdentity(adapter);
    const useCase = new ListLocalIdentityAccountsUseCase({
      lookupRepository: adapter,
      sessionRepository: adapter,
    });

    const result = await useCase.execute({
      context: createAdminContext(),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected account list result.");
    }

    expect(result.value.accounts).toHaveLength(1);
    expect(result.value.accounts[0]).toEqual(expect.objectContaining({
      userIdentityId: "user:member",
      accountStatus: "active",
      activeSessionCount: 1,
    }));
  });

  it("returns account status details for a local identity", async () => {
    const adapter = new InMemoryIdentityAdminAdapter();
    await seedAdminIdentity(adapter);
    const useCase = new GetLocalIdentityAccountStatusUseCase({
      lookupRepository: adapter,
      sessionRepository: adapter,
    });

    const result = await useCase.execute({
      context: createAdminContext(),
      userIdentityId: "user:member",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected account status result.");
    }

    expect(result.value.account).toEqual(expect.objectContaining({
      userIdentityId: "user:member",
      providerId: "provider:local-password",
      accountStatus: "active",
    }));
  });

  it("disables local accounts and revokes active sessions", async () => {
    const adapter = new InMemoryIdentityAdminAdapter();
    await seedAdminIdentity(adapter);

    const revokeCalls: string[] = [];
    const events: IdentityLifecycleEvent[] = [];
    const useCase = new SetLocalIdentityAccountStatusUseCase({
      lookupRepository: adapter,
      persistenceRepository: adapter,
      sessionRepository: adapter,
      authenticatedSessionService: {
        revokeAuthenticatedSessionById: async ({ sessionId, reason }) => {
          revokeCalls.push(sessionId);
          const current = await adapter.getSessionById(sessionId);
          if (!current) {
            throw new Error("missing session");
          }
          const revoked = revokeSession(current, reason, adapter.now());
          await adapter.saveSession(revoked);
          return identitySuccess({ session: revoked });
        },
      },
      clock: adapter,
      eventPublisher: {
        publish: async (event) => {
          events.push(event);
        },
      },
    });

    const disabled = await useCase.execute({
      context: createAdminContext(),
      userIdentityId: "user:member",
      action: "disable",
    });

    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      throw new Error("Expected disable result.");
    }

    expect(disabled.value.status).toBe(UserIdentityStatuses.suspended);
    expect(disabled.value.affectedSessionIds).toEqual(["session:active:1"]);
    expect(revokeCalls).toEqual(["session:active:1"]);
    expect((await adapter.getSessionById("session:active:1"))?.status).toBe(IdentitySessionStatuses.revoked);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({
      eventType: IdentityLifecycleEventTypes.localAccountDisabled,
      payload: expect.objectContaining({
        userIdentityId: "user:member",
        actorUserIdentityId: "user:admin",
      }),
    }));

    const enabled = await useCase.execute({
      context: createAdminContext(),
      userIdentityId: "user:member",
      action: "enable",
    });
    expect(enabled.ok).toBeTrue();
    if (!enabled.ok) {
      throw new Error("Expected enable result.");
    }
    expect(enabled.value.status).toBe(UserIdentityStatuses.active);
  });
});

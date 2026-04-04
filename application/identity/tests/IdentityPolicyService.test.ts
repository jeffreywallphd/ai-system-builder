import { describe, expect, it } from "bun:test";
import {
  AuthProviderKinds,
  UserIdentityStatuses,
  createCredentialPolicy,
  createUserIdentity,
} from "../../../src/domain/identity/IdentityDomain";
import { IdentityPolicyService } from "../services/IdentityPolicyService";
import type { IIdentityLookupRepository } from "../ports/IIdentityLookupRepository";
import type { IdentityPrincipalLookup, IdentityProviderSubjectReference } from "../../contracts/IdentityApplicationContracts";

class InMemoryIdentityLookupRepository implements IIdentityLookupRepository {
  private readonly users = new Map<string, ReturnType<typeof createUserIdentity>>();

  public saveUser(user: ReturnType<typeof createUserIdentity>): void {
    this.users.set(user.id, user);
  }

  public async findUserIdentityById(userIdentityId: string) {
    return this.users.get(userIdentityId.trim());
  }

  public async findUserIdentityByPrincipal(lookup: IdentityPrincipalLookup) {
    const normalized = lookup.value.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (lookup.kind === "username" && user.username === normalized) {
        return user;
      }
      if (lookup.kind === "email" && user.email === normalized) {
        return user;
      }
    }
    return undefined;
  }

  public async findUserIdentityByProviderSubject(reference: IdentityProviderSubjectReference) {
    for (const user of this.users.values()) {
      const link = user.linkedProviders.find((entry) => (
        entry.providerId === reference.providerId
        && entry.providerSubject === reference.providerSubject
      ));
      if (link) {
        return user;
      }
    }
    return undefined;
  }

  public async findAuthProviderById(_providerId: string) {
    return undefined;
  }

  public async findCredentialPolicyById(_policyId: string) {
    return undefined;
  }
}

describe("IdentityPolicyService", () => {
  it("normalizes registration input deterministically", () => {
    const service = new IdentityPolicyService(new InMemoryIdentityLookupRepository());
    const normalized = service.normalizeRegistrationInput({
      username: "  Alice.Admin ",
      email: " ALICE@example.com ",
      displayName: " Alice Admin ",
    });

    expect(normalized.valid).toBe(true);
    expect(normalized.value).toEqual({
      username: "alice.admin",
      email: "alice@example.com",
      displayName: "Alice Admin",
    });
  });

  it("reports deterministic uniqueness conflicts for username/email/provider subject", async () => {
    const lookup = new InMemoryIdentityLookupRepository();
    lookup.saveUser(createUserIdentity({
      id: "user:1",
      username: "alice",
      email: "alice@example.com",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "alice@example.com",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    }));
    lookup.saveUser(createUserIdentity({
      id: "user:2",
      username: "bob",
      email: "bob@example.com",
      linkedProviders: [{
        providerId: "provider:oidc:example",
        providerSubject: "subject-bob",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    }));

    const service = new IdentityPolicyService(lookup);
    const result = await service.checkAccountUniqueness({
      username: " Alice ",
      email: " BOB@EXAMPLE.COM ",
      providerReference: {
        providerId: "provider:local-password",
        providerSubject: " ALICE@EXAMPLE.COM ",
        providerKind: AuthProviderKinds.localPassword,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.available).toBe(false);
    expect(result.conflicts.map((entry) => entry.code)).toEqual([
      "username-conflict",
      "email-conflict",
      "provider-subject-conflict",
    ]);
    expect(result.normalized?.providerReference?.providerSubject).toBe("alice@example.com");
  });

  it("ignores conflicts for the excluded identity id", async () => {
    const lookup = new InMemoryIdentityLookupRepository();
    lookup.saveUser(createUserIdentity({
      id: "user:1",
      username: "alice",
      email: "alice@example.com",
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "alice",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    }));

    const service = new IdentityPolicyService(lookup);
    const result = await service.checkAccountUniqueness({
      username: "Alice",
      email: "ALICE@EXAMPLE.COM",
      providerReference: {
        providerId: "provider:local-password",
        providerSubject: "alice",
        providerKind: AuthProviderKinds.localPassword,
      },
      excludeUserIdentityId: "user:1",
    });

    expect(result.valid).toBe(true);
    expect(result.available).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it("exposes structured credential policy and status transition evaluations", () => {
    const service = new IdentityPolicyService(new InMemoryIdentityLookupRepository());
    const policy = createCredentialPolicy({
      id: "policy:local",
      minLength: 12,
      blockedSubstrings: ["alice"],
    });
    const credential = service.evaluateCredentialCandidate(policy, "alice123!");
    expect(credential.valid).toBe(false);
    expect(credential.issues.map((entry) => entry.code)).toContain("credential-length");
    expect(credential.issues.map((entry) => entry.code)).toContain("credential-blocked-substring");

    const user = createUserIdentity({
      id: "user:status",
      username: "status-user",
      status: UserIdentityStatuses.suspended,
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "status-user",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    });
    const invalidTransition = service.evaluateStatusTransition(user, UserIdentityStatuses.pendingActivation);
    expect(invalidTransition.valid).toBe(false);
    expect(invalidTransition.issues[0]?.code).toBe("status-transition-disallowed");
  });
});

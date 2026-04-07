import { describe, expect, it } from "bun:test";
import {
  AuthProviderKinds,
  UserIdentityStatuses,
  createCredentialPolicy,
  createUserIdentity,
} from "../IdentityDomain";
import {
  evaluateCredentialPolicy,
  evaluateIdentityStatusTransition,
  normalizeIdentityProfile,
  normalizeIdentityUsername,
  normalizeProviderSubjectReference,
} from "../IdentityPolicy";

describe("IdentityPolicy", () => {
  it("normalizes usernames deterministically", () => {
    const normalized = normalizeIdentityUsername("  Alice.Admin  ");
    expect(normalized.valid).toBe(true);
    expect(normalized.value).toBe("alice.admin");
  });

  it("reports structured normalization issues", () => {
    const invalid = normalizeIdentityProfile({
      username: "Bad User",
      email: "not-an-email",
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((entry) => entry.code)).toEqual([
      "username-invalid-format",
      "email-invalid-format",
    ]);
  });

  it("normalizes local provider subjects for stable comparisons", () => {
    const local = normalizeProviderSubjectReference({
      providerId: " provider:local-password ",
      providerSubject: " Alice@Example.Com ",
      providerKind: AuthProviderKinds.localPassword,
    });
    const external = normalizeProviderSubjectReference({
      providerId: " provider:oidc:example ",
      providerSubject: " ExternalSubject ",
      providerKind: AuthProviderKinds.oidc,
    });

    expect(local.valid).toBe(true);
    expect(local.value).toEqual({
      providerId: "provider:local-password",
      providerSubject: "alice@example.com",
    });
    expect(external.valid).toBe(true);
    expect(external.value).toEqual({
      providerId: "provider:oidc:example",
      providerSubject: "ExternalSubject",
    });
  });

  it("maps credential policy evaluation to structured issues", () => {
    const policy = createCredentialPolicy({
      id: "policy:local",
      minLength: 12,
      minUniqueCharacters: 6,
      maxRepeatedCharacters: 2,
      blockedSubstrings: ["admin"],
    });

    const invalid = evaluateCredentialPolicy(policy, "admin1111!!!!");
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((entry) => entry.code)).toContain("credential-blocked-substring");
    expect(invalid.issues.map((entry) => entry.code)).toContain("credential-repeat");
  });

  it("returns structured status transition denials", () => {
    const identity = createUserIdentity({
      id: "user:policy",
      username: "PolicyUser",
      status: UserIdentityStatuses.suspended,
      linkedProviders: [{
        providerId: "provider:local-password",
        providerSubject: "policy-user",
        isPrimary: true,
        linkedAt: "2026-04-04T12:00:00.000Z",
      }],
    });

    const invalid = evaluateIdentityStatusTransition(identity, UserIdentityStatuses.pendingActivation);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]?.code).toBe("status-transition-disallowed");
  });
});


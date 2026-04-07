import { describe, expect, it } from "bun:test";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  CredentialStatuses,
  IdentityDomainError,
  IdentityLifecycleTransitionError,
  IdentitySessionStatuses,
  IdentitySessionLifecycleTransitions,
  SessionLifecycleTransitionError,
  SessionRevocationReasons,
  UserIdentityStatuses,
  clearCredentialFailures,
  createAuthProvider,
  createCredentialPolicy,
  createLocalCredentialState,
  createSession,
  createUserIdentity,
  disableCredential,
  expireSession,
  markCredentialCompromised,
  recordCredentialFailure,
  requireCredentialReset,
  revokeSession,
  rotateSession,
  transitionUserIdentityStatus,
  isSessionTransitionAllowed,
  validateCredentialCandidate,
  withUserIdentityProviderCredentialState,
} from "../IdentityDomain";

describe("IdentityDomain", () => {
  it("supports local and external provider seams without hard-coded local-only assumptions", () => {
    const local = createAuthProvider({
      id: "provider:local-password",
      kind: AuthProviderKinds.localPassword,
      category: AuthProviderCategories.local,
      displayName: "Local Password",
    });

    const external = createAuthProvider({
      id: "provider:oidc:example",
      kind: AuthProviderKinds.oidc,
      category: AuthProviderCategories.external,
      displayName: "Example SSO",
      isFirstParty: false,
    });

    expect(local.category).toBe("local");
    expect(external.category).toBe("external");
    expect(external.isFirstParty).toBe(false);
  });

  it("validates credential policy candidates with explicit issue codes", () => {
    const policy = createCredentialPolicy({
      id: "policy:strong",
      minLength: 12,
      blockedSubstrings: ["admin", "root"],
      maxRepeatedCharacters: 2,
      minUniqueCharacters: 6,
    });

    const invalid = validateCredentialCandidate(policy, "Admin1111!!!!");
    expect(invalid.isValid).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toContain("blocked-substring");
    expect(invalid.issues.map((issue) => issue.code)).toContain("repeat");

    const valid = validateCredentialCandidate(policy, "gH!9mZ@2tQ#5");
    expect(valid.isValid).toBe(true);
    expect(valid.issues).toEqual([]);
  });

  it("enforces credential policy invariants", () => {
    expect(() => createCredentialPolicy({
      id: "policy:bad",
      minLength: 7,
    })).toThrow("minLength");

    expect(() => createCredentialPolicy({
      id: "policy:bad-2",
      minPasswordAgeDays: 30,
      maxPasswordAgeDays: 30,
    })).toThrow("maxPasswordAgeDays");
  });

  it("keeps identity lifecycle explicit and deterministic", () => {
    const user = createUserIdentity({
      id: "user-1",
      username: "LocalUser",
      email: "USER@example.com",
      linkedProviders: [
        {
          providerId: "provider:local-password",
          providerSubject: "user-1",
          isPrimary: true,
          linkedAt: "2026-04-04T10:00:00.000Z",
        },
      ],
    });

    const activated = transitionUserIdentityStatus(user, UserIdentityStatuses.active, new Date("2026-04-04T10:05:00.000Z"));
    const suspended = transitionUserIdentityStatus(activated, UserIdentityStatuses.suspended, new Date("2026-04-04T10:06:00.000Z"));

    expect(user.email).toBe("user@example.com");
    expect(activated.status).toBe(UserIdentityStatuses.active);
    expect(suspended.status).toBe(UserIdentityStatuses.suspended);
    expect(() => transitionUserIdentityStatus(suspended, UserIdentityStatuses.pendingActivation)).toThrow(IdentityLifecycleTransitionError);
  });

  it("separates credential state from identity state updates", () => {
    const policy = createCredentialPolicy({ id: "policy:local" });
    const credential = createLocalCredentialState({
      policy,
      passwordChangedAt: new Date("2026-04-04T12:00:00.000Z"),
    });

    const user = createUserIdentity({
      id: "user-credential",
      username: "CredentialUser",
      linkedProviders: [
        {
          providerId: "provider:local-password",
          providerSubject: "credential-user",
          isPrimary: true,
          linkedAt: "2026-04-04T12:00:00.000Z",
          credentialState: credential,
        },
      ],
    });

    const failed = recordCredentialFailure(credential, policy, new Date("2026-04-04T12:05:00.000Z"));
    const resetRequired = requireCredentialReset(failed, new Date("2026-04-04T12:06:00.000Z"));
    const compromised = markCredentialCompromised(resetRequired, new Date("2026-04-04T12:07:00.000Z"));
    const disabled = disableCredential(compromised, new Date("2026-04-04T12:08:00.000Z"));

    const updatedUser = withUserIdentityProviderCredentialState(
      user,
      "provider:local-password",
      "credential-user",
      disabled,
      new Date("2026-04-04T12:09:00.000Z"),
    );

    expect(updatedUser.status).toBe(UserIdentityStatuses.pendingActivation);
    expect(updatedUser.linkedProviders[0]?.credentialState?.status).toBe(CredentialStatuses.disabled);
    expect(() => withUserIdentityProviderCredentialState(user, "provider:missing", "subject", disabled)).toThrow(IdentityDomainError);
  });

  it("locks and clears local credentials based on policy", () => {
    const policy = createCredentialPolicy({
      id: "policy:lockout",
      maxFailedAttempts: 2,
      lockoutDurationMinutes: 30,
    });

    const base = createLocalCredentialState({ policy });
    const firstFail = recordCredentialFailure(base, policy, new Date("2026-04-04T15:00:00.000Z"));
    const secondFail = recordCredentialFailure(firstFail, policy, new Date("2026-04-04T15:01:00.000Z"));
    const cleared = clearCredentialFailures(secondFail);

    expect(firstFail.status).toBe(CredentialStatuses.active);
    expect(secondFail.status).toBe(CredentialStatuses.locked);
    expect(secondFail.lockoutUntil).toBe("2026-04-04T15:31:00.000Z");
    expect(cleared.status).toBe(CredentialStatuses.active);
    expect(cleared.failedAttempts).toBe(0);
  });

  it("tracks independent session lifecycle transitions", () => {
    const session = createSession({
      id: "session-1",
      userIdentityId: "user-1",
      providerId: "provider:local-password",
      providerSubject: "user-1",
      issuedAt: new Date("2026-04-04T16:00:00.000Z"),
      expiresAt: new Date("2026-04-04T17:00:00.000Z"),
    });

    const rotated = rotateSession(session, "session-2", new Date("2026-04-04T16:10:00.000Z"));
    expect(rotated.status).toBe(IdentitySessionStatuses.rotated);
    expect(rotated.replacedBySessionId).toBe("session-2");
    expect(() => revokeSession(rotated, "logout", new Date("2026-04-04T16:11:00.000Z"))).toThrow(SessionLifecycleTransitionError);

    const activeSession = createSession({
      id: "session-3",
      userIdentityId: "user-1",
      providerId: "provider:oidc:example",
      providerSubject: "external-subject-1",
      issuedAt: new Date("2026-04-04T16:00:00.000Z"),
      expiresAt: new Date("2026-04-04T17:00:00.000Z"),
    });
    const revoked = revokeSession(activeSession, "security", new Date("2026-04-04T16:30:00.000Z"));

    expect(revoked.status).toBe(IdentitySessionStatuses.revoked);
    expect(revoked.revocation?.reason).toBe("security");
  });

  it("exposes explicit session lifecycle transition rules", () => {
    expect(IdentitySessionLifecycleTransitions.active).toEqual([
      IdentitySessionStatuses.rotated,
      IdentitySessionStatuses.expired,
      IdentitySessionStatuses.revoked,
    ]);
    expect(IdentitySessionLifecycleTransitions.rotated).toEqual([]);
    expect(isSessionTransitionAllowed(IdentitySessionStatuses.active, IdentitySessionStatuses.revoked)).toBeTrue();
    expect(isSessionTransitionAllowed(IdentitySessionStatuses.revoked, IdentitySessionStatuses.active)).toBeFalse();
  });

  it("captures access-channel context while keeping revocation reasons explicit", () => {
    const session = createSession({
      id: "session-desktop",
      userIdentityId: "user-2",
      providerId: "provider:local-password",
      providerSubject: "user-2",
      issuedAt: new Date("2026-04-04T18:00:00.000Z"),
      expiresAt: new Date("2026-04-04T19:00:00.000Z"),
      client: {
        accessChannel: "desktop",
        deviceId: "desktop-1",
        trustedDeviceBindingId: "trusted-device:desktop-1",
        trustMarker: "marker:desktop",
      },
    });

    const revoked = revokeSession(session, SessionRevocationReasons.admin, new Date("2026-04-04T18:05:00.000Z"));
    expect(session.client?.accessChannel).toBe("desktop");
    expect(session.client?.trustedDeviceBindingId).toBe("trusted-device:desktop-1");
    expect(session.client?.trustMarker).toBe("marker:desktop");
    expect(session.client?.deviceTrust?.trustedDeviceId).toBe("trusted-device:desktop-1");
    expect(session.client?.deviceTrust?.sessionAssuranceLevel).toBe("authenticated-trusted");
    expect(session.client?.deviceTrust?.snapshot.state).toBe("unknown");
    expect(revoked.revocation?.reason).toBe("admin");
  });

  it("captures structured session device trust context at issuance", () => {
    const session = createSession({
      id: "session-trust-context",
      userIdentityId: "user-3",
      providerId: "provider:local-password",
      providerSubject: "user-3",
      issuedAt: new Date("2026-04-04T19:00:00.000Z"),
      expiresAt: new Date("2026-04-04T20:00:00.000Z"),
      client: {
        accessChannel: "desktop",
        deviceTrust: {
          trustedDeviceId: "trusted-device:session-context",
          issuedOnTrustedDevice: true,
          sessionAssuranceLevel: "authenticated-trusted",
          snapshot: {
            state: "trusted",
            evaluatedAt: "2026-04-04T19:00:00.000Z",
          },
          invalidationReasons: ["trusted-device-revoked", "trusted-device-revoked"],
        },
      },
    });

    expect(session.client?.deviceTrust?.trustedDeviceId).toBe("trusted-device:session-context");
    expect(session.client?.deviceTrust?.issuedOnTrustedDevice).toBeTrue();
    expect(session.client?.deviceTrust?.sessionAssuranceLevel).toBe("authenticated-trusted");
    expect(session.client?.deviceTrust?.snapshot.state).toBe("trusted");
    expect(session.client?.deviceTrust?.invalidationReasons).toEqual(["trusted-device-revoked"]);
  });

  it("only expires sessions after expiresAt", () => {
    const session = createSession({
      id: "session-expire",
      userIdentityId: "user-2",
      providerId: "provider:local-password",
      providerSubject: "user-2",
      issuedAt: new Date("2026-04-04T18:00:00.000Z"),
      expiresAt: new Date("2026-04-04T19:00:00.000Z"),
    });

    expect(() => expireSession(session, new Date("2026-04-04T18:30:00.000Z"))).toThrow("cannot be expired");

    const expired = expireSession(session, new Date("2026-04-04T19:00:00.000Z"));
    expect(expired.status).toBe(IdentitySessionStatuses.expired);
  });

  it("requires a single primary provider link", () => {
    expect(() => createUserIdentity({
      id: "user-no-primary",
      username: "user",
      linkedProviders: [
        {
          providerId: "provider:local-password",
          providerSubject: "user",
          isPrimary: false,
          linkedAt: "2026-04-04T00:00:00.000Z",
        },
      ],
    })).toThrow("exactly one primary");

    expect(() => createUserIdentity({
      id: "user-dup",
      username: "user",
      linkedProviders: [
        {
          providerId: "provider:local-password",
          providerSubject: "user",
          isPrimary: true,
          linkedAt: "2026-04-04T00:00:00.000Z",
        },
        {
          providerId: "provider:local-password",
          providerSubject: "user",
          isPrimary: false,
          linkedAt: "2026-04-04T00:00:01.000Z",
        },
      ],
    })).toThrow("Duplicate provider link");
  });
});

import { describe, expect, it } from "bun:test";
import {
  IdentityAuthApiErrorCodes,
  type IdentityAuthApiErrorCode,
  type IdentityAuthApiResponse,
  type ResolveAuthenticatedSessionApiResponse,
} from "../../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { IdentityAuthSessionCoordinator, IdentitySessionBootstrapStatus, IdentitySessionUnauthenticatedReason } from "../IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "../IdentityAuthSessionStore";

describe("IdentityAuthSessionCoordinator", () => {
  it("returns unauthenticated when no stored session is available", async () => {
    const store = createSessionStore();
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => {
        throw new Error("should not be called");
      },
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.missingSession);
    }
  });

  it("clears expired sessions before resolving transport validation", async () => {
    const store = createSessionStore();
    store.saveSession(createSession({ sessionExpiresAt: "2026-04-04T19:59:59.000Z" }));
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => {
        throw new Error("should not be called");
      },
    }, () => new Date("2026-04-04T20:00:00.000Z"));

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.expiredSession);
    }
    expect(store.hasSession()).toBeFalse();
  });

  it("hydrates and persists validated session details", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice-updated",
            displayName: "Alice Updated",
            email: "alice@example.com",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
            deviceId: "device:desktop",
            trustedDeviceBindingId: "trusted-device:1",
            trustMarker: "marker:1",
          },
        },
      }),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    if (result.status === IdentitySessionBootstrapStatus.authenticated) {
      expect(result.session.username).toBe("alice-updated");
      expect(result.session.sessionAccessChannel).toBe("desktop");
    }
    const persisted = store.getSession();
    expect(persisted?.sessionId).toBe("identity-session:1");
    expect(JSON.stringify(persisted).includes("trusted-device:1")).toBeFalse();
  });

  it("clears invalid sessions when API returns authentication failure", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => createFailureResponse(IdentityAuthApiErrorCodes.authenticationFailed),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.invalidSession);
    }
    expect(store.hasSession()).toBeFalse();
  });
});

function createSession(overrides: Partial<ReturnType<typeof buildSession>> = {}) {
  return {
    ...buildSession(),
    ...overrides,
  };
}

function buildSession() {
  return {
    userIdentityId: "user-1",
    username: "alice",
    providerId: "provider:local-password",
    providerSubject: "alice",
    authPath: "password",
    authenticatedAt: "2026-04-04T20:00:00.000Z",
    sessionId: "identity-session:1",
    sessionToken: "token-1",
    sessionTokenType: "Bearer" as const,
    sessionIssuedAt: "2026-04-04T20:00:00.000Z",
    sessionExpiresAt: "2026-04-05T20:00:00.000Z",
  };
}

function createSessionStore(): IdentityAuthSessionStore {
  const backing = new Map<string, string>();
  (globalThis as typeof globalThis & { window?: Window }).window = {
    localStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => { backing.set(key, value); },
      removeItem: (key: string) => { backing.delete(key); },
    },
  } as unknown as Window;
  return new IdentityAuthSessionStore();
}

function createFailureResponse(code: IdentityAuthApiErrorCode): IdentityAuthApiResponse<ResolveAuthenticatedSessionApiResponse> {
  return {
    ok: false,
    error: {
      code,
      message: "failure",
    },
  };
}

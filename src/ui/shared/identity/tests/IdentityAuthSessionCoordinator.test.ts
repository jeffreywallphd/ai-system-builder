import { beforeEach, describe, expect, it } from "bun:test";
import {
  IdentityAuthApiErrorCodes,
  type IdentityAuthApiErrorCode,
  type IdentityAuthApiResponse,
  type ResolveAuthenticatedSessionApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import {
  IdentityAuthSessionCoordinator,
  IdentitySessionBootstrapStatus,
  IdentitySessionUnauthenticatedReason,
} from "../IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "../IdentityAuthSessionStore";

describe("IdentityAuthSessionCoordinator", () => {
  beforeEach(() => {
    IdentityAuthSessionCoordinator.resetInFlightBootstrapForTests();
  });

  it("returns unauthenticated when no stored session is available", async () => {
    const store = createSessionStore();
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => {
        throw new Error("should not be called");
      },
      resolveSessionActorContext: async () => {
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
    const coordinator = new IdentityAuthSessionCoordinator(
      store,
      {
        resolveAuthenticatedSession: async () => {
          throw new Error("should not be called");
        },
        resolveSessionActorContext: async () => {
          throw new Error("should not be called");
        },
      },
      () => new Date("2026-04-04T20:00:00.000Z"),
    );

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.expiredSession);
    }
    expect(store.hasSession()).toBeFalse();
  });

  it("hydrates and persists validated session details from authoritative context", async () => {
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
      resolveSessionActorContext: async () => ({
        ok: true,
        data: {
          actor: {
            userIdentityId: "user-1",
            username: "alice-updated",
            displayName: "Alice Updated",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
            assuranceLevel: "authenticated-trusted",
            trustedDeviceId: "trusted-device:1",
            trustState: "trusted",
            trustEvaluatedAt: "2026-04-04T20:00:01.000Z",
            trustInvalidationReasons: [],
          },
          trustedDevice: {
            trustedDeviceId: "trusted-device:1",
            userIdentityId: "user-1",
            displayName: "Alice Laptop",
            pairingMethod: "one-time-code",
            trustStatus: "trusted",
            registeredAt: "2026-04-01T10:00:00.000Z",
            metadata: {},
            updatedAt: "2026-04-04T20:00:01.000Z",
          },
          workspaceContext: {
            requestedWorkspaceId: "workspace:alpha",
            resolvedWorkspaceId: "workspace:alpha",
            workspaces: [
              {
                workspaceId: "workspace:alpha",
                slug: "alpha",
                displayName: "Workspace Alpha",
                status: "active",
                visibility: "private",
                membershipStatus: "active",
                effectiveRoles: ["owner"],
                canAdministrate: true,
                isWorkspaceOwner: true,
              },
            ],
          },
        },
      }),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    if (result.status === IdentitySessionBootstrapStatus.authenticated) {
      expect(result.session.username).toBe("alice-updated");
      expect(result.session.sessionAccessChannel).toBe("desktop");
      expect(result.session.sessionAssuranceLevel).toBe("authenticated-trusted");
      expect(result.session.initialCapabilityState?.workspaceId).toBe("workspace:alpha");
    }

    const persisted = store.getSession();
    expect(persisted?.sessionId).toBe("identity-session:1");
    expect(persisted?.sessionTrustedDeviceId).toBe("trusted-device:1");
    expect(persisted?.workspaceContext?.resolvedWorkspaceId).toBe("workspace:alpha");
  });

  it("clears invalid sessions when API returns authentication failure", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => createFailureResponse(IdentityAuthApiErrorCodes.authenticationFailed),
      resolveSessionActorContext: async () => createFailureResponse(IdentityAuthApiErrorCodes.authenticationFailed),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.invalidSession);
    }
    expect(store.hasSession()).toBeFalse();
  });

  it("surfaces context-unavailable when actor context bootstrap fails", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
          },
        },
      }),
      resolveSessionActorContext: async () => ({
        ok: false,
        error: {
          code: "internal",
          message: "context unavailable",
        },
      }),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.contextUnavailable);
      expect(result.error?.code).toBe("identity-context-unavailable");
    }
    expect(store.hasSession()).toBeTrue();
  });

  it("classifies actor context timeout failures distinctly", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
          },
        },
      }),
      resolveSessionActorContext: async () => ({
        ok: false,
        error: {
          code: "internal",
          message: "Request timed out.",
          domainCode: "request-timeout",
        },
      }),
    });

    const result = await coordinator.bootstrap();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.contextUnavailable);
      expect(result.error?.code).toBe("timeout");
      expect(result.error?.retryable).toBeTrue();
    }
  });

  it("retains authenticated state during refresh when actor context is temporarily unavailable", async () => {
    const store = createSessionStore();
    const session = createSession();
    store.saveSession(session);
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
          },
        },
      }),
      resolveSessionActorContext: async () => ({
        ok: false,
        error: {
          code: "internal",
          message: "temporarily unavailable",
          retryable: true,
        },
      }),
    });

    const result = await coordinator.refreshIfAuthenticated();
    expect(result.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    if (result.status === IdentitySessionBootstrapStatus.authenticated) {
      expect(result.session.sessionToken).toBe(session.sessionToken);
    }
    expect(store.hasSession()).toBeTrue();
  });

  it("reuses in-flight bootstrap work for concurrent callers", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    let resolveActorContext: ((value: IdentityAuthApiResponse<unknown>) => void) | undefined;
    let resolveActorContextCalls = 0;
    const actorContextPromise = new Promise<IdentityAuthApiResponse<unknown>>((resolve) => {
      resolveActorContext = resolve;
    });
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => {
        return {
          ok: true,
          data: {
            principal: {
              userIdentityId: "user-1",
              username: "alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              providerSubject: "alice",
              accessChannel: "desktop",
              issuedAt: "2026-04-04T20:00:00.000Z",
              expiresAt: "2026-04-05T20:00:00.000Z",
            },
          },
        };
      },
      resolveSessionActorContext: async () => {
        resolveActorContextCalls += 1;
        return await actorContextPromise as IdentityAuthApiResponse<never>;
      },
    });

    const first = coordinator.bootstrap();
    const second = coordinator.bootstrap();
    resolveActorContext?.({
      ok: true,
      data: {
        actor: {
          userIdentityId: "user-1",
          username: "alice",
        },
        session: {
          sessionId: "identity-session:1",
          providerId: "provider:local-password",
          accessChannel: "desktop",
          issuedAt: "2026-04-04T20:00:00.000Z",
          expiresAt: "2026-04-05T20:00:00.000Z",
          assuranceLevel: "authenticated-untrusted",
          trustState: "untrusted",
        },
        workspaceContext: {
          requestedWorkspaceId: undefined,
          resolvedWorkspaceId: undefined,
          workspaces: [],
        },
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    expect(secondResult.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    expect(resolveActorContextCalls).toBe(1);
  });

  it("deduplicates in-flight actor-context requests across coordinator instances", async () => {
    const storeA = createSessionStore();
    const storeB = createSessionStore();
    const session = createSession();
    storeA.saveSession(session);
    storeB.saveSession(session);

    let resolveActorContext: ((value: IdentityAuthApiResponse<unknown>) => void) | undefined;
    let resolveActorContextCalls = 0;
    const actorContextPromise = new Promise<IdentityAuthApiResponse<unknown>>((resolve) => {
      resolveActorContext = resolve;
    });
    const authService = {
      resolveSessionActorContext: async () => {
        resolveActorContextCalls += 1;
        return await actorContextPromise as IdentityAuthApiResponse<never>;
      },
    };
    const firstCoordinator = new IdentityAuthSessionCoordinator(storeA, authService);
    const secondCoordinator = new IdentityAuthSessionCoordinator(storeB, authService);

    const first = firstCoordinator.refreshIfAuthenticated();
    const second = secondCoordinator.refreshIfAuthenticated();
    resolveActorContext?.({
      ok: true,
      data: {
        actor: {
          userIdentityId: "user-1",
          username: "alice",
        },
        session: {
          sessionId: "identity-session:1",
          providerId: "provider:local-password",
          accessChannel: "desktop",
          issuedAt: "2026-04-04T20:00:00.000Z",
          expiresAt: "2026-04-05T20:00:00.000Z",
          assuranceLevel: "authenticated-untrusted",
          trustState: "untrusted",
        },
        workspaceContext: {
          requestedWorkspaceId: undefined,
          resolvedWorkspaceId: undefined,
          workspaces: [],
        },
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    expect(secondResult.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    expect(resolveActorContextCalls).toBe(1);
  });

  it("keeps shared actor-context request alive when the first caller aborts", async () => {
    const storeA = createSessionStore();
    const storeB = createSessionStore();
    const session = createSession();
    storeA.saveSession(session);
    storeB.saveSession(session);

    let resolveActorContext: ((value: IdentityAuthApiResponse<unknown>) => void) | undefined;
    let resolveActorContextCalls = 0;
    const actorContextPromise = new Promise<IdentityAuthApiResponse<unknown>>((resolve) => {
      resolveActorContext = resolve;
    });
    const authService = {
      resolveSessionActorContext: async () => {
        resolveActorContextCalls += 1;
        return await actorContextPromise as IdentityAuthApiResponse<never>;
      },
    };
    const firstCoordinator = new IdentityAuthSessionCoordinator(storeA, authService);
    const secondCoordinator = new IdentityAuthSessionCoordinator(storeB, authService);

    const cancelledCaller = new AbortController();
    const first = firstCoordinator.refreshIfAuthenticated({ signal: cancelledCaller.signal });
    const second = secondCoordinator.refreshIfAuthenticated();

    cancelledCaller.abort();
    resolveActorContext?.({
      ok: true,
      data: {
        actor: {
          userIdentityId: "user-1",
          username: "alice",
        },
        session: {
          sessionId: "identity-session:1",
          providerId: "provider:local-password",
          accessChannel: "desktop",
          issuedAt: "2026-04-04T20:00:00.000Z",
          expiresAt: "2026-04-05T20:00:00.000Z",
          assuranceLevel: "authenticated-untrusted",
          trustState: "untrusted",
        },
        workspaceContext: {
          requestedWorkspaceId: undefined,
          resolvedWorkspaceId: undefined,
          workspaces: [],
        },
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (firstResult.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(firstResult.error?.code).toBe("cancelled");
    }
    expect(secondResult.status).toBe(IdentitySessionBootstrapStatus.authenticated);
    expect(resolveActorContextCalls).toBe(1);
  });

  it("passes requested workspace context through bootstrap and refresh", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const seenWorkspaceIds: Array<string | undefined> = [];
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "thin-client",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
          },
        },
      }),
      resolveSessionActorContext: async (request) => {
        seenWorkspaceIds.push(request.workspaceId);
        return {
          ok: true,
          data: {
            actor: {
              userIdentityId: "user-1",
              username: "alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              accessChannel: "thin-client",
              issuedAt: "2026-04-04T20:00:00.000Z",
              expiresAt: "2026-04-05T20:00:00.000Z",
              assuranceLevel: "authenticated-untrusted",
              trustState: "untrusted",
            },
            workspaceContext: {
              requestedWorkspaceId: request.workspaceId,
              resolvedWorkspaceId: request.workspaceId,
              workspaces: [],
            },
          },
        };
      },
    });

    await coordinator.bootstrap({ workspaceId: "workspace:alpha" });
    await coordinator.refreshIfAuthenticated({ workspaceId: "  " });
    expect(seenWorkspaceIds).toEqual(["workspace:alpha", undefined]);
  });

  it("publishes user-facing progress details while workspace context is still loading", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const progressDetails: string[] = [];
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveAuthenticatedSession: async () => ({
        ok: true,
        data: {
          principal: {
            userIdentityId: "user-1",
            username: "alice",
          },
          session: {
            sessionId: "identity-session:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            accessChannel: "desktop",
            issuedAt: "2026-04-04T20:00:00.000Z",
            expiresAt: "2026-04-05T20:00:00.000Z",
          },
        },
      }),
      resolveSessionActorContext: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 1_800);
        });
        return {
          ok: true,
          data: {
            actor: {
              userIdentityId: "user-1",
              username: "alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              accessChannel: "desktop",
              issuedAt: "2026-04-04T20:00:00.000Z",
              expiresAt: "2026-04-05T20:00:00.000Z",
              assuranceLevel: "authenticated-untrusted",
              trustState: "untrusted",
            },
            workspaceContext: {
              requestedWorkspaceId: "workspace:alpha",
              resolvedWorkspaceId: "workspace:alpha",
              workspaces: [],
            },
          },
        };
      },
    });

    await coordinator.bootstrap({
      workspaceId: "workspace:alpha",
      onProgress: (update) => {
        if (typeof update.detail === "string") {
          progressDetails.push(update.detail);
        }
      },
    });

    expect(progressDetails.some((detail) => detail.includes("Requesting workspace context and permissions"))).toBeTrue();
    expect(progressDetails.some((detail) => detail.includes("Still waiting on identity service response"))).toBeTrue();
  });

  it("returns cancelled classification when caller aborts while awaiting actor context", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const signalController = new AbortController();
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveSessionActorContext: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
        return {
          ok: true,
          data: {
            actor: {
              userIdentityId: "user-1",
              username: "alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              accessChannel: "desktop",
              issuedAt: "2026-04-04T20:00:00.000Z",
              expiresAt: "2026-04-05T20:00:00.000Z",
              assuranceLevel: "authenticated-untrusted",
              trustState: "untrusted",
            },
            workspaceContext: {
              requestedWorkspaceId: undefined,
              resolvedWorkspaceId: undefined,
              workspaces: [],
            },
          },
        };
      },
    });

    const resultPromise = coordinator.refreshIfAuthenticated({ signal: signalController.signal });
    signalController.abort();
    const result = await resultPromise;
    expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
    if (result.status === IdentitySessionBootstrapStatus.unauthenticated) {
      expect(result.reason).toBe(IdentitySessionUnauthenticatedReason.contextUnavailable);
      expect(result.error?.code).toBe("cancelled");
    }
  });

  it("logs unknown actor-context failures with red stack-trace diagnostics", async () => {
    const store = createSessionStore();
    store.saveSession(createSession());
    const consoleErrorCalls: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };
    const coordinator = new IdentityAuthSessionCoordinator(store, {
      resolveSessionActorContext: async () => ({
        ok: false,
        error: {
          code: "internal",
          message: "Unexpected actor-context fault.",
          domainCode: "upstream-unexpected",
          stack: "Error: Unexpected actor-context fault\\n    at IdentityAuthService.resolveSessionActorContext",
        },
      }),
    });

    try {
      const result = await coordinator.bootstrap();
      expect(result.status).toBe(IdentitySessionBootstrapStatus.unauthenticated);
      expect(consoleErrorCalls.length).toBe(1);
      const [formatMessage, colorStyle] = consoleErrorCalls[0] ?? [];
      expect(formatMessage).toBeString();
      expect((formatMessage as string).includes("[ai-loom][init] resolveSessionActorContext:unknown-failure")).toBeTrue();
      expect((formatMessage as string).includes("IdentityAuthService.resolveSessionActorContext")).toBeTrue();
      expect(colorStyle).toBe("color: #ff4d4f; font-weight: 700;");
    } finally {
      console.error = originalConsoleError;
    }
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
    sessionExpiresAt: "2027-04-05T20:00:00.000Z",
  };
}

function createSessionStore(): IdentityAuthSessionStore {
  const backing = new Map<string, string>();
  (globalThis as typeof globalThis & { window?: Window }).window = {
    localStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
      removeItem: (key: string) => {
        backing.delete(key);
      },
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

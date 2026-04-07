import { describe, expect, it } from "bun:test";
import { HttpWorkspaceAdministrationClient } from "../workspaces/WorkspaceAdministrationClient";
import { HttpRuntimeControlClient } from "../runtime/RuntimeControlClient";
import {
  IdentityAuthSessionCoordinator,
  IdentitySessionBootstrapStatus,
} from "../identity/IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "../identity/IdentityAuthSessionStore";
import {
  RuntimeRealtimeSubscriptionService,
  type RuntimeRealtimeSocket,
  type RuntimeRealtimeSocketEvent,
  type RuntimeRealtimeSocketCloseEvent,
} from "../runtime/RuntimeRealtimeSubscriptionService";

class FakeRuntimeRealtimeSocket implements RuntimeRealtimeSocket {
  public onopen: (() => void) | null = null;
  public onmessage: ((event: RuntimeRealtimeSocketEvent) => void) | null = null;
  public onclose: ((event: RuntimeRealtimeSocketCloseEvent) => void) | null = null;
  public onerror: (() => void) | null = null;
  public readonly sent: string[] = [];

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(): void {
    // no-op for test socket
  }

  public emitOpen(): void {
    this.onopen?.();
  }
}

describe("Unified API cross-surface regression", () => {
  const surfaces = ["desktop", "thin-client"] as const;

  for (const surface of surfaces) {
    it(`keeps bootstrap, reads, mutations, realtime, and failures aligned for ${surface}`, async () => {
      const store = createSessionStore();
      store.saveSession({
        userIdentityId: "user-1",
        username: "alice",
        providerId: "provider:local-password",
        sessionId: "identity-session:1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer",
        sessionIssuedAt: "2026-04-07T11:00:00.000Z",
        sessionExpiresAt: "2026-04-08T11:00:00.000Z",
      });

      const coordinator = new IdentityAuthSessionCoordinator(store, {
        resolveAuthenticatedSession: async () => ({
          ok: true,
          data: {
            principal: {
              userIdentityId: "user-1",
              username: "alice",
              displayName: "Alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              providerSubject: "alice",
              accessChannel: surface,
              issuedAt: "2026-04-07T11:00:00.000Z",
              expiresAt: "2026-04-08T11:00:00.000Z",
            },
          },
        }),
        resolveSessionActorContext: async () => ({
          ok: true,
          data: {
            actor: {
              userIdentityId: "user-1",
              username: "alice",
              displayName: "Alice",
            },
            session: {
              sessionId: "identity-session:1",
              providerId: "provider:local-password",
              accessChannel: surface,
              issuedAt: "2026-04-07T11:00:00.000Z",
              expiresAt: "2026-04-08T11:00:00.000Z",
              assuranceLevel: "authenticated-untrusted",
              trustState: "untrusted",
            },
            workspaceContext: {
              requestedWorkspaceId: "workspace-alpha",
              resolvedWorkspaceId: "workspace-alpha",
              workspaces: [],
            },
          },
        }),
      });

      const bootstrap = await coordinator.bootstrap({ workspaceId: "workspace-alpha" });
      expect(bootstrap.status).toBe(IdentitySessionBootstrapStatus.authenticated);
      if (bootstrap.status === IdentitySessionBootstrapStatus.authenticated) {
        expect(bootstrap.session.sessionAccessChannel).toBe(surface);
        expect(bootstrap.session.workspaceContext?.resolvedWorkspaceId).toBe("workspace-alpha");
      }

      const recordedRequests: Array<{ readonly method: string; readonly url: string; readonly authorization?: string }> = [];
      const successFetch: typeof fetch = async (input, init) => {
        const headers = init?.headers as Record<string, string> | undefined;
        recordedRequests.push({
          method: String(init?.method ?? "GET"),
          url: String(input),
          authorization: headers?.authorization,
        });

        const url = String(input);
        if (url.includes("/api/v1/workspaces")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              items: [],
              totalCount: 0,
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          data: {
            executionId: "execution-1",
            status: "pending",
            acceptedState: "accepted",
            systemId: "system:demo",
            versionId: "system:demo:v1",
            executedVersionMap: {
              rootVersionId: "system:demo:v1",
              nodeVersionIds: {},
            },
            nestedExecutionLineage: [],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };

      const workspaceClient = new HttpWorkspaceAdministrationClient("http://127.0.0.1:8788", {
        fetchImplementation: successFetch,
      });
      const runtimeClient = new HttpRuntimeControlClient("http://127.0.0.1:8788", {
        fetchImplementation: successFetch,
      });

      await workspaceClient.listWorkspaces({ limit: 5, offset: 0 }, "token-1");
      await runtimeClient.startRun({
        workspaceId: "workspace-alpha",
        systemId: "system:demo",
        versionId: "system:demo:v1",
        async: true,
      }, "token-1");

      expect(recordedRequests.map((request) => request.method)).toEqual(["GET", "POST"]);
      expect(recordedRequests[0]?.url).toBe("http://127.0.0.1:8788/api/v1/workspaces?limit=5&offset=0");
      expect(recordedRequests[1]?.url).toBe("http://127.0.0.1:8788/api/v1/runtime/runs/start?workspaceId=workspace-alpha");
      expect(recordedRequests[0]?.authorization).toBe("Bearer token-1");
      expect(recordedRequests[1]?.authorization).toBe("Bearer token-1");

      const forbiddenWorkspaceClient = new HttpWorkspaceAdministrationClient("http://127.0.0.1:8788", {
        fetchImplementation: async () => new Response(JSON.stringify({
          ok: false,
          error: {
            code: "forbidden",
            message: "forbidden",
          },
        }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      });
      const forbidden = await forbiddenWorkspaceClient.listWorkspaces({}, "token-1");
      expect(forbidden.ok).toBeFalse();
      expect(forbidden.error?.sharedCode).toBe("forbidden");

      const failingRuntimeClient = new HttpRuntimeControlClient("http://127.0.0.1:8788", {
        fetchImplementation: async () => {
          throw new Error("network unavailable");
        },
      });
      const transportFailure = await failingRuntimeClient.startRun({
        workspaceId: "workspace-alpha",
        systemId: "system:demo",
        versionId: "system:demo:v1",
      }, "token-1");
      expect(transportFailure.ok).toBeFalse();
      expect(transportFailure.error?.sharedCode).toBe("temporarily-unavailable");

      const sockets: FakeRuntimeRealtimeSocket[] = [];
      const realtimeService = new RuntimeRealtimeSubscriptionService({
        sessionStore: {
          getSession: () => store.getSession(),
          isSessionExpired: (session) => store.isSessionExpired(session),
        },
        socketFactory: (_url, _protocols) => {
          const socket = new FakeRuntimeRealtimeSocket();
          sockets.push(socket);
          return socket;
        },
        reconnectDelayMs: 0,
        fallbackRefreshIntervalMs: 0,
      });

      const subscription = realtimeService.subscribeOperationalUpdates({
        executionId: "execution-1",
      });

      expect(sockets).toHaveLength(1);
      const socket = sockets[0]!;
      socket.emitOpen();
      expect(socket.sent).toHaveLength(1);
      const subscribePayload = JSON.parse(socket.sent[0] ?? "{}") as {
        readonly action: string;
        readonly request: {
          readonly topics: ReadonlyArray<{ readonly topic: string; readonly workspaceId?: string; readonly executionId?: string }>;
        };
      };
      expect(subscribePayload.action).toBe("runtime-realtime.subscribe");
      expect(subscribePayload.request.topics).toEqual([
        { topic: "runtime.run.status", workspaceId: "workspace-alpha", executionId: "execution-1" },
        { topic: "runtime.queue", workspaceId: "workspace-alpha" },
        { topic: "runtime.connectivity", workspaceId: "workspace-alpha" },
      ]);

      subscription.unsubscribe();
    });
  }
});

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

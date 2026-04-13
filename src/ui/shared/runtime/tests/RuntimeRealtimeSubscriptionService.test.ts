import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeStates,
} from "../../../../../electron/shared/DesktopContracts";
import { resetDesktopPostLoginWarmupStateForTests } from "../../../runtime/DesktopPostLoginWarmup";
import {
  RuntimeRealtimeSubscriptionService,
  type RuntimeRealtimeDocumentLifecycleTarget,
  type RuntimeRealtimeWindowLifecycleTarget,
  type RuntimeRealtimeSocket,
  type RuntimeRealtimeSocketCloseEvent,
  type RuntimeRealtimeSocketEvent,
} from "../RuntimeRealtimeSubscriptionService";

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
    // no-op in test socket
  }

  public emitOpen(): void {
    this.onopen?.();
  }

  public emitMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  public emitClose(event: RuntimeRealtimeSocketCloseEvent): void {
    this.onclose?.(event);
  }
}

class FakeDocumentLifecycleTarget implements RuntimeRealtimeDocumentLifecycleTarget {
  private readonly listeners = new Set<() => void>();
  public visibilityState: "hidden" | "visible" | "prerender" = "visible";

  public addEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.add(listener);
  }

  public removeEventListener(_type: "visibilitychange", listener: () => void): void {
    this.listeners.delete(listener);
  }

  public emitVisibilityChange(state: "hidden" | "visible" | "prerender"): void {
    this.visibilityState = state;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

class FakeWindowLifecycleTarget implements RuntimeRealtimeWindowLifecycleTarget {
  private readonly listeners = new Map<"online" | "focus" | "pageshow", Set<() => void>>([
    ["online", new Set()],
    ["focus", new Set()],
    ["pageshow", new Set()],
  ]);

  public addEventListener(type: "online" | "focus" | "pageshow", listener: () => void): void {
    this.listeners.get(type)?.add(listener);
  }

  public removeEventListener(type: "online" | "focus" | "pageshow", listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  public emit(type: "online" | "focus" | "pageshow"): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener();
    }
  }
}

describe("RuntimeRealtimeSubscriptionService", () => {
  afterEach(() => {
    resetDesktopPostLoginWarmupStateForTests();
    delete (globalThis as { window?: Window }).window;
  });

  it("subscribes with canonical topics and routes queue/run/connectivity events", async () => {
    const sockets: FakeRuntimeRealtimeSocket[] = [];
    const openedProtocols: ReadonlyArray<string>[] = [];
    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: {
        getSession: () => Object.freeze({
          userIdentityId: "user-1",
          username: "user",
          providerId: "local",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer" as const,
          sessionIssuedAt: "2026-04-07T11:00:00.000Z",
          sessionExpiresAt: "2026-04-07T23:00:00.000Z",
          sessionAccessChannel: "desktop" as const,
          workspaceContext: Object.freeze({
            requestedWorkspaceId: "workspace-requested",
            resolvedWorkspaceId: "workspace-resolved",
            workspaces: Object.freeze([]),
          }),
        }),
        isSessionExpired: () => false,
      },
      socketFactory: (_url, protocols) => {
        openedProtocols.push(protocols);
        const socket = new FakeRuntimeRealtimeSocket();
        sockets.push(socket);
        return socket;
      },
      reconnectDelayMs: 0,
      fallbackRefreshIntervalMs: 0,
    });

    const onRunStatusEvent = mock(() => undefined);
    const onQueueMovementEvent = mock(() => undefined);
    const onRuntimeConnectivityEvent = mock(() => undefined);
    const onConnectionStateChanged = mock(() => undefined);

    const subscription = service.subscribeOperationalUpdates({
      executionId: "exec-1",
      onRunStatusEvent,
      onQueueMovementEvent,
      onRuntimeConnectivityEvent,
      onConnectionStateChanged,
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
      { topic: "runtime.run.status", workspaceId: "workspace-resolved", executionId: "exec-1" },
      { topic: "runtime.queue", workspaceId: "workspace-resolved" },
      { topic: "runtime.connectivity", workspaceId: "workspace-resolved" },
    ]);
    expect(openedProtocols[0]?.[0]).toBe("ai-loom-runtime-realtime.v1");
    expect(openedProtocols[0]?.[1]?.startsWith("ai-loom-auth-bearer.")).toBeTrue();

    socket.emitMessage({
      type: "runtime-realtime.subscription-ack",
      subscriptionId: "sub-1",
      acceptedAt: "2026-04-07T12:00:00.000Z",
      mode: "live-only",
      topics: subscribePayload.request.topics,
    });
    socket.emitMessage({
      type: "runtime-realtime.event",
      event: {
        eventId: "event-1",
        schemaVersion: "2026-04-07",
        emittedAt: "2026-04-07T12:00:00.000Z",
        sequence: 1,
        cursor: "runtime-realtime:1",
        category: "run-status",
        topic: "runtime.run.status",
        workspaceScope: { workspaceId: "workspace-resolved" },
        actorScope: { actorUserIdentityId: "user-1", sessionId: "session-1" },
        runScope: { executionId: "exec-1" },
        payload: {
          executionId: "exec-1",
          status: "running",
          changedAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    socket.emitMessage({
      type: "runtime-realtime.event",
      event: {
        eventId: "event-2",
        schemaVersion: "2026-04-07",
        emittedAt: "2026-04-07T12:00:00.000Z",
        sequence: 2,
        cursor: "runtime-realtime:2",
        category: "queue-movement",
        topic: "runtime.queue",
        workspaceScope: { workspaceId: "workspace-resolved" },
        actorScope: { actorUserIdentityId: "user-1", sessionId: "session-1" },
        runScope: { executionId: "exec-1" },
        payload: {
          queueItemId: "runtime-queue:exec-1",
          executionId: "exec-1",
          status: "running",
          changedAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    socket.emitMessage({
      type: "runtime-realtime.event",
      event: {
        eventId: "event-3",
        schemaVersion: "2026-04-07",
        emittedAt: "2026-04-07T12:00:00.000Z",
        sequence: 3,
        cursor: "runtime-realtime:3",
        category: "connectivity-state",
        topic: "runtime.connectivity",
        workspaceScope: { workspaceId: "workspace-resolved" },
        actorScope: { actorUserIdentityId: "user-1", sessionId: "session-1" },
        runScope: {},
        payload: {
          state: "connected",
          observedAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });

    expect(onRunStatusEvent).toHaveBeenCalledTimes(1);
    expect(onQueueMovementEvent).toHaveBeenCalledTimes(1);
    expect(onRuntimeConnectivityEvent).toHaveBeenCalledTimes(1);
    expect(onConnectionStateChanged).toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("resumes from cursor after reconnect and runs fallback refresh while stale", async () => {
    const sockets: FakeRuntimeRealtimeSocket[] = [];
    const fallbackRefresh = mock(async () => undefined);
    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: {
        getSession: () => Object.freeze({
          userIdentityId: "user-1",
          username: "user",
          providerId: "local",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer" as const,
          sessionIssuedAt: "2026-04-07T11:00:00.000Z",
          sessionExpiresAt: "2026-04-07T23:00:00.000Z",
          sessionAccessChannel: "desktop" as const,
          workspaceContext: Object.freeze({
            requestedWorkspaceId: "workspace-requested",
            resolvedWorkspaceId: "workspace-resolved",
            workspaces: Object.freeze([]),
          }),
        }),
        isSessionExpired: () => false,
      },
      socketFactory: (_url, _protocols) => {
        const socket = new FakeRuntimeRealtimeSocket();
        sockets.push(socket);
        return socket;
      },
      reconnectDelayMs: 0,
      fallbackRefreshIntervalMs: 0,
    });

    const subscription = service.subscribeOperationalUpdates({
      fallbackRefresh,
    });

    const firstSocket = sockets[0]!;
    firstSocket.emitOpen();
    firstSocket.emitMessage({
      type: "runtime-realtime.subscription-ack",
      subscriptionId: "sub-1",
      acceptedAt: "2026-04-07T12:00:00.000Z",
      mode: "live-only",
      topics: [{ topic: "runtime.queue", workspaceId: "workspace-resolved" }],
    });
    firstSocket.emitMessage({
      type: "runtime-realtime.event",
      event: {
        eventId: "event-1",
        schemaVersion: "2026-04-07",
        emittedAt: "2026-04-07T12:00:00.000Z",
        sequence: 1,
        cursor: "runtime-realtime:12",
        category: "queue-movement",
        topic: "runtime.queue",
        workspaceScope: { workspaceId: "workspace-resolved" },
        actorScope: { actorUserIdentityId: "user-1", sessionId: "session-1" },
        runScope: {},
        payload: {
          queueItemId: "runtime-queue:exec-1",
          executionId: "exec-1",
          status: "queued",
          changedAt: "2026-04-07T12:00:00.000Z",
        },
      },
    });
    firstSocket.emitClose({ code: 1006, reason: "connection lost" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fallbackRefresh).toHaveBeenCalled();
    expect(sockets).toHaveLength(2);
    const secondSocket = sockets[1]!;
    secondSocket.emitOpen();
    const reconnectSubscribe = JSON.parse(secondSocket.sent[0] ?? "{}") as {
      readonly request: {
        readonly mode?: string;
        readonly reconnect?: { readonly afterCursor?: string };
      };
    };
    expect(reconnectSubscribe.request.mode).toBe("resume-from-cursor");
    expect(reconnectSubscribe.request.reconnect?.afterCursor).toBe("runtime-realtime:12");
    subscription.unsubscribe();
  });

  it("reports a session error when an active authenticated context is unavailable", () => {
    const onError = mock(() => undefined);
    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: {
        getSession: () => undefined,
        isSessionExpired: () => true,
      },
      socketFactory: () => new FakeRuntimeRealtimeSocket(),
    });

    service.subscribeOperationalUpdates({ onError });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("forces reconnect and refresh on browser lifecycle resume while stale", () => {
    const sockets: FakeRuntimeRealtimeSocket[] = [];
    const fallbackRefresh = mock(async () => undefined);
    const lifecycleDocument = new FakeDocumentLifecycleTarget();
    const lifecycleWindow = new FakeWindowLifecycleTarget();
    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: {
        getSession: () => Object.freeze({
          userIdentityId: "user-1",
          username: "user",
          providerId: "local",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer" as const,
          sessionIssuedAt: "2026-04-07T11:00:00.000Z",
          sessionExpiresAt: "2026-04-07T23:00:00.000Z",
          sessionAccessChannel: "thin-client" as const,
          workspaceContext: Object.freeze({
            requestedWorkspaceId: "workspace-requested",
            resolvedWorkspaceId: "workspace-resolved",
            workspaces: Object.freeze([]),
          }),
        }),
        isSessionExpired: () => false,
      },
      lifecycleBindings: {
        document: lifecycleDocument,
        window: lifecycleWindow,
      },
      socketFactory: (_url, _protocols) => {
        const socket = new FakeRuntimeRealtimeSocket();
        sockets.push(socket);
        return socket;
      },
      reconnectDelayMs: 10_000,
      fallbackRefreshIntervalMs: 0,
    });

    const subscription = service.subscribeOperationalUpdates({
      fallbackRefresh,
    });

    const firstSocket = sockets[0]!;
    firstSocket.emitOpen();
    firstSocket.emitMessage({
      type: "runtime-realtime.subscription-ack",
      subscriptionId: "sub-1",
      acceptedAt: "2026-04-07T12:00:00.000Z",
      mode: "live-only",
      topics: [{ topic: "runtime.queue", workspaceId: "workspace-resolved" }],
    });
    firstSocket.emitClose({ code: 1006, reason: "connection lost" });

    lifecycleWindow.emit("online");

    expect(sockets).toHaveLength(2);
    expect(fallbackRefresh).toHaveBeenCalled();
    const reconnectSocket = sockets[1]!;
    reconnectSocket.emitOpen();
    const reconnectSubscribe = JSON.parse(reconnectSocket.sent[0] ?? "{}") as {
      readonly action: string;
    };
    expect(reconnectSubscribe.action).toBe("runtime-realtime.subscribe");

    lifecycleDocument.emitVisibilityChange("hidden");
    const socketCountBeforeHiddenResume = sockets.length;
    lifecycleWindow.emit("focus");
    expect(sockets).toHaveLength(socketCountBeforeHiddenResume);

    subscription.unsubscribe();
  });

  it("blocks desktop subscriptions while lifecycle readiness is unavailable", () => {
    const sockets: FakeRuntimeRealtimeSocket[] = [];
    const onError = mock(() => undefined);
    const onConnectionStateChanged = mock(() => undefined);

    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            getLifecycleStatus: () => ({
              host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
              state: DesktopPostLoginRuntimeStates.warming,
              capabilityPhase: DesktopPostLoginRuntimeStates.warming,
              unavailableReason: "pre-login",
              updatedAt: "2026-04-13T10:00:00.000Z",
              transport: {
                phase: DesktopControlPlaneTransportPhases.available,
                updatedAt: "2026-04-13T10:00:00.000Z",
              },
            }),
            isCapabilityReady: () => false,
            activateCapabilities: async () => undefined,
          },
        },
      },
    } as unknown as Window;

    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: {
        getSession: () => Object.freeze({
          userIdentityId: "user-1",
          username: "user",
          providerId: "local",
          sessionId: "session-1",
          sessionToken: "token-1",
          sessionTokenType: "Bearer" as const,
          sessionIssuedAt: "2026-04-07T11:00:00.000Z",
          sessionExpiresAt: "2026-04-07T23:00:00.000Z",
          sessionAccessChannel: "desktop" as const,
          workspaceContext: Object.freeze({
            requestedWorkspaceId: "workspace-requested",
            resolvedWorkspaceId: "workspace-resolved",
            workspaces: Object.freeze([]),
          }),
        }),
        isSessionExpired: () => false,
      },
      socketFactory: (_url, _protocols) => {
        const socket = new FakeRuntimeRealtimeSocket();
        sockets.push(socket);
        return socket;
      },
    });

    service.subscribeOperationalUpdates({
      onError,
      onConnectionStateChanged,
    });

    expect(sockets).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as string | undefined)?.includes("Desktop runtime APIs are unavailable")).toBeTrue();
    expect(onConnectionStateChanged).toHaveBeenCalledTimes(1);
  });
});

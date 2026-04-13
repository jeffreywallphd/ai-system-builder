import { afterEach, describe, expect, it, mock } from "bun:test";
import type { RuntimeControlClient } from "@shared/runtime/RuntimeControlClient";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../electron/shared/DesktopContracts";
import type { IdentityAuthPersistedSession } from "../../shared/identity/IdentityAuthSessionStore";
import { RuntimeOperationsService } from "../../services/RuntimeOperationsService";
import {
  requestDesktopPostLoginWarmup,
  resetDesktopPostLoginWarmupStateForTests,
} from "../DesktopPostLoginWarmup";
import {
  RuntimeRealtimeSubscriptionService,
  type RuntimeRealtimeSocket,
  type RuntimeRealtimeSocketCloseEvent,
  type RuntimeRealtimeSocketEvent,
} from "../../shared/runtime/RuntimeRealtimeSubscriptionService";

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
    // no-op in tests
  }

  public emitOpen(): void {
    this.onopen?.();
  }
}

function createRuntimeStatus(
  state: DesktopPostLoginRuntimeStatus["state"],
): DesktopPostLoginRuntimeStatus {
  const updatedAt = "2026-04-13T10:00:00.000Z";
  return Object.freeze({
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: state,
    unavailableReason: state === DesktopPostLoginRuntimeStates.ready ? undefined : "pre-login",
    updatedAt,
    transport: Object.freeze({
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    }),
  });
}

function createSessionStore(session: {
  current: IdentityAuthPersistedSession | undefined;
}): IdentityAuthSessionStore {
  return {
    getSession: () => session.current,
    isSessionExpired: () => false,
  } as unknown as IdentityAuthSessionStore;
}

function createAuthenticatedSession(): IdentityAuthPersistedSession {
  return Object.freeze({
    userIdentityId: "user-1",
    username: "user",
    providerId: "local",
    sessionId: "session-1",
    sessionToken: "token-1",
    sessionTokenType: "Bearer",
    sessionIssuedAt: "2026-04-13T09:00:00.000Z",
    sessionExpiresAt: "2026-04-13T23:00:00.000Z",
    sessionAccessChannel: "desktop",
    workspaceContext: Object.freeze({
      requestedWorkspaceId: "workspace-requested",
      resolvedWorkspaceId: "workspace-resolved",
      workspaces: Object.freeze([]),
    }),
  });
}

function createRuntimeControlClient(): RuntimeControlClient {
  return {
    startRun: mock(async () => ({ ok: true, data: {} as never })),
    cancelRun: mock(async () => ({ ok: true, data: {} as never })),
    getRunStatus: mock(async () => ({ ok: true, data: {} as never })),
    getRunResult: mock(async () => ({ ok: true, data: {} as never })),
    getRunTrace: mock(async () => ({ ok: true, data: {} as never })),
    listQueueItems: mock(async () => ({ ok: true, data: { items: [], totalCount: 0 } })),
    dequeueQueueItem: mock(async () => ({ ok: true, data: {} as never })),
    getExecutionReadiness: mock(async () => ({
      ok: true,
      data: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        checkedAt: "2026-04-13T10:01:00.000Z",
        readiness: "ready",
        readyForExecution: true,
        capabilities: Object.freeze({
          backendFamily: "adapter.comfyui.image-manipulation",
          supportsProgressPolling: true,
          supportsProgressStreaming: false,
          supportsCancellation: true,
          supportsOutputDiscovery: true,
          supportedOperationKinds: Object.freeze(["image-to-image"]),
          supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
        }),
        nodeAvailability: Object.freeze({
          state: "available",
          checkedAt: "2026-04-13T10:01:00.000Z",
          candidateNodeCount: 1,
          eligibleNodeCount: 1,
          unavailableNodeCount: 0,
          incompatibleNodeCount: 0,
          topBlockingReasonCodes: Object.freeze([]),
          topTransientAvailabilityReasonCodes: Object.freeze([]),
        }),
        issues: Object.freeze([]),
      }),
    })),
  };
}

describe("Desktop runtime startup UX regression coverage", () => {
  afterEach(() => {
    resetDesktopPostLoginWarmupStateForTests();
    delete (globalThis as { window?: Window }).window;
  });

  it("keeps image-manipulation readiness lifecycle-gated through login/warmup and becomes usable once activated", async () => {
    let runtimeStatus = createRuntimeStatus(DesktopPostLoginRuntimeStates.warming);
    const activateCapabilities = mock(async () => {
      runtimeStatus = createRuntimeStatus(DesktopPostLoginRuntimeStates.ready);
    });
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            getLifecycleStatus: () => runtimeStatus,
            isCapabilityReady: () => runtimeStatus.state === DesktopPostLoginRuntimeStates.ready,
            activateCapabilities,
          },
        },
      },
    } as unknown as Window;

    const session = { current: undefined as IdentityAuthPersistedSession | undefined };
    const client = createRuntimeControlClient();
    const service = new RuntimeOperationsService(client, createSessionStore(session));

    const preLogin = await service.getExecutionReadiness({
      systemId: "asset:workflow:image-manipulation",
    });
    expect(preLogin.ok).toBeFalse();
    expect(preLogin.error?.code).toBe("unauthorized");
    expect(client.getExecutionReadiness).toHaveBeenCalledTimes(0);

    session.current = createAuthenticatedSession();
    const warming = await service.getExecutionReadiness({
      systemId: "asset:workflow:image-manipulation",
    });
    expect(warming.ok).toBeFalse();
    expect(warming.error?.code).toBe("AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE");
    expect(warming.error?.message).toContain("Current runtime state: warming");
    expect(warming.error?.message.toLowerCase()).not.toContain("connection refused");
    expect(warming.error?.message.toLowerCase()).not.toContain("econnrefused");
    expect(client.getExecutionReadiness).toHaveBeenCalledTimes(0);

    await requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRestore);
    expect(activateCapabilities).toHaveBeenCalledTimes(1);

    const ready = await service.getExecutionReadiness({
      systemId: "asset:workflow:image-manipulation",
    });
    expect(ready.ok).toBeTrue();
    expect(ready.data?.backendFamily).toBe("adapter.comfyui.image-manipulation");
    expect(ready.data?.readyForExecution).toBeTrue();
    expect(client.getExecutionReadiness).toHaveBeenCalledTimes(1);
  });

  it("defers realtime socket connection during warmup and connects after runtime activation", async () => {
    let runtimeStatus = createRuntimeStatus(DesktopPostLoginRuntimeStates.warming);
    const activateCapabilities = mock(async () => {
      runtimeStatus = createRuntimeStatus(DesktopPostLoginRuntimeStates.ready);
    });
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            getLifecycleStatus: () => runtimeStatus,
            isCapabilityReady: () => runtimeStatus.state === DesktopPostLoginRuntimeStates.ready,
            activateCapabilities,
          },
        },
      },
    } as unknown as Window;

    const sockets: FakeRuntimeRealtimeSocket[] = [];
    const onError = mock((_message: string) => undefined);
    const service = new RuntimeRealtimeSubscriptionService({
      sessionStore: createSessionStore({ current: createAuthenticatedSession() }),
      socketFactory: (_url, _protocols) => {
        const socket = new FakeRuntimeRealtimeSocket();
        sockets.push(socket);
        return socket;
      },
      reconnectDelayMs: 0,
      fallbackRefreshIntervalMs: 0,
    });

    const warmingSubscription = service.subscribeOperationalUpdates({ onError });
    expect(sockets).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    const warmingError = onError.mock.calls[0]?.[0] as string | undefined;
    expect(warmingError?.includes("Desktop runtime APIs are unavailable")).toBeTrue();
    expect(warmingError?.toLowerCase().includes("connection refused")).toBeFalse();
    expect(warmingError?.toLowerCase().includes("econnrefused")).toBeFalse();

    await requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRestore);

    const readySubscription = service.subscribeOperationalUpdates({
      executionId: "execution-1",
      onError,
    });
    expect(sockets).toHaveLength(1);
    const readySocket = sockets[0]!;
    readySocket.emitOpen();
    const subscribePayload = JSON.parse(readySocket.sent[0] ?? "{}") as {
      readonly action?: string;
      readonly request?: {
        readonly topics?: ReadonlyArray<{
          readonly topic?: string;
          readonly executionId?: string;
        }>;
      };
    };
    expect(subscribePayload.action).toBe("runtime-realtime.subscribe");
    expect(subscribePayload.request?.topics?.[0]?.topic).toBe("runtime.run.status");
    expect(subscribePayload.request?.topics?.[0]?.executionId).toBe("execution-1");

    warmingSubscription.unsubscribe();
    readySubscription.unsubscribe();
  });
});

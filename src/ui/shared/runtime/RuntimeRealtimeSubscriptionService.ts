import {
  RuntimeRealtimeConnectivityStates,
  RuntimeRealtimeEventCategories,
  RuntimeRealtimeSubscriptionModes,
  RuntimeRealtimeTopics,
  RuntimeRealtimeWebSocketActions,
  RuntimeRealtimeWebSocketMessageTypes,
  type RuntimeRealtimeConnectivityStatePayload,
  type RuntimeRealtimeEventEnvelope,
  type RuntimeRealtimeQueueMovementPayload,
  type RuntimeRealtimeRunStatusPayload,
  type RuntimeRealtimeSubscriptionTopic,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  parseRuntimeRealtimeWebSocketErrorMessage,
  parseRuntimeRealtimeWebSocketEventMessage,
  parseRuntimeRealtimeWebSocketSubscriptionAckMessage,
} from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";
import {
  IdentityAuthSessionStore,
  type IdentityAuthPersistedSession,
} from "@shared/identity/IdentityAuthSessionStore";
import { resolveDesktopIdentityApiBaseUrl } from "../../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../../web/identity/resolveWebIdentityApiBaseUrl";

const DEFAULT_RECONNECT_DELAY_MS = 1_500;
const DEFAULT_FALLBACK_REFRESH_INTERVAL_MS = 8_000;
const RUNTIME_REALTIME_PROTOCOL = "ai-loom-runtime-realtime.v1";
const RUNTIME_REALTIME_AUTH_PROTOCOL_PREFIX = "ai-loom-auth-bearer.";

export type RuntimeRealtimeOperationalConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"
  | "disconnected";

export interface RuntimeRealtimeConnectionStateSnapshot {
  readonly state: RuntimeRealtimeOperationalConnectionState;
  readonly stale: boolean;
  readonly detail?: string;
}

export interface RuntimeRealtimeOperationalSubscriptionOptions {
  readonly executionId?: string;
  readonly onRunStatusEvent?: (
    payload: RuntimeRealtimeRunStatusPayload,
    event: RuntimeRealtimeEventEnvelope,
  ) => void;
  readonly onQueueMovementEvent?: (
    payload: RuntimeRealtimeQueueMovementPayload,
    event: RuntimeRealtimeEventEnvelope,
  ) => void;
  readonly onRuntimeConnectivityEvent?: (
    payload: RuntimeRealtimeConnectivityStatePayload,
    event: RuntimeRealtimeEventEnvelope,
  ) => void;
  readonly onConnectionStateChanged?: (state: RuntimeRealtimeConnectionStateSnapshot) => void;
  readonly onError?: (message: string) => void;
  readonly fallbackRefresh?: () => Promise<void>;
}

export interface RuntimeRealtimeOperationalSubscription {
  unsubscribe(): void;
}

export interface RuntimeRealtimeSocketEvent {
  readonly data: string;
}

export interface RuntimeRealtimeSocketCloseEvent {
  readonly code: number;
  readonly reason?: string;
}

export interface RuntimeRealtimeSocket {
  onopen: (() => void) | null;
  onmessage: ((event: RuntimeRealtimeSocketEvent) => void) | null;
  onclose: ((event: RuntimeRealtimeSocketCloseEvent) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type RuntimeRealtimeSocketFactory = (
  url: string,
  protocols: ReadonlyArray<string>,
) => RuntimeRealtimeSocket;

export interface RuntimeRealtimeSubscriptionServiceOptions {
  readonly sessionStore?: Pick<IdentityAuthSessionStore, "getSession" | "isSessionExpired">;
  readonly socketFactory?: RuntimeRealtimeSocketFactory;
  readonly lifecycleBindings?: RuntimeRealtimeLifecycleBindings;
  readonly reconnectDelayMs?: number;
  readonly fallbackRefreshIntervalMs?: number;
}

export interface RuntimeRealtimeDocumentLifecycleTarget {
  readonly visibilityState?: "hidden" | "visible" | "prerender";
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface RuntimeRealtimeWindowLifecycleTarget {
  addEventListener(type: "online" | "focus" | "pageshow", listener: () => void): void;
  removeEventListener(type: "online" | "focus" | "pageshow", listener: () => void): void;
}

export interface RuntimeRealtimeLifecycleBindings {
  readonly document?: RuntimeRealtimeDocumentLifecycleTarget;
  readonly window?: RuntimeRealtimeWindowLifecycleTarget;
}

export class RuntimeRealtimeSubscriptionService {
  private readonly sessionStore: Pick<IdentityAuthSessionStore, "getSession" | "isSessionExpired">;
  private readonly socketFactory: RuntimeRealtimeSocketFactory;
  private readonly lifecycleBindings: RuntimeRealtimeLifecycleBindings;
  private readonly reconnectDelayMs: number;
  private readonly fallbackRefreshIntervalMs: number;

  public constructor(options?: RuntimeRealtimeSubscriptionServiceOptions) {
    this.sessionStore = options?.sessionStore ?? new IdentityAuthSessionStore();
    this.socketFactory = options?.socketFactory ?? defaultRuntimeRealtimeSocketFactory;
    this.lifecycleBindings = options?.lifecycleBindings ?? resolveDefaultRuntimeRealtimeLifecycleBindings();
    this.reconnectDelayMs = Math.max(0, options?.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
    this.fallbackRefreshIntervalMs = Math.max(0, options?.fallbackRefreshIntervalMs ?? DEFAULT_FALLBACK_REFRESH_INTERVAL_MS);
  }

  public subscribeOperationalUpdates(
    options: RuntimeRealtimeOperationalSubscriptionOptions,
  ): RuntimeRealtimeOperationalSubscription {
    const sessionContext = resolveRealtimeSessionContext(this.sessionStore);
    if (!sessionContext.ok) {
      options.onConnectionStateChanged?.(Object.freeze({
        state: "disconnected",
        stale: true,
        detail: sessionContext.error,
      }));
      options.onError?.(sessionContext.error);
      return Object.freeze({ unsubscribe: () => undefined });
    }

    const topicExecutionId = normalizeOptionalString(options.executionId);
    const requestedTopics = buildRequestedTopics(sessionContext.value.workspaceId, topicExecutionId);

    let disposed = false;
    let socket: RuntimeRealtimeSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackRefreshTimer: ReturnType<typeof setInterval> | undefined;
    let refreshInFlight = false;
    let lifecycleRefreshQueued = false;
    let currentConnectionState: RuntimeRealtimeConnectionStateSnapshot = Object.freeze({
      state: "connecting",
      stale: false,
    });
    let lastCursor: string | undefined;

    const publishConnectionState = (next: RuntimeRealtimeConnectionStateSnapshot): void => {
      currentConnectionState = next;
      options.onConnectionStateChanged?.(next);
    };

    const runFallbackRefresh = async (): Promise<void> => {
      if (!options.fallbackRefresh || refreshInFlight || disposed) {
        return;
      }
      refreshInFlight = true;
      try {
        await options.fallbackRefresh();
      } catch {
        options.onError?.("Failed to refresh runtime operational data after realtime changes.");
      } finally {
        refreshInFlight = false;
        if (lifecycleRefreshQueued) {
          lifecycleRefreshQueued = false;
          void runFallbackRefresh();
        }
      }
    };

    const queueFallbackRefresh = (): void => {
      if (!options.fallbackRefresh || disposed) {
        return;
      }
      if (refreshInFlight) {
        lifecycleRefreshQueued = true;
        return;
      }
      void runFallbackRefresh();
    };

    const clearReconnect = (): void => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    };

    const stopFallbackRefreshLoop = (): void => {
      if (fallbackRefreshTimer) {
        clearInterval(fallbackRefreshTimer);
        fallbackRefreshTimer = undefined;
      }
    };

    const startFallbackRefreshLoop = (): void => {
      if (!options.fallbackRefresh || fallbackRefreshTimer || disposed) {
        return;
      }
      void runFallbackRefresh();
      fallbackRefreshTimer = setInterval(() => {
        void runFallbackRefresh();
      }, this.fallbackRefreshIntervalMs);
    };

    const scheduleReconnect = (): void => {
      if (reconnectTimer || disposed) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, this.reconnectDelayMs);
    };

    const closeSocketSilently = (reason: string): void => {
      const active = socket;
      socket = undefined;
      if (!active) {
        return;
      }
      active.onopen = null;
      active.onmessage = null;
      active.onclose = null;
      active.onerror = null;
      active.close(1000, reason);
    };

    const restartConnectionForLifecycleResume = (): void => {
      if (disposed) {
        return;
      }
      clearReconnect();
      closeSocketSilently("client-reconnect");
      publishConnectionState(Object.freeze({
        state: "connecting",
        stale: true,
        detail: "Revalidating realtime channel after lifecycle resume.",
      }));
      startFallbackRefreshLoop();
      queueFallbackRefresh();
      connect();
    };

    const handleEventEnvelope = (event: RuntimeRealtimeEventEnvelope): void => {
      lastCursor = event.cursor;

      switch (event.category) {
        case RuntimeRealtimeEventCategories.runStatus: {
          const payload = event.payload as RuntimeRealtimeRunStatusPayload;
          options.onRunStatusEvent?.(payload, event);
          return;
        }
        case RuntimeRealtimeEventCategories.queueMovement: {
          const payload = event.payload as RuntimeRealtimeQueueMovementPayload;
          options.onQueueMovementEvent?.(payload, event);
          return;
        }
        case RuntimeRealtimeEventCategories.connectivityState: {
          const payload = event.payload as RuntimeRealtimeConnectivityStatePayload;
          options.onRuntimeConnectivityEvent?.(payload, event);
          if (payload.state === RuntimeRealtimeConnectivityStates.reconnecting) {
            publishConnectionState(Object.freeze({
              state: "reconnecting",
              stale: true,
              detail: payload.reason,
            }));
            startFallbackRefreshLoop();
          } else if (payload.state === RuntimeRealtimeConnectivityStates.degraded) {
            publishConnectionState(Object.freeze({
              state: "degraded",
              stale: true,
              detail: payload.reason,
            }));
            startFallbackRefreshLoop();
          } else if (payload.state === RuntimeRealtimeConnectivityStates.disconnected) {
            publishConnectionState(Object.freeze({
              state: "disconnected",
              stale: true,
              detail: payload.reason,
            }));
            startFallbackRefreshLoop();
          }
          return;
        }
        default:
          return;
      }
    };

    const connect = (): void => {
      if (disposed) {
        return;
      }

      clearReconnect();
      publishConnectionState(Object.freeze({ state: "connecting", stale: currentConnectionState.stale }));

      const url = buildRuntimeRealtimeWebSocketUrl(sessionContext.value.workspaceId);
      const protocols = buildRuntimeRealtimeSocketProtocols(sessionContext.value.sessionToken);
      socket = this.socketFactory(url, protocols);

      socket.onopen = () => {
        if (disposed) {
          return;
        }
        const subscribeMessage = Object.freeze({
          action: RuntimeRealtimeWebSocketActions.subscribe,
          request: Object.freeze({
            topics: requestedTopics,
            mode: lastCursor
              ? RuntimeRealtimeSubscriptionModes.resumeFromCursor
              : RuntimeRealtimeSubscriptionModes.liveOnly,
            reconnect: lastCursor
              ? Object.freeze({ afterCursor: lastCursor })
              : undefined,
          }),
        });
        socket?.send(JSON.stringify(subscribeMessage));
      };

      socket.onmessage = (messageEvent) => {
        if (disposed) {
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(messageEvent.data);
        } catch {
          options.onError?.("Received malformed runtime realtime payload.");
          return;
        }

        try {
          const messageRecord = payload as Record<string, unknown>;
          if (messageRecord.type === RuntimeRealtimeWebSocketMessageTypes.subscriptionAck) {
            parseRuntimeRealtimeWebSocketSubscriptionAckMessage(payload);
            publishConnectionState(Object.freeze({ state: "connected", stale: false }));
            stopFallbackRefreshLoop();
            return;
          }

          if (messageRecord.type === RuntimeRealtimeWebSocketMessageTypes.event) {
            const parsedEvent = parseRuntimeRealtimeWebSocketEventMessage(payload);
            if (currentConnectionState.state !== "connected" || currentConnectionState.stale) {
              publishConnectionState(Object.freeze({ state: "connected", stale: false }));
              stopFallbackRefreshLoop();
              queueFallbackRefresh();
            }
            handleEventEnvelope(parsedEvent.event);
            return;
          }

          if (messageRecord.type === RuntimeRealtimeWebSocketMessageTypes.error) {
            const parsedError = parseRuntimeRealtimeWebSocketErrorMessage(payload);
            options.onError?.(parsedError.error.message);
            publishConnectionState(Object.freeze({
              state: parsedError.error.code === "forbidden" ? "disconnected" : "degraded",
              stale: true,
              detail: parsedError.error.message,
            }));
            startFallbackRefreshLoop();
            return;
          }
        } catch {
          options.onError?.("Runtime realtime payload failed shared schema validation.");
        }
      };

      socket.onerror = () => {
        if (disposed) {
          return;
        }

        publishConnectionState(Object.freeze({
          state: "degraded",
          stale: true,
          detail: "Runtime realtime transport encountered an error.",
        }));
        startFallbackRefreshLoop();
      };

      socket.onclose = (event) => {
        if (disposed) {
          return;
        }
        const isTerminal = event.code === 4401 || event.code === 4403;
        publishConnectionState(Object.freeze({
          state: isTerminal ? "disconnected" : "reconnecting",
          stale: true,
          detail: normalizeOptionalString(event.reason) ?? "Runtime realtime channel closed.",
        }));
        startFallbackRefreshLoop();
        if (!isTerminal) {
          scheduleReconnect();
        }
      };
    };

    const releaseLifecycleListeners = bindLifecycleResumeListeners(this.lifecycleBindings, () => {
      if (disposed) {
        return;
      }

      const isVisible = this.lifecycleBindings.document?.visibilityState !== "hidden";
      if (!isVisible) {
        return;
      }

      if (currentConnectionState.state === "connected" && !currentConnectionState.stale) {
        queueFallbackRefresh();
        return;
      }

      restartConnectionForLifecycleResume();
    });

    connect();

    return Object.freeze({
      unsubscribe: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        clearReconnect();
        stopFallbackRefreshLoop();
        releaseLifecycleListeners();
        closeSocketSilently("client-disposed");
      },
    });
  }
}

function resolveRealtimeSessionContext(sessionStore: Pick<IdentityAuthSessionStore, "getSession" | "isSessionExpired">):
  | { readonly ok: true; readonly value: { readonly sessionToken: string; readonly workspaceId: string; readonly actorUserIdentityId: string; readonly sessionId: string; readonly accessChannel: "desktop" | "thin-client" } }
  | { readonly ok: false; readonly error: string } {
  const session = sessionStore.getSession();
  if (!session || sessionStore.isSessionExpired(session)) {
    return Object.freeze({
      ok: false,
      error: "An active authenticated session is required for runtime realtime subscriptions.",
    });
  }

  const workspaceId = resolveWorkspaceId(session);
  if (!workspaceId) {
    return Object.freeze({
      ok: false,
      error: "No active workspace is available for runtime realtime subscriptions.",
    });
  }

  const actorUserIdentityId = normalizeOptionalString(session.userIdentityId);
  const sessionId = normalizeOptionalString(session.sessionId);
  if (!actorUserIdentityId || !sessionId) {
    return Object.freeze({
      ok: false,
      error: "Runtime realtime session context is invalid.",
    });
  }

  const accessChannel = session.sessionAccessChannel === "desktop"
    ? "desktop"
    : "thin-client";

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      sessionToken: session.sessionToken,
      workspaceId,
      actorUserIdentityId,
      sessionId,
      accessChannel,
    }),
  });
}

function resolveWorkspaceId(session: IdentityAuthPersistedSession): string | undefined {
  const workspaceId = session.workspaceContext?.resolvedWorkspaceId
    ?? session.workspaceContext?.requestedWorkspaceId
    ?? session.initialCapabilityState?.workspaceId;
  return normalizeOptionalString(workspaceId);
}

function buildRequestedTopics(
  workspaceId: string,
  executionId: string | undefined,
): ReadonlyArray<RuntimeRealtimeSubscriptionTopic> {
  return Object.freeze([
    Object.freeze({
      topic: RuntimeRealtimeTopics.runStatus,
      workspaceId,
      executionId,
    }),
    Object.freeze({
      topic: RuntimeRealtimeTopics.queue,
      workspaceId,
    }),
    Object.freeze({
      topic: RuntimeRealtimeTopics.connectivity,
      workspaceId,
    }),
  ]);
}

function buildRuntimeRealtimeWebSocketUrl(workspaceId: string): string {
  const baseUrl = resolveDesktopIdentityApiBaseUrl() ?? resolveWebIdentityApiBaseUrl();
  const httpUrl = new URL(baseUrl);
  const wsProtocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = new URL(`${wsProtocol}//${httpUrl.host}/ws`);
  wsUrl.searchParams.set("purpose", "run-monitoring");
  wsUrl.searchParams.set("workspaceId", workspaceId);
  return wsUrl.toString();
}

function defaultRuntimeRealtimeSocketFactory(url: string, protocols: ReadonlyArray<string>): RuntimeRealtimeSocket {
  const socket = new WebSocket(url, [...protocols]);
  return socket as unknown as RuntimeRealtimeSocket;
}

function resolveDefaultRuntimeRealtimeLifecycleBindings(): RuntimeRealtimeLifecycleBindings {
  const scope = globalThis as unknown as {
    readonly document?: RuntimeRealtimeDocumentLifecycleTarget;
    readonly window?: RuntimeRealtimeWindowLifecycleTarget;
  };
  return Object.freeze({
    document: scope.document,
    window: scope.window,
  });
}

function bindLifecycleResumeListeners(
  lifecycleBindings: RuntimeRealtimeLifecycleBindings,
  onResume: () => void,
): () => void {
  const releaseCallbacks: Array<() => void> = [];

  if (lifecycleBindings.document) {
    const onVisibilityChanged = () => {
      if (lifecycleBindings.document?.visibilityState === "visible") {
        onResume();
      }
    };
    lifecycleBindings.document.addEventListener("visibilitychange", onVisibilityChanged);
    releaseCallbacks.push(() => {
      lifecycleBindings.document?.removeEventListener("visibilitychange", onVisibilityChanged);
    });
  }

  if (lifecycleBindings.window) {
    const onWindowResume = () => {
      onResume();
    };
    lifecycleBindings.window.addEventListener("online", onWindowResume);
    lifecycleBindings.window.addEventListener("focus", onWindowResume);
    lifecycleBindings.window.addEventListener("pageshow", onWindowResume);
    releaseCallbacks.push(() => {
      lifecycleBindings.window?.removeEventListener("online", onWindowResume);
      lifecycleBindings.window?.removeEventListener("focus", onWindowResume);
      lifecycleBindings.window?.removeEventListener("pageshow", onWindowResume);
    });
  }

  return () => {
    for (const release of releaseCallbacks) {
      release();
    }
  };
}

function buildRuntimeRealtimeSocketProtocols(sessionToken: string): ReadonlyArray<string> {
  return Object.freeze([
    RUNTIME_REALTIME_PROTOCOL,
    `${RUNTIME_REALTIME_AUTH_PROTOCOL_PREFIX}${toBase64Url(sessionToken)}`,
  ]);
}

function toBase64Url(value: string): string {
  if (typeof btoa !== "function" || typeof TextEncoder === "undefined") {
    throw new Error("No base64 encoder is available for websocket protocol token encoding.");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

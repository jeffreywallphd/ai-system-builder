export const RuntimeRealtimeEventEnvelopeVersion = "2026-04-07";

export const RuntimeRealtimeEventCategories = Object.freeze({
  runStatus: "run-status",
  queueMovement: "queue-movement",
  connectivityState: "connectivity-state",
  adminChange: "admin-change",
});

export type RuntimeRealtimeEventCategory =
  typeof RuntimeRealtimeEventCategories[keyof typeof RuntimeRealtimeEventCategories];

export const RuntimeRealtimeTopics = Object.freeze({
  runStatus: "runtime.run.status",
  queue: "runtime.queue",
  connectivity: "runtime.connectivity",
  admin: "runtime.admin",
});

export type RuntimeRealtimeTopic = typeof RuntimeRealtimeTopics[keyof typeof RuntimeRealtimeTopics];

export const RuntimeRealtimeSubscriptionModes = Object.freeze({
  liveOnly: "live-only",
  resumeFromCursor: "resume-from-cursor",
});

export type RuntimeRealtimeSubscriptionMode =
  typeof RuntimeRealtimeSubscriptionModes[keyof typeof RuntimeRealtimeSubscriptionModes];

export const RuntimeRealtimeConnectivityStates = Object.freeze({
  connected: "connected",
  reconnecting: "reconnecting",
  degraded: "degraded",
  disconnected: "disconnected",
});

export type RuntimeRealtimeConnectivityState =
  typeof RuntimeRealtimeConnectivityStates[keyof typeof RuntimeRealtimeConnectivityStates];

export const RuntimeRealtimeAdminChangeKinds = Object.freeze({
  runtimePolicyUpdated: "runtime-policy-updated",
  queuePolicyUpdated: "queue-policy-updated",
  workerCapacityUpdated: "worker-capacity-updated",
  maintenanceModeChanged: "maintenance-mode-changed",
});

export type RuntimeRealtimeAdminChangeKind =
  typeof RuntimeRealtimeAdminChangeKinds[keyof typeof RuntimeRealtimeAdminChangeKinds];

export interface RuntimeRealtimeActorScope {
  readonly actorUserIdentityId: string;
  readonly accessChannel: "desktop" | "thin-client";
  readonly sessionId?: string;
  readonly workspaceId?: string;
}

export interface RuntimeRealtimeSubscriptionTopic {
  readonly topic: RuntimeRealtimeTopic;
  readonly workspaceId?: string;
  readonly executionId?: string;
}

export interface RuntimeRealtimeSubscriptionRequest {
  readonly actor: RuntimeRealtimeActorScope;
  readonly topics: ReadonlyArray<RuntimeRealtimeSubscriptionTopic>;
  readonly mode?: RuntimeRealtimeSubscriptionMode;
  readonly reconnect?: {
    readonly afterCursor?: string;
  };
}

export interface RuntimeRealtimeRunStatusPayload {
  readonly executionId: string;
  readonly status: string;
  readonly sessionId?: string;
  readonly rootAssetId?: string;
  readonly rootVersionId?: string;
  readonly progress?: {
    readonly completedNodeCount: number;
    readonly failedNodeCount: number;
    readonly runningNodeCount: number;
    readonly totalNodeCount: number;
  };
  readonly changedAt: string;
}

export interface RuntimeRealtimeQueueMovementPayload {
  readonly queueItemId: string;
  readonly executionId: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled";
  readonly position?: number;
  readonly sessionId?: string;
  readonly changedAt: string;
}

export interface RuntimeRealtimeConnectivityStatePayload {
  readonly state: RuntimeRealtimeConnectivityState;
  readonly reason?: string;
  readonly observedAt: string;
  readonly reconnectHint?: {
    readonly retryAfterMs?: number;
    readonly sessionEpoch?: string;
  };
}

export interface RuntimeRealtimeAdminChangePayload {
  readonly changeKind: RuntimeRealtimeAdminChangeKind;
  readonly summary: string;
  readonly changedAt: string;
  readonly changedByActorId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export type RuntimeRealtimeEventPayload =
  | RuntimeRealtimeRunStatusPayload
  | RuntimeRealtimeQueueMovementPayload
  | RuntimeRealtimeConnectivityStatePayload
  | RuntimeRealtimeAdminChangePayload;

export interface RuntimeRealtimeEventEnvelope {
  readonly eventId: string;
  readonly schemaVersion: string;
  readonly emittedAt: string;
  readonly sequence: number;
  readonly cursor: string;
  readonly category: RuntimeRealtimeEventCategory;
  readonly topic: RuntimeRealtimeTopic;
  readonly workspaceScope: {
    readonly workspaceId?: string;
  };
  readonly actorScope: {
    readonly actorUserIdentityId?: string;
    readonly sessionId?: string;
  };
  readonly runScope: {
    readonly executionId?: string;
  };
  readonly payload: RuntimeRealtimeEventPayload;
}

export interface RuntimeRealtimeEventSubscription {
  readonly subscriptionId: string;
  readonly createdAt: string;
  readonly request: RuntimeRealtimeSubscriptionRequest;
  readonly unsubscribe: () => void;
}

export const RuntimeRealtimeWebSocketActions = Object.freeze({
  subscribe: "runtime-realtime.subscribe",
});

export type RuntimeRealtimeWebSocketAction =
  typeof RuntimeRealtimeWebSocketActions[keyof typeof RuntimeRealtimeWebSocketActions];

export const RuntimeRealtimeWebSocketMessageTypes = Object.freeze({
  subscriptionAck: "runtime-realtime.subscription-ack",
  event: "runtime-realtime.event",
  error: "runtime-realtime.error",
});

export type RuntimeRealtimeWebSocketMessageType =
  typeof RuntimeRealtimeWebSocketMessageTypes[keyof typeof RuntimeRealtimeWebSocketMessageTypes];

export interface RuntimeRealtimeWebSocketSubscribeMessage {
  readonly action: typeof RuntimeRealtimeWebSocketActions.subscribe;
  readonly request: {
    readonly topics: ReadonlyArray<RuntimeRealtimeSubscriptionTopic>;
    readonly mode?: RuntimeRealtimeSubscriptionMode;
    readonly reconnect?: {
      readonly afterCursor?: string;
    };
  };
}

export interface RuntimeRealtimeWebSocketSubscriptionAckMessage {
  readonly type: typeof RuntimeRealtimeWebSocketMessageTypes.subscriptionAck;
  readonly subscriptionId: string;
  readonly acceptedAt: string;
  readonly mode: RuntimeRealtimeSubscriptionMode;
  readonly topics: ReadonlyArray<RuntimeRealtimeSubscriptionTopic>;
  readonly reconnect?: {
    readonly afterCursor?: string;
  };
}

export interface RuntimeRealtimeWebSocketEventMessage {
  readonly type: typeof RuntimeRealtimeWebSocketMessageTypes.event;
  readonly event: RuntimeRealtimeEventEnvelope;
}

export interface RuntimeRealtimeWebSocketErrorMessage {
  readonly type: typeof RuntimeRealtimeWebSocketMessageTypes.error;
  readonly error: {
    readonly code: "invalid-request" | "forbidden" | "internal";
    readonly message: string;
    readonly correlationId?: string;
  };
}

export function buildRuntimeRealtimeCursor(sequence: number): string {
  const normalized = Math.max(1, Math.floor(sequence));
  return `runtime-realtime:${normalized}`;
}

export function parseRuntimeRealtimeCursor(cursor: string | undefined): number | undefined {
  const normalized = cursor?.trim();
  if (!normalized) {
    return undefined;
  }
  const match = normalized.match(/^runtime-realtime:(\d+)$/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

export function runtimeRealtimeEventMatchesSubscriptionTopic(
  event: RuntimeRealtimeEventEnvelope,
  topic: RuntimeRealtimeSubscriptionTopic,
): boolean {
  if (event.topic !== topic.topic) {
    return false;
  }
  if (topic.workspaceId && event.workspaceScope.workspaceId !== topic.workspaceId) {
    return false;
  }
  if (topic.executionId && event.runScope.executionId !== topic.executionId) {
    return false;
  }
  return true;
}

export function validateRuntimeRealtimeActorWorkspaceScope(
  request: RuntimeRealtimeSubscriptionRequest,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const actorWorkspaceId = request.actor.workspaceId?.trim();
  if (!actorWorkspaceId) {
    return Object.freeze({ ok: true });
  }

  const mismatchedTopic = request.topics.find((topic) => {
    const topicWorkspaceId = topic.workspaceId?.trim();
    return Boolean(topicWorkspaceId) && topicWorkspaceId !== actorWorkspaceId;
  });

  if (mismatchedTopic) {
    return Object.freeze({
      ok: false,
      message: "Topic workspace scope must match actor workspace scope.",
    });
  }

  return Object.freeze({ ok: true });
}

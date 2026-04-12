import {
  RuntimeRealtimeEventCategories,
  RuntimeRealtimeEventEnvelopeVersion,
  RuntimeRealtimeSubscriptionModes,
  RuntimeRealtimeTopics,
  buildRuntimeRealtimeCursor,
  parseRuntimeRealtimeCursor,
  runtimeRealtimeEventMatchesSubscriptionTopic,
  validateRuntimeRealtimeActorWorkspaceScope,
  type RuntimeRealtimeAdminChangePayload,
  type RuntimeRealtimeAuditGovernancePayload,
  type RuntimeRealtimeConnectivityStatePayload,
  type RuntimeRealtimeEventEnvelope,
  type RuntimeRealtimeEventSubscription,
  type RuntimeRealtimeQueueMovementPayload,
  type RuntimeRealtimeRunStatusPayload,
  type RuntimeRealtimeSubscriptionRequest,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  parseRuntimeRealtimeEventEnvelope,
  parseRuntimeRealtimeSubscriptionRequest,
} from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";

export interface AuthoritativeRuntimeEventStreamPolicy {
  readonly maxSubscriptionsTotal: number;
  readonly maxSubscriptionsPerActor: number;
  readonly maxListenersPerEvent: number;
  readonly maxRetainedEvents: number;
}

const DefaultAuthoritativeRuntimeEventStreamPolicy: AuthoritativeRuntimeEventStreamPolicy = Object.freeze({
  maxSubscriptionsTotal: 500,
  maxSubscriptionsPerActor: 100,
  maxListenersPerEvent: 200,
  maxRetainedEvents: 2_000,
});

interface RuntimeEventStreamEntry {
  readonly subscriptionId: string;
  readonly request: RuntimeRealtimeSubscriptionRequest;
  readonly listener: (event: RuntimeRealtimeEventEnvelope) => void;
}

export class AuthoritativeRuntimeEventStream {
  private readonly subscriptions = new Map<string, RuntimeEventStreamEntry>();
  private readonly retainedEvents: RuntimeRealtimeEventEnvelope[] = [];
  private sequence = 0;

  public constructor(private readonly policy: AuthoritativeRuntimeEventStreamPolicy = DefaultAuthoritativeRuntimeEventStreamPolicy) {}

  public subscribe(input: {
    readonly request: RuntimeRealtimeSubscriptionRequest;
    readonly listener: (event: RuntimeRealtimeEventEnvelope) => void;
  }): RuntimeRealtimeEventSubscription {
    const request = parseRuntimeRealtimeSubscriptionRequest(input.request);
    const scopeValidation = validateRuntimeRealtimeActorWorkspaceScope(request);
    if (!scopeValidation.ok) {
      throw new Error(`invalid-request:${scopeValidation.message}`);
    }

    if (this.subscriptions.size >= this.policy.maxSubscriptionsTotal) {
      throw new Error(`invalid-request:Realtime subscriptions exceeded bounded global limit (${this.policy.maxSubscriptionsTotal}).`);
    }

    const actorScopedCount = [...this.subscriptions.values()]
      .filter((entry) => entry.request.actor.actorUserIdentityId === request.actor.actorUserIdentityId)
      .length;
    if (actorScopedCount >= this.policy.maxSubscriptionsPerActor) {
      throw new Error(`invalid-request:Realtime subscriptions exceeded bounded actor limit (${this.policy.maxSubscriptionsPerActor}).`);
    }

    const subscriptionId = `runtime-realtime-sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    this.subscriptions.set(subscriptionId, Object.freeze({
      subscriptionId,
      request,
      listener: input.listener,
    }));

    this.replayRetainedEvents(subscriptionId);

    return Object.freeze({
      subscriptionId,
      createdAt: new Date().toISOString(),
      request,
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);
      },
    });
  }

  public publishRunStatusEvent(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeRunStatusPayload;
  }): RuntimeRealtimeEventEnvelope {
    return this.publish({
      topic: RuntimeRealtimeTopics.runStatus,
      category: RuntimeRealtimeEventCategories.runStatus,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      executionId: input.payload.executionId,
      sessionId: input.payload.sessionId,
      payload: input.payload,
    });
  }

  public publishQueueMovementEvent(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeQueueMovementPayload;
  }): RuntimeRealtimeEventEnvelope {
    return this.publish({
      topic: RuntimeRealtimeTopics.queue,
      category: RuntimeRealtimeEventCategories.queueMovement,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      executionId: input.payload.executionId,
      sessionId: input.payload.sessionId,
      payload: input.payload,
    });
  }

  public publishConnectivityStateEvent(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly sessionId?: string;
    readonly payload: RuntimeRealtimeConnectivityStatePayload;
  }): RuntimeRealtimeEventEnvelope {
    return this.publish({
      topic: RuntimeRealtimeTopics.connectivity,
      category: RuntimeRealtimeEventCategories.connectivityState,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      executionId: undefined,
      sessionId: input.sessionId,
      payload: input.payload,
    });
  }

  public publishAdminChangeEvent(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeAdminChangePayload;
  }): RuntimeRealtimeEventEnvelope {
    return this.publish({
      topic: RuntimeRealtimeTopics.admin,
      category: RuntimeRealtimeEventCategories.adminChange,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      executionId: undefined,
      sessionId: undefined,
      payload: input.payload,
    });
  }

  public publishAuditGovernanceEvent(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeAuditGovernancePayload;
  }): RuntimeRealtimeEventEnvelope {
    return this.publish({
      topic: RuntimeRealtimeTopics.auditGovernance,
      category: RuntimeRealtimeEventCategories.auditGovernance,
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      executionId: undefined,
      sessionId: undefined,
      payload: input.payload,
    });
  }

  private publish(input: {
    readonly topic: RuntimeRealtimeEventEnvelope["topic"];
    readonly category: RuntimeRealtimeEventEnvelope["category"];
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly payload: RuntimeRealtimeEventEnvelope["payload"];
  }): RuntimeRealtimeEventEnvelope {
    this.sequence += 1;
    const envelope = parseRuntimeRealtimeEventEnvelope({
      eventId: `runtime-realtime-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      schemaVersion: RuntimeRealtimeEventEnvelopeVersion,
      emittedAt: new Date().toISOString(),
      sequence: this.sequence,
      cursor: buildRuntimeRealtimeCursor(this.sequence),
      category: input.category,
      topic: input.topic,
      workspaceScope: {
        workspaceId: normalizeOptional(input.workspaceId),
      },
      actorScope: {
        actorUserIdentityId: normalizeOptional(input.actorUserIdentityId),
        sessionId: normalizeOptional(input.sessionId),
      },
      runScope: {
        executionId: normalizeOptional(input.executionId),
      },
      payload: input.payload,
    });

    this.retainEvent(envelope);
    this.notifySubscribers(envelope);
    return envelope;
  }

  private replayRetainedEvents(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (!entry) {
      return;
    }

    const mode = entry.request.mode ?? RuntimeRealtimeSubscriptionModes.liveOnly;
    if (mode !== RuntimeRealtimeSubscriptionModes.resumeFromCursor) {
      return;
    }

    const cursorSequence = parseRuntimeRealtimeCursor(entry.request.reconnect?.afterCursor);
    const replayEvents = this.retainedEvents
      .filter((event) => cursorSequence === undefined || event.sequence > cursorSequence)
      .filter((event) => this.canDeliver(entry.request, event));

    for (const event of replayEvents) {
      entry.listener(event);
    }
  }

  private retainEvent(event: RuntimeRealtimeEventEnvelope): void {
    this.retainedEvents.push(event);
    if (this.retainedEvents.length > this.policy.maxRetainedEvents) {
      this.retainedEvents.splice(0, this.retainedEvents.length - this.policy.maxRetainedEvents);
    }
  }

  private notifySubscribers(event: RuntimeRealtimeEventEnvelope): void {
    let delivered = 0;
    for (const entry of this.subscriptions.values()) {
      if (delivered >= this.policy.maxListenersPerEvent) {
        break;
      }
      if (!this.canDeliver(entry.request, event)) {
        continue;
      }
      entry.listener(event);
      delivered += 1;
    }
  }

  private canDeliver(request: RuntimeRealtimeSubscriptionRequest, event: RuntimeRealtimeEventEnvelope): boolean {
    const actorWorkspaceId = request.actor.workspaceId?.trim();
    if (actorWorkspaceId && event.workspaceScope.workspaceId && actorWorkspaceId !== event.workspaceScope.workspaceId) {
      return false;
    }

    return request.topics.some((topic) => runtimeRealtimeEventMatchesSubscriptionTopic(event, topic));
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

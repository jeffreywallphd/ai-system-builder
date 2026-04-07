export const ExecutionUpdateEventKinds = Object.freeze({
  executionAccepted: "execution-accepted",
  executionStatus: "execution-status",
  executionTrace: "execution-trace",
  executionCompleted: "execution-completed",
  executionFailed: "execution-failed",
});

export type ExecutionUpdateEventKind = typeof ExecutionUpdateEventKinds[keyof typeof ExecutionUpdateEventKinds];

export interface ExecutionUpdateEvent {
  readonly eventId: string;
  readonly kind: ExecutionUpdateEventKind;
  readonly executionId: string;
  readonly sessionId?: string;
  readonly emittedAt: string;
  readonly status?: string;
  readonly progress?: {
    readonly completedNodeCount: number;
    readonly failedNodeCount: number;
    readonly runningNodeCount: number;
    readonly totalNodeCount: number;
  };
  readonly traceEvent?: {
    readonly kind: string;
    readonly at: string;
    readonly nodeId?: string;
    readonly status?: string;
    readonly summary?: string;
  };
  readonly summary?: {
    readonly rootAssetId?: string;
    readonly rootVersionId?: string;
    readonly diagnosticsCount?: number;
  };
}

export interface ExecutionUpdateSubscription {
  readonly subscriptionId: string;
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly eventKinds: ReadonlyArray<ExecutionUpdateEventKind>;
  readonly createdAt: string;
  readonly unsubscribe: () => void;
}

interface StreamEntry {
  readonly subscriptionId: string;
  readonly executionId?: string;
  readonly sessionId?: string;
  readonly eventKinds: ReadonlyArray<ExecutionUpdateEventKind>;
  readonly listener: (event: ExecutionUpdateEvent) => void;
}

export interface ExecutionUpdateStreamPolicy {
  readonly maxSubscriptionsTotal: number;
  readonly maxSubscriptionsPerExecution: number;
  readonly maxSubscriptionsPerSession: number;
  readonly maxListenersPerEvent: number;
}

const DEFAULT_STREAM_POLICY: ExecutionUpdateStreamPolicy = Object.freeze({
  maxSubscriptionsTotal: 500,
  maxSubscriptionsPerExecution: 100,
  maxSubscriptionsPerSession: 100,
  maxListenersPerEvent: 100,
});

function eventMatches(entry: StreamEntry, event: ExecutionUpdateEvent): boolean {
  if (entry.executionId && entry.executionId !== event.executionId) {
    return false;
  }
  if (entry.sessionId && entry.sessionId !== event.sessionId) {
    return false;
  }
  return entry.eventKinds.includes(event.kind);
}

export class ExecutionUpdateStream {
  private readonly subscriptions = new Map<string, StreamEntry>();
  public constructor(private readonly policy: ExecutionUpdateStreamPolicy = DEFAULT_STREAM_POLICY) {}

  public subscribe(input: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly eventKinds?: ReadonlyArray<ExecutionUpdateEventKind>;
    readonly listener: (event: ExecutionUpdateEvent) => void;
  }): ExecutionUpdateSubscription {
    if (this.subscriptions.size >= this.policy.maxSubscriptionsTotal) {
      throw new Error(`invalid-request:Execution update subscriptions exceeded bounded global limit (${this.policy.maxSubscriptionsTotal}).`);
    }
    const normalizedExecutionId = input.executionId?.trim() || undefined;
    const normalizedSessionId = input.sessionId?.trim() || undefined;
    if (normalizedExecutionId) {
      const executionScopedCount = [...this.subscriptions.values()]
        .filter((entry) => entry.executionId === normalizedExecutionId)
        .length;
      if (executionScopedCount >= this.policy.maxSubscriptionsPerExecution) {
        throw new Error(`invalid-request:Execution update subscriptions exceeded bounded execution limit (${this.policy.maxSubscriptionsPerExecution}).`);
      }
    }
    if (normalizedSessionId) {
      const sessionScopedCount = [...this.subscriptions.values()]
        .filter((entry) => entry.sessionId === normalizedSessionId)
        .length;
      if (sessionScopedCount >= this.policy.maxSubscriptionsPerSession) {
        throw new Error(`invalid-request:Execution update subscriptions exceeded bounded session limit (${this.policy.maxSubscriptionsPerSession}).`);
      }
    }
    const now = new Date().toISOString();
    const eventKinds = input.eventKinds?.length
      ? Object.freeze([...new Set(input.eventKinds)])
      : Object.freeze(Object.values(ExecutionUpdateEventKinds));
    const subscriptionId = `exec-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.subscriptions.set(subscriptionId, Object.freeze({
      subscriptionId,
      executionId: normalizedExecutionId,
      sessionId: normalizedSessionId,
      eventKinds,
      listener: input.listener,
    }));
    return Object.freeze({
      subscriptionId,
      executionId: normalizedExecutionId,
      sessionId: normalizedSessionId,
      eventKinds,
      createdAt: now,
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);
      },
    });
  }

  public emit(event: Omit<ExecutionUpdateEvent, "eventId" | "emittedAt">): ExecutionUpdateEvent {
    const emitted: ExecutionUpdateEvent = Object.freeze({
      ...event,
      eventId: `exec-update-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      emittedAt: new Date().toISOString(),
    });
    let notifiedCount = 0;
    for (const entry of this.subscriptions.values()) {
      if (notifiedCount >= this.policy.maxListenersPerEvent) {
        break;
      }
      if (eventMatches(entry, emitted)) {
        entry.listener(emitted);
        notifiedCount += 1;
      }
    }
    return emitted;
  }
}

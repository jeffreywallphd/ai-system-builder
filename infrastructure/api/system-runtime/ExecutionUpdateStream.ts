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

  public subscribe(input: {
    readonly executionId?: string;
    readonly sessionId?: string;
    readonly eventKinds?: ReadonlyArray<ExecutionUpdateEventKind>;
    readonly listener: (event: ExecutionUpdateEvent) => void;
  }): ExecutionUpdateSubscription {
    const now = new Date().toISOString();
    const eventKinds = input.eventKinds?.length
      ? Object.freeze([...new Set(input.eventKinds)])
      : Object.freeze(Object.values(ExecutionUpdateEventKinds));
    const subscriptionId = `exec-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.subscriptions.set(subscriptionId, Object.freeze({
      subscriptionId,
      executionId: input.executionId?.trim() || undefined,
      sessionId: input.sessionId?.trim() || undefined,
      eventKinds,
      listener: input.listener,
    }));
    return Object.freeze({
      subscriptionId,
      executionId: input.executionId?.trim() || undefined,
      sessionId: input.sessionId?.trim() || undefined,
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
    for (const entry of this.subscriptions.values()) {
      if (eventMatches(entry, emitted)) {
        entry.listener(emitted);
      }
    }
    return emitted;
  }
}

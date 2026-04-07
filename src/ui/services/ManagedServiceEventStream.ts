import type {
  ManagedSupervisorServiceLogEntry,
  ManagedSupervisorServiceRecord,
} from "../../application/services/interfaces/IManagedServiceSupervisorClient";

export type ManagedServiceStreamConnectionState = "connecting" | "open" | "closed";

export interface ManagedServiceSnapshotEvent {
  readonly services: ReadonlyArray<ManagedSupervisorServiceRecord>;
}

export interface ManagedServiceStateEvent {
  readonly serviceId: string;
  readonly previousState?: string;
  readonly service: ManagedSupervisorServiceRecord;
}

export interface ManagedServiceLogEvent {
  readonly serviceId: string;
  readonly entry: ManagedSupervisorServiceLogEntry;
  readonly service?: ManagedSupervisorServiceRecord;
}

export interface ManagedServiceRestartEvent {
  readonly serviceId: string;
  readonly phase: "requested" | "completed";
  readonly timestamp: string;
  readonly service?: ManagedSupervisorServiceRecord;
}

export interface ManagedServiceHealthEvent {
  readonly serviceId: string;
  readonly previousState?: string;
  readonly changedAt: string;
  readonly service: ManagedSupervisorServiceRecord;
}

export interface ManagedServiceEventStreamListener {
  readonly onSnapshot?: (event: ManagedServiceSnapshotEvent) => void;
  readonly onStateChange?: (event: ManagedServiceStateEvent) => void;
  readonly onLog?: (event: ManagedServiceLogEvent) => void;
  readonly onRestart?: (event: ManagedServiceRestartEvent) => void;
  readonly onHealthChange?: (event: ManagedServiceHealthEvent) => void;
  readonly onConnectionStateChange?: (state: ManagedServiceStreamConnectionState) => void;
  readonly onError?: (error: Error) => void;
}

export interface EventSourceLike {
  readonly readyState?: number;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface ManagedServiceEventStreamOptions {
  readonly baseUrl: string;
  readonly reconnectDelayMs?: number;
  readonly eventSourceFactory?: (url: string) => EventSourceLike;
}

const STREAM_PATH = "/events";
const DEFAULT_RECONNECT_DELAY_MS = 1_500;
const EVENT_SOURCE_CONNECTING = 0;
const EVENT_SOURCE_CLOSED = 2;

export class ManagedServiceEventStream {
  private readonly baseUrl: string;
  private readonly reconnectDelayMs: number;
  private readonly eventSourceFactory: (url: string) => EventSourceLike;
  private eventSource?: EventSourceLike;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private listener?: ManagedServiceEventStreamListener;
  private isDisposed = false;

  constructor(options: ManagedServiceEventStreamOptions) {
    const normalizedBaseUrl = options.baseUrl.trim().replace(/\/$/, "");
    if (!normalizedBaseUrl) {
      throw new Error("Managed service event stream baseUrl is required.");
    }

    this.baseUrl = normalizedBaseUrl;
    this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    this.eventSourceFactory = options.eventSourceFactory ?? ((url) => new EventSource(url));
  }

  public connect(listener: ManagedServiceEventStreamListener): () => void {
    this.listener = listener;
    this.isDisposed = false;
    this.open();

    return () => {
      this.dispose();
    };
  }

  public dispose(): void {
    this.isDisposed = true;
    this.listener = undefined;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.closeCurrentSource();
  }

  private open(): void {
    if (this.isDisposed) {
      return;
    }

    this.listener?.onConnectionStateChange?.("connecting");

    const source = this.eventSourceFactory(`${this.baseUrl}${STREAM_PATH}`);
    this.eventSource = source;

    source.onopen = () => {
      if (this.eventSource !== source || this.isDisposed) {
        return;
      }

      this.listener?.onConnectionStateChange?.("open");
    };

    source.onerror = () => {
      if (this.eventSource !== source || this.isDisposed) {
        return;
      }

      this.listener?.onConnectionStateChange?.("connecting");
      this.listener?.onError?.(new Error("Managed service event stream disconnected."));

      if (source.readyState === EVENT_SOURCE_CLOSED) {
        this.scheduleReconnect();
      }
    };

    this.attachListener(source, "snapshot", (event) => {
      this.listener?.onSnapshot?.(parseEventPayload<ManagedServiceSnapshotEvent>(event));
    });
    this.attachListener(source, "service-state", (event) => {
      this.listener?.onStateChange?.(parseEventPayload<ManagedServiceStateEvent>(event));
    });
    this.attachListener(source, "service-log", (event) => {
      this.listener?.onLog?.(parseEventPayload<ManagedServiceLogEvent>(event));
    });
    this.attachListener(source, "service-restart", (event) => {
      this.listener?.onRestart?.(parseEventPayload<ManagedServiceRestartEvent>(event));
    });
    this.attachListener(source, "service-health", (event) => {
      this.listener?.onHealthChange?.(parseEventPayload<ManagedServiceHealthEvent>(event));
    });
  }

  private attachListener<T>(
    source: EventSourceLike,
    type: string,
    handler: (event: MessageEvent<string>) => void,
  ): void {
    source.addEventListener(type, (event) => {
      if (this.eventSource !== source || this.isDisposed) {
        return;
      }

      try {
        handler(event);
      } catch (error) {
        this.listener?.onError?.(error instanceof Error ? error : new Error("Managed service event parsing failed."));
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isDisposed) {
      return;
    }

    this.closeCurrentSource();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open();
    }, this.reconnectDelayMs);
  }

  private closeCurrentSource(): void {
    if (!this.eventSource) {
      return;
    }

    this.eventSource.close();
    this.eventSource = undefined;

    if (!this.isDisposed) {
      this.listener?.onConnectionStateChange?.("closed");
    }
  }
}

function parseEventPayload<T>(event: MessageEvent<string>): T {
  return JSON.parse(event.data) as T;
}

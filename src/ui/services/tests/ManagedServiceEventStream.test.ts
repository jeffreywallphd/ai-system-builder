import { describe, expect, it, mock } from "bun:test";
import { ManagedServiceEventStream, type EventSourceLike } from "../ManagedServiceEventStream";

class MockEventSource implements EventSourceLike {
  public readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  public readyState = 0;
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const listeners = this.listeners.get(type) ?? new Set<(event: MessageEvent<string>) => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = 2;
  }

  emitOpen(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  emitError(): void {
    this.onerror?.(new Event("error"));
  }

  emit(type: string, payload: unknown): void {
    const event = { data: JSON.stringify(payload) } as MessageEvent<string>;
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe("ManagedServiceEventStream", () => {
  it("parses stream events and reconnects when the source closes", async () => {
    const sources: MockEventSource[] = [];
    const eventStream = new ManagedServiceEventStream({
      baseUrl: "http://127.0.0.1:8790",
      reconnectDelayMs: 0,
      eventSourceFactory: mock((url: string) => {
        expect(url).toBe("http://127.0.0.1:8790/events");
        const source = new MockEventSource();
        sources.push(source);
        return source;
      }),
    });

    const snapshots: number[] = [];
    const logMessages: string[] = [];
    const connectionStates: string[] = [];
    const errors: string[] = [];
    const disconnect = eventStream.connect({
      onSnapshot: (event) => snapshots.push(event.services.length),
      onLog: (event) => logMessages.push(event.entry.message),
      onConnectionStateChange: (state) => connectionStates.push(state),
      onError: (error) => errors.push(error.message),
    });

    expect(sources).toHaveLength(1);
    sources[0]?.emitOpen();
    sources[0]?.emit("snapshot", { services: [{ serviceId: "python-runtime" }] });
    sources[0]!.readyState = 2;
    sources[0]?.emitError();

    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sources).toHaveLength(2);
    sources[1]?.emitOpen();
    sources[1]?.emit("service-log", {
      serviceId: "python-runtime",
      entry: {
        timestamp: "2026-03-20T10:00:00.000Z",
        level: "stdout",
        message: "runtime ready",
      },
    });

    expect(snapshots).toEqual([1]);
    expect(logMessages).toEqual(["runtime ready"]);
    expect(connectionStates).toContain("open");
    expect(connectionStates).toContain("closed");
    expect(connectionStates).toContain("connecting");
    expect(errors).toEqual(["Managed service event stream disconnected."]);

    disconnect();
  });
});

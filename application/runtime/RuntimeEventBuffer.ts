import type { IRuntimeEventStore } from "../ports/interfaces/IRuntimeEventStore";
import type { RuntimeEvent } from "./RuntimeEvent";

export type RuntimeEventListener = (events: ReadonlyArray<RuntimeEvent>) => void;

export interface RuntimeEventBufferOptions {
  readonly capacity?: number;
  readonly initialEvents?: ReadonlyArray<RuntimeEvent>;
}

export class RuntimeEventBuffer implements IRuntimeEventStore {
  private readonly listeners = new Set<RuntimeEventListener>();
  private readonly capacity: number;
  private events: ReadonlyArray<RuntimeEvent>;

  constructor(options: RuntimeEventBufferOptions = {}) {
    this.capacity = options.capacity && options.capacity > 0 ? options.capacity : 250;
    this.events = Object.freeze([...(options.initialEvents ?? [])].slice(-this.capacity));
  }

  public append(event: RuntimeEvent): void {
    this.events = Object.freeze([...this.events, event].slice(-this.capacity));
    this.notify();
  }

  public list(): ReadonlyArray<RuntimeEvent> {
    return this.events;
  }

  public clear(): void {
    if (this.events.length === 0) {
      return;
    }

    this.events = Object.freeze([]);
    this.notify();
  }

  public subscribe(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);
    listener(this.events);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.events);
    }
  }
}

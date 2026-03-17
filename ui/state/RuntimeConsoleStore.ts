import type { IPythonRuntimeManager } from "../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventStore } from "../../application/ports/interfaces/IRuntimeEventStore";
import type { RuntimeEvent } from "../../application/runtime/RuntimeEvent";

export interface RuntimeConsoleState {
  readonly isExpanded: boolean;
  readonly events: ReadonlyArray<RuntimeEvent>;
}

export type RuntimeConsoleListener = (state: RuntimeConsoleState) => void;

export interface RuntimeConsoleStoreOptions {
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly pythonRuntimeManager: IPythonRuntimeManager;
}

export class RuntimeConsoleStore {
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly pythonRuntimeManager: IPythonRuntimeManager;
  private readonly listeners = new Set<RuntimeConsoleListener>();
  private readonly unsubscribeEventStore: () => void;
  private state: RuntimeConsoleState = Object.freeze({ isExpanded: false, events: Object.freeze([]) });
  private initializePromise?: Promise<void>;

  constructor(options: RuntimeConsoleStoreOptions) {
    this.runtimeEventStore = options.runtimeEventStore;
    this.pythonRuntimeManager = options.pythonRuntimeManager;
    this.unsubscribeEventStore = this.runtimeEventStore.subscribe((events) => {
      this.state = Object.freeze({ ...this.state, events: Object.freeze([...events]) });
      this.notify();
    });
  }

  public getState(): RuntimeConsoleState {
    return this.state;
  }

  public subscribe(listener: RuntimeConsoleListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public toggleExpanded(): void {
    this.state = Object.freeze({ ...this.state, isExpanded: !this.state.isExpanded });
    this.notify();
  }

  public clearEvents(): void {
    this.runtimeEventStore.clear();
  }

  public initializeRuntime(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.pythonRuntimeManager
        .ensureRuntimeAvailability()
        .then(() => undefined)
        .catch(() => undefined);
    }

    return this.initializePromise;
  }

  public dispose(): void {
    this.unsubscribeEventStore();
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

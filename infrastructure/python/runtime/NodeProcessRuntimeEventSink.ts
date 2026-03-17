import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import type { IRuntimeEventStore } from "../../../application/ports/interfaces/IRuntimeEventStore";
import {
  RuntimeEventSources,
  createRuntimeEvent,
  type RuntimeEvent,
  type RuntimeEventCreateParams,
} from "../../../application/runtime/RuntimeEvent";

export class NodeProcessRuntimeEventSink implements IRuntimeEventSink {
  private readonly store: IRuntimeEventStore;

  constructor(store: IRuntimeEventStore) {
    this.store = store;
  }

  public emit(event: RuntimeEventCreateParams | RuntimeEvent): void {
    const normalized = "source" in event && "id" in event
      ? event
      : createRuntimeEvent({
          source: RuntimeEventSources.pythonRuntime,
          ...event,
        });

    this.store.append(normalized);
  }
}

import type { RuntimeEvent } from "../../runtime/RuntimeEvent";

export type RuntimeEventStoreListener = (events: ReadonlyArray<RuntimeEvent>) => void;

export interface IRuntimeEventStore {
  append(event: RuntimeEvent): void;
  list(): ReadonlyArray<RuntimeEvent>;
  clear(): void;
  subscribe(listener: RuntimeEventStoreListener): () => void;
}

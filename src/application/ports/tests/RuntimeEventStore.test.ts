import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../runtime/RuntimeEventBuffer";
import type { IRuntimeEventStore } from "../interfaces/IRuntimeEventStore";
import { RuntimeEventSources, createRuntimeEvent } from "../../runtime/RuntimeEvent";

describe("IRuntimeEventStore contract", () => {
  it("lists, appends, clears, and subscribes", () => {
    const store: IRuntimeEventStore = new RuntimeEventBuffer();
    const calls: number[] = [];
    const dispose = store.subscribe((events) => calls.push(events.length));

    store.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "a" }));
    expect(store.list()).toHaveLength(1);

    store.clear();
    dispose();

    expect(calls).toEqual([0, 1, 0]);
  });
});

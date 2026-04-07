import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../RuntimeEventBuffer";
import { RuntimeEventSources, createRuntimeEvent } from "../RuntimeEvent";

describe("RuntimeEventBuffer", () => {
  it("stores only configured capacity", () => {
    const buffer = new RuntimeEventBuffer({ capacity: 2 });

    buffer.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "one" }));
    buffer.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "two" }));
    buffer.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "three" }));

    expect(buffer.list()).toHaveLength(2);
    expect(buffer.list()[0]?.message).toBe("two");
  });

  it("supports subscribe and clear", () => {
    const buffer = new RuntimeEventBuffer();
    const snapshots: number[] = [];
    const unsubscribe = buffer.subscribe((events) => snapshots.push(events.length));

    buffer.append(createRuntimeEvent({ source: RuntimeEventSources.app, severity: "info", message: "hello" }));
    buffer.clear();
    unsubscribe();

    expect(snapshots).toEqual([0, 1, 0]);
  });
});

import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { NodeProcessRuntimeEventSink } from "../NodeProcessRuntimeEventSink";

describe("NodeProcessRuntimeEventSink", () => {
  it("creates and appends runtime events", () => {
    const store = new RuntimeEventBuffer();
    const sink = new NodeProcessRuntimeEventSink(store);

    sink.emit({ severity: "info", message: "runtime starting", source: "python-runtime" });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]?.message).toBe("runtime starting");
  });
});

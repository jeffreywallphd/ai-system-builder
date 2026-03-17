import { describe, expect, it } from "bun:test";
import type { IRuntimeEventSink } from "../interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../runtime/RuntimeEvent";

describe("IRuntimeEventSink contract", () => {
  it("accepts structured runtime events", () => {
    const emitted: string[] = [];
    const sink: IRuntimeEventSink = {
      emit: (event) => emitted.push(event.message),
    };

    sink.emit({ source: RuntimeEventSources.app, severity: "info", message: "status" });
    expect(emitted).toEqual(["status"]);
  });
});

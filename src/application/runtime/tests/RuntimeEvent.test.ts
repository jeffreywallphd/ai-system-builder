import { describe, expect, it } from "bun:test";
import { RuntimeEventSources, createRuntimeEvent } from "../RuntimeEvent";

describe("RuntimeEvent", () => {
  it("creates normalized immutable events", () => {
    const event = createRuntimeEvent({
      source: RuntimeEventSources.app,
      severity: "info",
      message: "  Boot completed.  ",
      details: { phase: "init" },
    });

    expect(event.id).toStartWith("runtime-event-");
    expect(event.message).toBe("Boot completed.");
    expect(event.details?.phase).toBe("init");
    expect(Object.isFrozen(event)).toBeTrue();
  });

  it("rejects empty messages", () => {
    expect(() =>
      createRuntimeEvent({
        source: RuntimeEventSources.app,
        severity: "info",
        message: "   ",
      })
    ).toThrow();
  });
});

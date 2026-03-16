import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/state interactions", () => {
  it("keeps placeholder modules consistent for NodeStore.ts, ModelStore.ts, WorkflowStore.ts", () => {
    const sources = [readSource("ui/state/NodeStore.ts"), readSource("ui/state/ModelStore.ts"), readSource("ui/state/WorkflowStore.ts")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});

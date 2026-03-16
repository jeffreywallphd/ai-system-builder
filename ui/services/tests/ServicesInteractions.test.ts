import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/services interactions", () => {
  it("keeps placeholder modules consistent for NodeService.ts, ModelService.ts, WorkflowService.ts", () => {
    const sources = [readSource("ui/services/NodeService.ts"), readSource("ui/services/ModelService.ts"), readSource("ui/services/WorkflowService.ts")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});

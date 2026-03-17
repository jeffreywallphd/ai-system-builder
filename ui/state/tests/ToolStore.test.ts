import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolStore", () => {
  it("tracks tool loading and run state", () => {
    const source = readSource("ui/state/ToolStore.ts");
    expect(source).toContain("refreshTools");
    expect(source).toContain("runTool");
  });
});

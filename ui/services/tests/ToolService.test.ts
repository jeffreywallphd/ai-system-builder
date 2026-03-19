import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolService", () => {
  it("wraps tools use cases", () => {
    const source = readSource("ui/services/ToolService.ts");
    expect(source).toContain("listPublishedTools");
    expect(source).toContain("loadToolDefinition");
    expect(source).toContain("runTool");
    expect(source).toContain("listToolCapabilities");
    expect(source).toContain("invokeToolCapability");
  });
});

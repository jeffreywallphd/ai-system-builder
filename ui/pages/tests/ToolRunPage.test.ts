import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolRunPage", () => {
  it("loads the selected tool with tool-first loading copy", () => {
    const source = readSource("ui/pages/ToolRunPage.tsx");
    expect(source).toContain("loadTool");
    expect(source).toContain("Preparing tool…");
    expect(source).toContain("Tool execution history");
    expect(source).toContain('toolId: selectedTool.id');
    expect(source).not.toContain("Loading workflow");
    expect(source).not.toContain("ContextInspectionPanel");
  });
});

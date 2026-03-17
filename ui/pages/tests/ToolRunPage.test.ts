import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolRunPage", () => {
  it("loads selected tool", () => {
    expect(readSource("ui/pages/ToolRunPage.tsx")).toContain("loadTool");
  });
});

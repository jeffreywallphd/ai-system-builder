import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolsPage", () => {
  it("uses tool store and browser", () => {
    const source = readSource("ui/pages/ToolsPage.tsx");
    expect(source).toContain("toolStore");
    expect(source).toContain("ToolBrowser");
  });
});

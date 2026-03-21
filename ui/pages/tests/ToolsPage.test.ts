import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolsPage", () => {
  it("creates separate find and create tabs for the tools experience", () => {
    const source = readSource("ui/pages/ToolsPage.tsx");
    expect(source).toContain("Find Tools");
    expect(source).toContain("Create Tool");
    expect(source).toContain("ToolBrowser");
    expect(source).toContain("ToolSearchBar");
    expect(source).toContain("McpLocalServerComposer");
    expect(source).toContain("toolStore.refreshTools");
    expect(source).toContain("workspace-local MCP tool");
  });
});

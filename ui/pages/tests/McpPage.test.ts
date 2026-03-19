import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("McpPage", () => {
  it("renders MCP server management wording and store actions", () => {
    const source = readSource("ui/pages/McpPage.tsx");

    expect(source).toContain("Manage your MCP servers");
    expect(source).toContain("McpServerBrowser");
    expect(source).toContain("mcpStore.initialize()");
    expect(source).toContain("mcpStore.addConfiguredServer");
    expect(source).toContain("mcpStore.connect");
    expect(source).toContain("mcpStore.disconnect");
    expect(source).toContain("mcpStore.searchTools");
    expect(source).toContain("mcpStore.selectTool");
  });
});

import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("McpPage", () => {
  it("renders local server creation and server lifecycle management wording", () => {
    const source = readSource("ui/pages/McpPage.tsx");

    expect(source).toContain("Create new local MCP servers");
    expect(source).toContain("McpLocalServerComposer");
    expect(source).toContain("mcpStore.createLocalServer");
    expect(source).toContain("mcpStore.connect");
    expect(source).toContain("mcpStore.disconnect");
    expect(source).toContain("MCP server operation history");
    expect(source).toContain('executionKind: "mcp-server-operation"');
  });
});

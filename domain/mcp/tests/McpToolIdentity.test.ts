import { describe, expect, it } from "bun:test";
import { buildMcpToolId, isMcpToolId, parseMcpToolId } from "../McpToolIdentity";

describe("McpToolIdentity", () => {
  it("normalizes canonical MCP tool ids", () => {
    const toolId = buildMcpToolId("docs/primary", "search docs");
    expect(toolId).toBe("mcp:docs%2Fprimary:search%20docs");

    const parsed = parseMcpToolId(toolId);
    expect(parsed.serverId).toBe("docs/primary");
    expect(parsed.toolName).toBe("search docs");
    expect(parsed.toolId).toBe(toolId);
  });

  it("rejects malformed ids", () => {
    expect(() => parseMcpToolId("workflow:abc")).toThrow("must use mcp");
  });

  it("supports bounded MCP identity checks", () => {
    expect(isMcpToolId("mcp:local:echo")).toBe(true);
    expect(isMcpToolId("workflow:slug")).toBe(false);
  });
});

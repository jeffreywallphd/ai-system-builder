import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpServerDetailsPanel from "../McpServerDetailsPanel";

describe("McpServerDetailsPanel", () => {
  it("renders selected server details with tool inspection wording", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpServerDetailsPanel, {
        server: {
          id: "local",
          name: "Local MCP",
          transport: "stdio",
          status: "connected",
          toolCount: 1,
          resourceCount: 0,
          connected: true,
        },
        status: {
          serverId: "local",
          connected: true,
          state: "connected",
          checkedAt: "2026-03-19T00:00:00.000Z",
        },
        tools: [
          {
            id: "mcp:local:echo",
            serverId: "local",
            source: { kind: "mcp-server", serverId: "local" },
            name: "echo",
            title: "Echo",
            description: "Repeat text.",
            inputSchema: { type: "object" },
            arguments: [{ name: "text", type: "string", required: true, schema: { type: "string" } }],
            categories: ["utility"],
            tags: ["text"],
          },
        ],
        isConfigured: true,
      })
    );

    expect(html).toContain("Inspect normalized MCP tool descriptors");
    expect(html).toContain("Unified capability mapping");
    expect(html).toContain("capabilityId=mcp:local:echo");
    expect(html).toContain("python-mcp-runtime");
  });
});

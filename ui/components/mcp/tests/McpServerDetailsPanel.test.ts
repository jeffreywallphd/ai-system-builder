import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpServerDetailsPanel from "../McpServerDetailsPanel";

describe("McpServerDetailsPanel", () => {
  it("renders selected server details with non-technical wording", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpServerDetailsPanel, {
        server: {
          id: "docs",
          name: "Docs MCP",
          transport: "http",
          url: "https://example.com/mcp",
          status: "disconnected",
          connected: false,
          toolCount: 3,
          resourceCount: 1,
          capabilities: { tools: true },
        },
        isConfigured: false,
      }),
    );

    expect(html).toContain("Docs MCP");
    expect(html).toContain("Available to add to My MCP Servers.");
    expect(html).toContain("Connection status");
    expect(html).toContain("Add to My MCP Servers");
  });
});

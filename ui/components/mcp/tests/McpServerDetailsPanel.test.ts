import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpServerDetailsPanel from "../McpServerDetailsPanel";

describe("McpServerDetailsPanel", () => {
  it("renders selected server details with tool inspection wording", () => {
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
        tools: [
          {
            id: "mcp:docs:search_docs",
            serverId: "docs",
            source: { kind: "mcp-server", serverId: "docs" },
            name: "search_docs",
            title: "Search Docs",
            description: "Search indexed documents.",
            inputSchema: { type: "object" },
            arguments: [{ name: "query", type: "string", required: true, schema: { type: "string" } }],
            categories: ["knowledge"],
            tags: ["docs", "search"],
          },
        ],
        selectedTool: {
          id: "mcp:docs:search_docs",
          serverId: "docs",
          source: { kind: "mcp-server", serverId: "docs" },
          name: "search_docs",
          title: "Search Docs",
          description: "Search indexed documents.",
          inputSchema: { type: "object" },
          arguments: [{ name: "query", type: "string", required: true, schema: { type: "string" } }],
          categories: ["knowledge"],
          tags: ["docs", "search"],
        },
        isConfigured: false,
      }),
    );

    expect(html).toContain("Docs MCP");
    expect(html).toContain("Available to add to My MCP Servers.");
    expect(html).toContain("Available tools");
    expect(html).toContain("Inspect normalized MCP tool descriptors");
    expect(html).toContain("Search Docs");
    expect(html).toContain("Input schema");
    expect(html).toContain("Add to My MCP Servers");
  });
});

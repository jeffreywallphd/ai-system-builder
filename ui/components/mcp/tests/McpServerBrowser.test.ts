import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpServerBrowser from "../McpServerBrowser";

describe("McpServerBrowser", () => {
  it("renders configured and discoverable sections", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpServerBrowser, {
        configuredServers: [
          {
            id: "local",
            name: "Local MCP",
            transport: "stdio",
            status: "connected",
            connected: true,
            toolCount: 2,
            resourceCount: 0,
            capabilities: { tools: true },
          },
        ],
        discoveredServers: [
          {
            id: "remote-docs",
            name: "Remote Docs MCP",
            transport: "http",
            status: "disconnected",
            connected: false,
            toolCount: 4,
            resourceCount: 0,
            capabilities: { tools: true },
          },
        ],
      }),
    );

    expect(html).toContain("My MCP Servers");
    expect(html).toContain("Discover MCP Servers");
    expect(html).toContain("Remote Docs MCP");
  });
});

import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpServerCard from "../McpServerCard";

describe("McpServerCard", () => {
  it("renders server name, friendly status text, and lifecycle actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpServerCard, {
        server: {
          id: "local",
          name: "Local MCP",
          transport: "stdio",
          status: "connected",
          connected: true,
          toolCount: 2,
          resourceCount: 0,
          capabilities: { tools: true },
        },
        isConfigured: true,
      }),
    );

    expect(html).toContain("Local MCP");
    expect(html).toContain("Connected");
    expect(html).toContain("Disconnect");
    expect(html).toContain("Reconnect");
  });
});

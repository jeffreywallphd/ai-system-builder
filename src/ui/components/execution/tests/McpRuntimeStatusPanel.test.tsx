import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import McpRuntimeStatusPanel from "../McpRuntimeStatusPanel";

describe("McpRuntimeStatusPanel", () => {
  it("renders MCP availability and discovered tool names", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpRuntimeStatusPanel, {
        status: {
          enabled: true,
          state: "ready",
          checkedAt: new Date().toISOString(),
          servers: [{ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } }],
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
        tools: [
          { serverId: "local", name: "echo", inputSchema: { type: "object" } },
          { serverId: "local", name: "sum_numbers", inputSchema: { type: "object" } },
        ],
      }),
    );

    expect(html).toContain("MCP Runtime");
    expect(html).toContain("Available");
    expect(html).toContain("echo, sum_numbers");
  });
});

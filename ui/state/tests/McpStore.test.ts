import { describe, expect, it } from "bun:test";
import { McpStore } from "../McpStore";
import { McpService } from "../../services/McpService";

function createService() {
  const configured = [
    {
      id: "local",
      name: "Local MCP",
      transport: "stdio",
      status: "disconnected",
      connected: false,
      toolCount: 2,
      resourceCount: 1,
      capabilities: { tools: true },
    },
  ];
  const discovered = [
    {
      id: "local",
      name: "Local MCP",
      transport: "stdio",
      status: "disconnected",
      connected: false,
      toolCount: 2,
      resourceCount: 1,
      capabilities: { tools: true },
    },
    {
      id: "remote-docs",
      name: "Remote Docs MCP",
      transport: "http",
      url: "https://example.com/mcp",
      status: "disconnected",
      connected: false,
      toolCount: 4,
      resourceCount: 0,
      capabilities: { tools: true },
    },
  ];

  return new McpService(
    { execute: async () => configured } as any,
    {
      execute: async ({ criteria }: { criteria?: { query?: string } }) => ({
        query: criteria?.query ?? "",
        totalCount: discovered.length,
        limit: 12,
        servers: criteria?.query ? discovered.filter((server) => server.name.toLowerCase().includes(criteria.query.toLowerCase())) : discovered,
        status: {
          enabled: true,
          state: "ready",
          checkedAt: new Date().toISOString(),
          servers: [],
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
      }),
    } as any,
    { execute: async ({ server }: { server: any }) => ({ ...server, status: "disconnected" }) } as any,
    {
      execute: async ({ serverId }: { serverId: string }) => ({
        serverId,
        name: serverId === "remote-docs" ? "Remote Docs MCP" : "Local MCP",
        transport: serverId === "remote-docs" ? "http" : "stdio",
        configured: true,
        enabled: true,
        state: serverId === "local" ? "connected" : "disconnected",
        connected: serverId === "local",
        checkedAt: new Date().toISOString(),
        toolCount: serverId === "local" ? 2 : 4,
        resourceCount: 0,
        capabilities: { tools: true },
      }),
    } as any,
    { execute: async () => ({ action: "connect" }) } as any,
    { execute: async () => ({ action: "disconnect" }) } as any,
    { execute: async () => ({ action: "reconnect" }) } as any,
  );
}

describe("McpStore", () => {
  it("loads configured servers and discovery results with a selected server", async () => {
    const store = new McpStore(createService());

    await store.initialize();

    expect(store.getState().configuredServers).toHaveLength(1);
    expect(store.getState().discoveredServers).toHaveLength(2);
    expect(store.getState().selectedServerId).toBe("local");
  });

  it("supports discovery search, add-to-configured, and connect/disconnect actions", async () => {
    const store = new McpStore(createService());

    await store.search({ query: "remote" });
    expect(store.getState().searchQuery).toBe("remote");
    expect(store.getState().discoveredServers[0]?.id).toBe("remote-docs");

    await store.addConfiguredServer("remote-docs");
    expect(store.getState().selectedServerId).toBe("remote-docs");

    await store.connect("local");
    await store.connect("local", true);
    await store.disconnect("local");

    expect(store.getState().error).toBeUndefined();
  });

  it("captures failures for MCP page state", async () => {
    const store = new McpStore(
      new McpService(
        { execute: async () => { throw new Error("catalog unavailable"); } } as any,
        { execute: async () => ({ query: "", totalCount: 0, limit: 12, servers: [], status: { enabled: false, state: "disabled", checkedAt: new Date().toISOString(), servers: [], capabilities: {} } }) } as any,
        { execute: async ({ server }: { server: any }) => server } as any,
        { execute: async ({ serverId }: { serverId: string }) => ({ serverId, state: "disconnected" }) } as any,
        { execute: async () => ({}) } as any,
        { execute: async () => ({}) } as any,
        { execute: async () => ({}) } as any,
      ),
    );

    await expect(store.refreshConfigured()).rejects.toThrow("catalog unavailable");
    expect(store.getState().error).toBe("catalog unavailable");
  });
});

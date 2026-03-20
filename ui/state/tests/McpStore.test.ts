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
  const toolsByServer = {
    local: [
      {
        id: "mcp:local:echo",
        serverId: "local",
        source: { kind: "mcp-server", serverId: "local" },
        name: "echo",
        title: "Echo",
        description: "Echo text back.",
        inputSchema: { type: "object" },
        arguments: [{ name: "message", type: "string", required: true, schema: { type: "string" } }],
        categories: ["utility"],
        tags: ["text"],
      },
    ],
    "remote-docs": [
      {
        id: "mcp:remote-docs:search_docs",
        serverId: "remote-docs",
        source: { kind: "mcp-server", serverId: "remote-docs" },
        name: "search_docs",
        title: "Search Docs",
        description: "Search docs.",
        inputSchema: { type: "object" },
        arguments: [{ name: "query", type: "string", required: true, schema: { type: "string" } }],
        categories: ["knowledge"],
        tags: ["docs", "search"],
      },
    ],
  } as const;

  return new McpService(
    { execute: async () => configured } as any,
    {
      execute: async ({ criteria }: { criteria?: { query?: string } }) => ({
        query: criteria?.query ?? "",
        totalCount: discovered.length,
        limit: 12,
        servers: criteria?.query ? discovered.filter((server) => server.name.toLowerCase().includes((criteria.query ?? "").toLowerCase())) : discovered,
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
      execute: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: new Date().toISOString(),
        servers: [],
        capabilities: { tools: true, resources: false, toolExecution: true },
      }),
    } as any,
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
    {
      execute: async ({ query }: { query?: { serverIds?: string[]; query?: string } }) => {
        const serverId = query?.serverIds?.[0] as keyof typeof toolsByServer | undefined;
        const tools = serverId ? toolsByServer[serverId] ?? [] : [];
        const filtered = query?.query
          ? tools.filter((tool) => `${tool.name} ${tool.description}`.toLowerCase().includes((query.query ?? "").toLowerCase()))
          : tools;
        return {
          query: query?.query ?? "",
          totalCount: filtered.length,
          limit: 10,
          tools: filtered,
        };
      },
    } as any,
    {
      execute: async ({ toolId }: { toolId: string }) => Object.values(toolsByServer).flat().find((tool) => tool.id === toolId),
    } as any,
  );
}

describe("McpStore", () => {
  it("loads configured servers, discovery results, and selected server tools", async () => {
    const store = new McpStore(createService());

    await store.initialize();

    expect(store.getState().configuredServers).toHaveLength(1);
    expect(store.getState().discoveredServers).toHaveLength(2);
    expect(store.getState().runtimeStatus?.state).toBe("ready");
    expect(store.getState().selectedServerId).toBe("local");
    expect(store.getState().selectedServerTools[0]?.id).toBe("mcp:local:echo");
    expect(store.getState().selectedToolDescriptor?.name).toBe("echo");
  });

  it("supports discovery search, add-to-configured, tool search, and connect/disconnect actions", async () => {
    const store = new McpStore(createService());

    await store.search({ query: "remote" });
    expect(store.getState().searchQuery).toBe("remote");
    expect(store.getState().discoveredServers[0]?.id).toBe("remote-docs");

    await store.addConfiguredServer("remote-docs");
    expect(store.getState().selectedServerId).toBe("remote-docs");

    await store.searchTools("search");
    expect(store.getState().toolSearchQuery).toBe("search");
    expect(store.getState().selectedServerTools[0]?.id).toBe("mcp:remote-docs:search_docs");

    await store.selectTool("mcp:remote-docs:search_docs");
    expect(store.getState().selectedToolDescriptor?.name).toBe("search_docs");

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
        { execute: async () => ({ enabled: false, state: "disabled", checkedAt: new Date().toISOString(), servers: [], capabilities: {} }) } as any,
        { execute: async ({ serverId }: { serverId: string }) => ({ serverId, state: "disconnected" }) } as any,
        { execute: async () => ({}) } as any,
        { execute: async () => ({}) } as any,
        { execute: async () => ({}) } as any,
        { execute: async () => ({ query: "", totalCount: 0, limit: 10, tools: [] }) } as any,
        { execute: async () => undefined } as any,
      ),
    );

    await expect(store.refreshConfigured()).rejects.toThrow("catalog unavailable");
    expect(store.getState().error).toBe("catalog unavailable");
  });
});

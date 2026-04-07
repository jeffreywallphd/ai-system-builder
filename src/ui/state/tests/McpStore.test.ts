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
    "workspace-helper": [
      {
        id: "mcp:workspace-helper:process_payload",
        serverId: "workspace-helper",
        source: { kind: "mcp-server", serverId: "workspace-helper" },
        name: "process_payload",
        title: "Process Payload",
        description: "Process payload.",
        inputSchema: { type: "object" },
        arguments: [],
        categories: ["workspace"],
        tags: ["local"],
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
        name: serverId,
        transport: serverId === "remote-docs" ? "http" : "stdio",
        configured: true,
        enabled: true,
        state: serverId === "local" ? "connected" : "disconnected",
        connected: serverId === "local",
        checkedAt: new Date().toISOString(),
        toolCount: 1,
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
    {
      execute: async ({ draft }: { draft: any }) => ({
        created: true,
        server: {
          id: draft.serverId,
          name: draft.serverName,
          transport: "stdio",
          status: "disconnected",
          connected: false,
          toolCount: 1,
          resourceCount: 1,
          capabilities: { tools: true },
        },
      }),
    } as any,
    {
      execute: async ({ prompt }: { prompt: string }) => ({
        toolName: "summarize_notes",
        toolTitle: "Summarize Notes",
        toolDescription: prompt,
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        code: 'return {"summary": payload.get("input", "")}',
      }),
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
  });

  it("supports AI draft generation and local server creation", async () => {
    const store = new McpStore(createService());
    store.setAuthoringPrompt("summarize release notes");

    await store.generateAuthoringDraft();
    expect(store.getState().authoringDraft.toolName).toBe("summarize_notes");

    store.updateAuthoringDraft({ serverId: "workspace-helper", serverName: "Workspace Helper" });
    await store.createLocalServer();

    expect(store.getState().selectedServerId).toBe("workspace-helper");
    expect(store.getState().error).toBeUndefined();
  });
});

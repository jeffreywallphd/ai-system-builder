import { describe, expect, it } from "bun:test";
import { McpStore } from "../McpStore";
import { McpService } from "../../services/McpService";

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  return new McpService(
    {
      execute: async () => ({
        status: {
          enabled: true,
          state: "ready",
          checkedAt: new Date().toISOString(),
          servers: [],
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
        tools: [
          { serverId: "local", name: "echo", inputSchema: { type: "object" } },
          { serverId: "local", name: "sum_numbers", inputSchema: { type: "object" } },
        ],
        resources: [],
      }),
    } as any,
    { execute: async () => [{ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } }] } as any,
    {
      execute: async ({ criteria }: { criteria?: { query?: string } }) => ({
        query: criteria?.query ?? "",
        totalCount: 1,
        limit: 20,
        servers: [
          { id: "local", name: "Local MCP", transport: "inmemory", status: criteria?.query ? "connected" : "disconnected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } },
        ],
        status: {
          enabled: true,
          state: "ready",
          checkedAt: new Date().toISOString(),
          servers: [],
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
      }),
    } as any,
    { execute: async () => ({ serverId: "local", name: "Local MCP", transport: "inmemory", configured: true, enabled: true, state: "connected", connected: true, checkedAt: new Date().toISOString(), toolCount: 2, resourceCount: 0, capabilities: { tools: true } }) } as any,
    { execute: async () => ({ action: "connect", checkedAt: new Date().toISOString(), server: { id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }, status: { serverId: "local", name: "Local MCP", transport: "inmemory", configured: true, enabled: true, state: "connected", connected: true, checkedAt: new Date().toISOString(), toolCount: 1, resourceCount: 0, capabilities: { tools: true, resources: false, toolExecution: true } }, runtime: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: true, resources: false, toolExecution: true } } }) } as any,
    { execute: async () => ({ action: "disconnect", checkedAt: new Date().toISOString(), server: { id: "local", name: "Local MCP", transport: "inmemory", status: "disconnected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }, status: { serverId: "local", name: "Local MCP", transport: "inmemory", configured: true, enabled: true, state: "disconnected", connected: false, checkedAt: new Date().toISOString(), toolCount: 1, resourceCount: 0, capabilities: { tools: true, resources: false, toolExecution: true } }, runtime: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: true, resources: false, toolExecution: true } } }) } as any,
    { execute: async () => ({ action: "reconnect", checkedAt: new Date().toISOString(), server: { id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }, status: { serverId: "local", name: "Local MCP", transport: "inmemory", configured: true, enabled: true, state: "connected", connected: true, checkedAt: new Date().toISOString(), toolCount: 1, resourceCount: 0, capabilities: { tools: true, resources: false, toolExecution: true } }, runtime: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: true, resources: false, toolExecution: true } } }) } as any,
  );
}

describe("McpStore", () => {
  it("loads MCP availability, discovered tools, and searchable servers", async () => {
    const store = new McpStore(createService());

    await store.refresh();

    expect(store.getState().status?.state).toBe("ready");
    expect(store.getState().tools).toHaveLength(2);
    expect(store.getState().servers).toHaveLength(1);
    expect(store.getState().servers[0]?.name).toBe("Local MCP");
  });

  it("supports server search and connection lifecycle refreshes", async () => {
    const store = new McpStore(createService());

    await store.search("local");
    expect(store.getState().searchQuery).toBe("local");
    expect(store.getState().servers[0]?.status).toBe("connected");

    await store.connect("local");
    await store.connect("local", true);
    await store.disconnect("local");

    expect(store.getState().servers[0]?.id).toBe("local");
  });

  it("captures MCP loading failures", async () => {
    const store = new McpStore(
      new McpService(
        {
          execute: async () => {
            throw new Error("runtime offline");
          },
        } as any,
        { execute: async () => [] } as any,
        { execute: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: false, state: "disabled", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: false, resources: false, toolExecution: false } } }) } as any,
        { execute: async () => ({ serverId: "local", name: "Local MCP", transport: "inmemory", configured: true, enabled: true, state: "disconnected", connected: false, checkedAt: new Date().toISOString(), toolCount: 0, resourceCount: 0, capabilities: {} }) } as any,
        { execute: async () => { throw new Error("unused"); } } as any,
        { execute: async () => { throw new Error("unused"); } } as any,
        { execute: async () => { throw new Error("unused"); } } as any,
      ),
    );

    await expect(store.refresh()).rejects.toThrow("runtime offline");
    expect(store.getState().error).toBe("runtime offline");
  });
});

import { describe, expect, it } from "bun:test";
import { McpStore } from "../McpStore";
import { McpService } from "../../services/McpService";

describe("McpStore", () => {
  it("loads MCP availability, discovered tools, and searchable servers", async () => {
    const service = new McpService(
      {
        execute: async () => ({
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
      } as any,
      {
        execute: async () => ({
          query: "",
          totalCount: 1,
          limit: 20,
          servers: [
            { id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } },
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
      { execute: async () => ({ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } }) } as any,
      { execute: async () => { throw new Error("unused"); } } as any,
      { execute: async () => { throw new Error("unused"); } } as any,
    );
    const store = new McpStore(service);

    await store.refresh();

    expect(store.getState().status?.state).toBe("ready");
    expect(store.getState().tools).toHaveLength(2);
    expect(store.getState().servers).toHaveLength(1);
    expect(store.getState().servers[0]?.name).toBe("Local MCP");
  });

  it("supports server search and connection lifecycle refreshes", async () => {
    const calls: string[] = [];
    const service = new McpService(
      {
        execute: async () => ({
          status: {
            enabled: true,
            state: "ready",
            checkedAt: new Date().toISOString(),
            servers: [],
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          tools: [],
        }),
      } as any,
      {
        execute: async ({ criteria }: { criteria?: { query?: string } }) => {
          calls.push(criteria?.query ?? "");
          return {
            query: criteria?.query ?? "",
            totalCount: 1,
            limit: 20,
            servers: [
              { id: "local", name: "Local MCP", transport: "inmemory", status: criteria?.query ? "connected" : "disconnected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } },
            ],
            status: {
              enabled: true,
              state: "ready",
              checkedAt: new Date().toISOString(),
              servers: [],
              capabilities: { tools: true, resources: false, toolExecution: true },
            },
          };
        },
      } as any,
      { execute: async () => ({ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }) } as any,
      { execute: async () => ({ action: "connect", checkedAt: new Date().toISOString(), server: { id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }, status: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: true, resources: false, toolExecution: true } } }) } as any,
      { execute: async () => ({ action: "disconnect", checkedAt: new Date().toISOString(), server: { id: "local", name: "Local MCP", transport: "inmemory", status: "disconnected", toolCount: 1, resourceCount: 0, capabilities: { tools: true } }, status: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: true, resources: false, toolExecution: true } } }) } as any,
    );
    const store = new McpStore(service);

    await store.search("local");
    expect(store.getState().searchQuery).toBe("local");
    expect(store.getState().servers[0]?.status).toBe("connected");

    await store.connect("local");
    await store.disconnect("local");

    expect(calls).toContain("local");
  });

  it("captures MCP loading failures", async () => {
    const store = new McpStore(
      new McpService(
        {
          execute: async () => {
            throw new Error("runtime offline");
          },
        } as any,
        { execute: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: false, state: "disabled", checkedAt: new Date().toISOString(), servers: [], capabilities: { tools: false, resources: false, toolExecution: false } } }) } as any,
        { execute: async () => ({ id: "local", name: "Local MCP", transport: "inmemory", status: "disconnected", toolCount: 0, resourceCount: 0, capabilities: {} }) } as any,
        { execute: async () => { throw new Error("unused"); } } as any,
        { execute: async () => { throw new Error("unused"); } } as any,
      ),
    );

    await expect(store.refresh()).rejects.toThrow("runtime offline");
    expect(store.getState().error).toBe("runtime offline");
  });
});

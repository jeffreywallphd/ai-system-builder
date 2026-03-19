import { describe, expect, it } from "bun:test";
import { SearchMcpServersUseCase } from "../SearchMcpServersUseCase";
import type { IMcpRuntimeClient } from "../../ports/interfaces/IMcpRuntimeClient";

describe("SearchMcpServersUseCase", () => {
  it("normalizes bounded criteria and returns a serializable deduplicated result set", async () => {
    const criteriaCalls: unknown[] = [];
    const client: IMcpRuntimeClient = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [],
        capabilities: { tools: true, resources: true, toolExecution: true },
      }),
      listServers: async () => ({
        query: "",
        totalCount: 0,
        limit: 20,
        servers: [],
        status: {
          enabled: true,
          state: "ready",
          checkedAt: "2026-03-19T00:00:00.000Z",
          servers: [],
          capabilities: { tools: true, resources: true, toolExecution: true },
        },
      }),
      searchServers: async (criteria) => {
        criteriaCalls.push(criteria);
        return {
          query: criteria?.query ?? "",
          totalCount: 2,
          limit: criteria?.limit ?? 20,
          servers: [
            {
              id: "local",
              name: " Local MCP ",
              transport: "inmemory",
              status: "disconnected",
              toolCount: 2,
              resourceCount: 1,
              capabilities: { tools: true, resources: true, toolExecution: true },
              metadata: { provider: "demo" },
            },
            {
              id: "local",
              name: "Duplicate MCP",
              transport: "inmemory",
              status: "connected",
              toolCount: 99,
              resourceCount: 99,
              capabilities: { tools: true },
            },
          ],
          status: {
            enabled: true,
            state: "ready",
            checkedAt: "2026-03-19T00:00:00.000Z",
            servers: [],
            capabilities: { tools: true, resources: true, toolExecution: true },
          },
        };
      },
      connectServer: async () => {
        throw new Error("unused");
      },
      disconnectServer: async () => {
        throw new Error("unused");
      },
      listTools: async () => [],
      executeTool: async () => {
        throw new Error("unused");
      },
    };

    const result = await new SearchMcpServersUseCase(client).execute({
      criteria: {
        query: "  local  ",
        statuses: ["connected", "disconnected", "connected"],
        transports: ["inmemory", "inmemory"],
        limit: 999,
      },
    });

    expect(criteriaCalls).toEqual([
      {
        query: "local",
        statuses: ["connected", "disconnected"],
        transports: ["inmemory"],
        limit: 24,
      },
    ]);
    expect(result.limit).toBe(24);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]).toMatchObject({
      id: "local",
      name: "Local MCP",
      toolCount: 2,
      resourceCount: 1,
    });
    expect(JSON.parse(JSON.stringify(result)).servers[0]?.id).toBe("local");
    expect(Object.isFrozen(result)).toBeTrue();
  });
});

import { describe, expect, it } from "bun:test";
import { ListConfiguredMcpServersUseCase } from "../ListConfiguredMcpServersUseCase";
import type { IMcpServerCatalog } from "../../ports/interfaces/IMcpServerCatalog";

const catalog: IMcpServerCatalog = {
  getConnectionStatus: async () => ({
    enabled: true,
    state: "ready",
    checkedAt: "2026-03-19T00:00:00.000Z",
    servers: [],
    capabilities: { tools: true, resources: false, toolExecution: true },
  }),
  listConfiguredServers: async () => [
    {
      id: "local",
      name: "Local MCP",
      transport: "stdio",
      enabled: true,
      command: "python",
      args: ["server.py"],
      status: "disconnected",
      connected: false,
      toolCount: 0,
      resourceCount: 0,
      capabilities: { tools: false, resources: false, toolExecution: false },
    },
  ],
  getServerStatus: async () => ({
    serverId: "local",
    name: "Local MCP",
    transport: "stdio",
    configured: true,
    enabled: true,
    state: "disconnected",
    connected: false,
    checkedAt: "2026-03-19T00:00:00.000Z",
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
  }),
};

describe("ListConfiguredMcpServersUseCase", () => {
  it("returns an immutable copy of configured servers", async () => {
    const result = await new ListConfiguredMcpServersUseCase(catalog).execute();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("local");
    expect(Object.isFrozen(result)).toBe(true);
  });
});

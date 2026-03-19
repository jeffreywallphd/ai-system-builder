import { describe, expect, it } from "bun:test";
import { PythonBackedMcpServerCatalog } from "../PythonBackedMcpServerCatalog";
import { HttpMcpServerRuntimeClient } from "../HttpMcpServerRuntimeClient";

describe("PythonBackedMcpServerCatalog", () => {
  it("lists configured servers via the runtime client", async () => {
    const catalog = new PythonBackedMcpServerCatalog({
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
          status: "disconnected",
          connected: false,
          toolCount: 0,
          resourceCount: 0,
          capabilities: { tools: false, resources: false, toolExecution: false },
        },
      ],
    } as HttpMcpServerRuntimeClient);

    const result = await catalog.listConfiguredServers();

    expect(result[0]?.id).toBe("local");
  });

  it("looks up a single server status from the runtime status payload", async () => {
    const catalog = new PythonBackedMcpServerCatalog({
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [
          {
            serverId: "local",
            name: "Local MCP",
            transport: "stdio",
            configured: true,
            enabled: true,
            state: "connected",
            connected: true,
            checkedAt: "2026-03-19T00:00:00.000Z",
            toolCount: 1,
            resourceCount: 0,
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
        ],
        capabilities: { tools: true, resources: false, toolExecution: true },
      }),
      listConfiguredServers: async () => [],
    } as HttpMcpServerRuntimeClient);

    const result = await catalog.getServerStatus(" local ");

    expect(result.serverId).toBe("local");
    expect(result.state).toBe("connected");
  });
});

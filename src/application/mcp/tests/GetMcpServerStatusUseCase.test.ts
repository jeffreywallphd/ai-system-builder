import { describe, expect, it } from "bun:test";
import { GetMcpServerStatusUseCase } from "../GetMcpServerStatusUseCase";
import type { IMcpServerCatalog } from "../../ports/interfaces/IMcpServerCatalog";

describe("GetMcpServerStatusUseCase", () => {
  it("delegates a normalized server status lookup", async () => {
    const requests: string[] = [];
    const catalog: IMcpServerCatalog = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [],
        capabilities: { tools: true, resources: false, toolExecution: true },
      }),
      listConfiguredServers: async () => [],
      getServerStatus: async (serverId) => {
        requests.push(serverId);
        return {
          serverId,
          name: "Local MCP",
          transport: "stdio",
          configured: true,
          enabled: true,
          state: "connected",
          connected: true,
          checkedAt: "2026-03-19T00:00:00.000Z",
          connectedAt: "2026-03-19T00:00:00.000Z",
          toolCount: 2,
          resourceCount: 0,
          capabilities: { tools: true, resources: false, toolExecution: true },
        };
      },
    };

    const result = await new GetMcpServerStatusUseCase(catalog).execute({ serverId: " local " });

    expect(result.serverId).toBe("local");
    expect(requests).toEqual(["local"]);
  });

  it("rejects blank server identifiers", async () => {
    const catalog: IMcpServerCatalog = {
      getConnectionStatus: async () => ({
        enabled: false,
        state: "disabled",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [],
        capabilities: { tools: false, resources: false, toolExecution: false },
      }),
      listConfiguredServers: async () => [],
      getServerStatus: async () => {
        throw new Error("unused");
      },
    };

    await expect(new GetMcpServerStatusUseCase(catalog).execute({ serverId: "   " })).rejects.toThrow("serverId");
  });
});

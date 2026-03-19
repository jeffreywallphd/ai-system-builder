import { describe, expect, it } from "bun:test";
import { DisconnectMcpServerUseCase } from "../DisconnectMcpServerUseCase";
import type { IMcpRuntimeClient } from "../../ports/interfaces/IMcpRuntimeClient";

describe("DisconnectMcpServerUseCase", () => {
  it("delegates a normalized disconnect request", async () => {
    const requests: unknown[] = [];
    const client: IMcpRuntimeClient = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [],
        capabilities: { tools: true, resources: false, toolExecution: true },
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
          capabilities: { tools: true, resources: false, toolExecution: true },
        },
      }),
      searchServers: async () => {
        throw new Error("unused");
      },
      connectServer: async () => {
        throw new Error("unused");
      },
      disconnectServer: async (serverId) => {
        requests.push(serverId);
        return {
          action: "disconnect",
          checkedAt: "2026-03-19T00:00:00.000Z",
          server: {
            id: serverId,
            name: "Local MCP",
            transport: "inmemory",
            status: "disconnected",
            toolCount: 2,
            resourceCount: 0,
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          status: {
            enabled: true,
            state: "ready",
            checkedAt: "2026-03-19T00:00:00.000Z",
            servers: [],
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
        };
      },
      listTools: async () => [],
      executeTool: async () => {
        throw new Error("unused");
      },
    };

    const result = await new DisconnectMcpServerUseCase(client).execute({ serverId: " local " });

    expect(result.server.status).toBe("disconnected");
    expect(requests).toEqual(["local"]);
  });
});

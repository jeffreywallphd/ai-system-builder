import { describe, expect, it } from "bun:test";
import { ConnectMcpServerUseCase } from "../ConnectMcpServerUseCase";
import type { IMcpRuntimeClient } from "../../ports/interfaces/IMcpRuntimeClient";

describe("ConnectMcpServerUseCase", () => {
  it("delegates a normalized connect or reconnect request", async () => {
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
      connectServer: async (request) => {
        requests.push(request);
        return {
          action: request.reconnect ? "reconnect" : "connect",
          checkedAt: "2026-03-19T00:00:00.000Z",
          server: {
            id: request.serverId,
            name: "Local MCP",
            transport: "inmemory",
            status: "connected",
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
      disconnectServer: async () => {
        throw new Error("unused");
      },
      listTools: async () => [],
      executeTool: async () => {
        throw new Error("unused");
      },
    };

    const result = await new ConnectMcpServerUseCase(client).execute({ serverId: " local ", reconnect: true });

    expect(result.action).toBe("reconnect");
    expect(requests).toEqual([{ serverId: "local", reconnect: true }]);
  });

  it("rejects blank server identifiers", async () => {
    const client: IMcpRuntimeClient = {
      getConnectionStatus: async () => ({
        enabled: false,
        state: "disabled",
        checkedAt: "2026-03-19T00:00:00.000Z",
        servers: [],
        capabilities: { tools: false, resources: false, toolExecution: false },
      }),
      listServers: async () => ({
        query: "",
        totalCount: 0,
        limit: 20,
        servers: [],
        status: {
          enabled: false,
          state: "disabled",
          checkedAt: "2026-03-19T00:00:00.000Z",
          servers: [],
          capabilities: { tools: false, resources: false, toolExecution: false },
        },
      }),
      searchServers: async () => {
        throw new Error("unused");
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

    await expect(new ConnectMcpServerUseCase(client).execute({ serverId: "  " })).rejects.toThrow("serverId");
  });
});

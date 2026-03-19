import { describe, expect, it } from "bun:test";
import { GetMcpServerStatusUseCase } from "../GetMcpServerStatusUseCase";
import type { IMcpRuntimeClient } from "../../ports/interfaces/IMcpRuntimeClient";

describe("GetMcpServerStatusUseCase", () => {
  it("returns the matching configured server descriptor", async () => {
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
        totalCount: 2,
        limit: 20,
        servers: [
          {
            id: "local",
            name: "Local MCP",
            transport: "inmemory",
            status: "connected",
            toolCount: 2,
            resourceCount: 0,
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          {
            id: "remote",
            name: "Remote MCP",
            transport: "http",
            status: "disconnected",
            toolCount: 0,
            resourceCount: 0,
            capabilities: { tools: false, resources: false, toolExecution: false },
          },
        ],
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
      disconnectServer: async () => {
        throw new Error("unused");
      },
      listTools: async () => [],
      executeTool: async () => {
        throw new Error("unused");
      },
    };

    const result = await new GetMcpServerStatusUseCase(client).execute({ serverId: " local " });

    expect(result.status).toBe("connected");
    expect(result.name).toBe("Local MCP");
  });

  it("rejects unknown server identifiers", async () => {
    const client: IMcpRuntimeClient = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
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
          enabled: true,
          state: "ready",
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

    await expect(new GetMcpServerStatusUseCase(client).execute({ serverId: "missing" })).rejects.toThrow("Unknown MCP server");
  });
});

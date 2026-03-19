import { describe, expect, it } from "bun:test";
import { ConnectMcpServerUseCase } from "../ConnectMcpServerUseCase";
import type { IMcpServerManager } from "../../ports/interfaces/IMcpServerManager";

function buildResult(serverId: string) {
  return {
    action: "connect" as const,
    checkedAt: "2026-03-19T00:00:00.000Z",
    server: {
      id: serverId,
      name: "Local MCP",
      transport: "stdio" as const,
      enabled: true,
      command: "python",
      args: ["server.py"],
      status: "connected" as const,
      connected: true,
      toolCount: 2,
      resourceCount: 0,
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    status: {
      serverId,
      name: "Local MCP",
      transport: "stdio" as const,
      configured: true,
      enabled: true,
      state: "connected" as const,
      connected: true,
      checkedAt: "2026-03-19T00:00:00.000Z",
      connectedAt: "2026-03-19T00:00:00.000Z",
      toolCount: 2,
      resourceCount: 0,
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    runtime: {
      enabled: true,
      state: "ready" as const,
      checkedAt: "2026-03-19T00:00:00.000Z",
      servers: [],
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
  };
}

describe("ConnectMcpServerUseCase", () => {
  it("delegates a normalized connect request", async () => {
    const requests: unknown[] = [];
    const manager: IMcpServerManager = {
      connectServer: async (request) => {
        requests.push(request);
        return buildResult(request.serverId);
      },
      disconnectServer: async () => {
        throw new Error("unused");
      },
      reconnectServer: async () => {
        throw new Error("unused");
      },
    };

    const result = await new ConnectMcpServerUseCase(manager).execute({ serverId: " local " });

    expect(result.action).toBe("connect");
    expect(requests).toEqual([{ serverId: "local" }]);
  });

  it("rejects blank server identifiers", async () => {
    const manager: IMcpServerManager = {
      connectServer: async () => buildResult("unused"),
      disconnectServer: async () => buildResult("unused"),
      reconnectServer: async () => buildResult("unused"),
    };

    await expect(new ConnectMcpServerUseCase(manager).execute({ serverId: "  " })).rejects.toThrow("serverId");
  });
});

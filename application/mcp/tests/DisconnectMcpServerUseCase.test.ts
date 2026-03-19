import { describe, expect, it } from "bun:test";
import { DisconnectMcpServerUseCase } from "../DisconnectMcpServerUseCase";
import type { IMcpServerManager } from "../../ports/interfaces/IMcpServerManager";

function buildResult(serverId: string) {
  return {
    action: "disconnect" as const,
    checkedAt: "2026-03-19T00:00:00.000Z",
    server: {
      id: serverId,
      name: "Local MCP",
      transport: "stdio" as const,
      enabled: true,
      status: "disconnected" as const,
      connected: false,
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
      state: "disconnected" as const,
      connected: false,
      checkedAt: "2026-03-19T00:00:00.000Z",
      disconnectedAt: "2026-03-19T00:00:00.000Z",
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

describe("DisconnectMcpServerUseCase", () => {
  it("delegates a normalized disconnect request", async () => {
    const requests: string[] = [];
    const manager: IMcpServerManager = {
      connectServer: async () => {
        throw new Error("unused");
      },
      disconnectServer: async (serverId) => {
        requests.push(serverId);
        return buildResult(serverId);
      },
      reconnectServer: async () => {
        throw new Error("unused");
      },
    };

    const result = await new DisconnectMcpServerUseCase(manager).execute({ serverId: " local " });

    expect(result.server.status).toBe("disconnected");
    expect(requests).toEqual(["local"]);
  });

  it("rejects blank server identifiers", async () => {
    const manager: IMcpServerManager = {
      connectServer: async () => buildResult("unused"),
      disconnectServer: async () => buildResult("unused"),
      reconnectServer: async () => buildResult("unused"),
    };

    await expect(new DisconnectMcpServerUseCase(manager).execute({ serverId: "  " })).rejects.toThrow("serverId");
  });
});

import { describe, expect, it } from "bun:test";
import { ReconnectMcpServerUseCase } from "../ReconnectMcpServerUseCase";
import type { IMcpServerManager } from "../../ports/interfaces/IMcpServerManager";

function buildResult(serverId: string) {
  return {
    action: "reconnect" as const,
    checkedAt: "2026-03-19T00:00:00.000Z",
    server: {
      id: serverId,
      name: "Local MCP",
      transport: "stdio" as const,
      enabled: true,
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
      metadata: { reconnect: true },
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

describe("ReconnectMcpServerUseCase", () => {
  it("delegates a normalized reconnect request", async () => {
    const requests: string[] = [];
    const manager: IMcpServerManager = {
      connectServer: async () => {
        throw new Error("unused");
      },
      disconnectServer: async () => {
        throw new Error("unused");
      },
      reconnectServer: async (serverId) => {
        requests.push(serverId);
        return buildResult(serverId);
      },
    };

    const result = await new ReconnectMcpServerUseCase(manager).execute({ serverId: " local " });

    expect(result.action).toBe("reconnect");
    expect(requests).toEqual(["local"]);
  });

  it("rejects blank server identifiers", async () => {
    const manager: IMcpServerManager = {
      connectServer: async () => buildResult("unused"),
      disconnectServer: async () => buildResult("unused"),
      reconnectServer: async () => buildResult("unused"),
    };

    await expect(new ReconnectMcpServerUseCase(manager).execute({ serverId: "  " })).rejects.toThrow("serverId");
  });
});

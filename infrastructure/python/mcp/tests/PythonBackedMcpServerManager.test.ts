import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { PythonBackedMcpServerManager } from "../PythonBackedMcpServerManager";
import type { IMcpServerCatalog } from "../../../../application/ports/interfaces/IMcpServerCatalog";
import { HttpMcpServerRuntimeClient } from "../HttpMcpServerRuntimeClient";

function buildResult(action: "connect" | "disconnect" | "reconnect") {
  return {
    action,
    checkedAt: "2026-03-19T00:00:00.000Z",
    server: {
      id: "local",
      name: "Local MCP",
      transport: "stdio" as const,
      enabled: true,
      command: "python",
      args: ["server.py"],
      status: action === "disconnect" ? ("disconnected" as const) : ("connected" as const),
      connected: action !== "disconnect",
      toolCount: 1,
      resourceCount: 0,
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    status: {
      serverId: "local",
      name: "Local MCP",
      transport: "stdio" as const,
      configured: true,
      enabled: true,
      state: action === "disconnect" ? ("disconnected" as const) : ("connected" as const),
      connected: action !== "disconnect",
      checkedAt: "2026-03-19T00:00:00.000Z",
      toolCount: 1,
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

describe("PythonBackedMcpServerManager", () => {
  it("connects and reconnects stdio servers while emitting local start attempt events", async () => {
    const events = new RuntimeEventBuffer();
    const manager = new PythonBackedMcpServerManager(
      {
        connectServer: async () => buildResult("connect"),
        disconnectServer: async () => buildResult("disconnect"),
        reconnectServer: async () => buildResult("reconnect"),
        createLocalServer: async () => ({
          created: true,
          checkedAt: "2026-03-19T00:00:00.000Z",
          server: buildResult("connect").server,
          status: buildResult("connect").status,
          runtime: buildResult("connect").runtime,
        }),
      } as HttpMcpServerRuntimeClient,
      {
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
      } satisfies IMcpServerCatalog,
      { emit: (event) => events.append(event as never) },
    );

    const [connected, reconnected] = await Promise.all([
      manager.connectServer({ serverId: "local" }),
      manager.reconnectServer("local"),
    ]);

    expect(connected.action).toBe("connect");
    expect(reconnected.action).toBe("reconnect");
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-local-server-start-attempt",
      "mcp-local-server-start-attempt",
    ]);
  });

  it("disconnects without emitting a local start attempt event", async () => {
    const events = new RuntimeEventBuffer();
    const manager = new PythonBackedMcpServerManager(
      {
        connectServer: async () => buildResult("connect"),
        disconnectServer: async () => buildResult("disconnect"),
        reconnectServer: async () => buildResult("reconnect"),
        createLocalServer: async () => ({
          created: true,
          checkedAt: "2026-03-19T00:00:00.000Z",
          server: buildResult("connect").server,
          status: buildResult("connect").status,
          runtime: buildResult("connect").runtime,
        }),
      } as HttpMcpServerRuntimeClient,
      {
        getConnectionStatus: async () => ({
          enabled: true,
          state: "ready",
          checkedAt: "2026-03-19T00:00:00.000Z",
          servers: [],
          capabilities: { tools: true, resources: false, toolExecution: true },
        }),
        listConfiguredServers: async () => [],
        getServerStatus: async () => {
          throw new Error("unused");
        },
      } satisfies IMcpServerCatalog,
      { emit: (event) => events.append(event as never) },
    );

    const result = await manager.disconnectServer("local");

    expect(result.action).toBe("disconnect");
    expect(events.list()).toHaveLength(0);
  });
});

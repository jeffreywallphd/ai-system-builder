import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "@application/runtime/RuntimeEventBuffer";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { HttpMcpServerRuntimeClient } from "../HttpMcpServerRuntimeClient";

describe("HttpMcpServerRuntimeClient", () => {
  it("loads runtime status and emits lifecycle events", async () => {
    const events = new RuntimeEventBuffer();
    const client = new HttpMcpServerRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () =>
        new Response(
          JSON.stringify({
            enabled: true,
            state: "ready",
            checkedAt: "2026-03-19T00:00:00.000Z",
            servers: [],
            capabilities: { tools: true, resources: false, toolExecution: true },
          }),
          { status: 200 },
        )) as typeof fetch,
      { emit: (event) => events.append(event as never) },
    );

    const result = await client.getConnectionStatus();

    expect(result.state).toBe("ready");
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-status-check",
      "mcp-status-check",
    ]);
  });

  it("lists configured servers", async () => {
    const client = new HttpMcpServerRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () =>
        new Response(
          JSON.stringify({
            servers: [
              {
                id: "local",
                name: "Local MCP",
                transport: "stdio",
                enabled: true,
                command: "python",
                args: ["server.py"],
                status: "disconnected",
                connected: false,
                toolCount: 1,
                resourceCount: 0,
                capabilities: { tools: true, resources: false, toolExecution: true },
              },
            ],
          }),
          { status: 200 },
        )) as typeof fetch,
    );

    const result = await client.listConfiguredServers();

    expect(result[0]?.transport).toBe("stdio");
    expect(result[0]?.command).toBe("python");
  });

  it("connects, disconnects, and reconnects servers through dedicated endpoints", async () => {
    const calls: string[] = [];
    const client = new HttpMcpServerRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async (input) => {
        calls.push(String(input));
        return new Response(
          JSON.stringify({
            action: calls.at(-1)?.split("/").at(-1),
            checkedAt: "2026-03-19T00:00:00.000Z",
            server: {
              id: "local",
              name: "Local MCP",
              transport: "stdio",
              enabled: true,
              status: "connected",
              connected: true,
              toolCount: 1,
              resourceCount: 0,
              capabilities: { tools: true, resources: false, toolExecution: true },
            },
            status: {
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
            runtime: {
              enabled: true,
              state: "ready",
              checkedAt: "2026-03-19T00:00:00.000Z",
              servers: [],
              capabilities: { tools: true, resources: false, toolExecution: true },
            },
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    );

    await client.connectServer({ serverId: "local" });
    await client.disconnectServer("local");
    await client.reconnectServer("local");

    expect(calls).toEqual([
      "http://runtime/mcp/servers/connect",
      "http://runtime/mcp/servers/disconnect",
      "http://runtime/mcp/servers/reconnect",
    ]);
  });

  it("emits connection failure details when a request fails", async () => {
    const events = new RuntimeEventBuffer();
    const client = new HttpMcpServerRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () => new Response(JSON.stringify({ detail: "bad" }), { status: 503 })) as typeof fetch,
      { emit: (event) => events.append(event as never) },
    );

    await expect(client.connectServer({ serverId: "local" })).rejects.toThrow("503");
    expect(events.list().at(-1)?.details).toMatchObject({
      eventType: "mcp-connection-failure",
      action: "connect",
      serverId: "local",
    });
  });
});


import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { HttpMcpRuntimeClient } from "../HttpMcpRuntimeClient";

describe("HttpMcpRuntimeClient", () => {
  it("calls the MCP status endpoint and emits status events", async () => {
    const events = new RuntimeEventBuffer();
    const client = new HttpMcpRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () =>
        new Response(
          JSON.stringify({
            enabled: true,
            state: "ready",
            checkedAt: "2026-03-19T00:00:00.000Z",
            capabilities: { tools: true },
            servers: [],
          }),
          { status: 200 }
        )) as typeof fetch,
      { emit: (event) => events.append(event as never) }
    );

    const response = await client.getConnectionStatus();

    expect(response.state).toBe("ready");
    expect(events.list().map((event) => event.message)).toEqual([
      "MCP status check started.",
      "MCP status check completed.",
    ]);
  });

  it("searches MCP servers with bounded query params", async () => {
    const calls: string[] = [];
    const client = new HttpMcpRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async (input) => {
        calls.push(String(input));
        return new Response(
          JSON.stringify({
            query: "local",
            totalCount: 1,
            limit: 10,
            servers: [
              {
                id: "local",
                name: "Local MCP",
                transport: "inmemory",
                status: "disconnected",
                toolCount: 1,
                resourceCount: 0,
                capabilities: { tools: true, resources: false, toolExecution: true },
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
          { status: 200 }
        );
      }) as typeof fetch,
      { emit: (event) => events.append(event as never) }
    );
    const events = new RuntimeEventBuffer();

    const response = await client.searchServers({
      query: "local",
      statuses: ["disconnected"],
      transports: ["inmemory"],
      limit: 10,
    });

    expect(response.servers[0]?.id).toBe("local");
    expect(calls[0]).toContain("/mcp/servers/search?");
    expect(calls[0]).toContain("query=local");
    expect(calls[0]).toContain("status=disconnected");
    expect(calls[0]).toContain("transport=inmemory");
    expect(events.list().map((event) => event.details?.eventType)).toContain("mcp-server-search");
  });

  it("connects and disconnects MCP servers while emitting lifecycle events", async () => {
    const events = new RuntimeEventBuffer();
    const calls: Array<{ input: string; body?: string }> = [];
    const client = new HttpMcpRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async (input, init) => {
        calls.push({ input: String(input), body: init?.body as string | undefined });
        return new Response(
          JSON.stringify({
            action: String(input).endsWith("/connect") ? "connect" : "disconnect",
            checkedAt: "2026-03-19T00:00:00.000Z",
            server: {
              id: "local",
              name: "Local MCP",
              transport: "inmemory",
              status: String(input).endsWith("/connect") ? "connected" : "disconnected",
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
          }),
          { status: 200 }
        );
      }) as typeof fetch,
      { emit: (event) => events.append(event as never) }
    );

    await client.connectServer({ serverId: "local" });
    await client.disconnectServer("local");

    expect(calls).toEqual([
      { input: "http://runtime/mcp/servers/connect", body: JSON.stringify({ serverId: "local" }) },
      { input: "http://runtime/mcp/servers/disconnect", body: JSON.stringify({ serverId: "local" }) },
    ]);
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-server-connect",
      "mcp-server-connect",
      "mcp-server-disconnect",
      "mcp-server-disconnect",
    ]);
  });

  it("throws on non-2xx responses and emits connection failure details", async () => {
    const events = new RuntimeEventBuffer();
    const client = new HttpMcpRuntimeClient(
      new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://runtime" }),
      (async () => new Response(JSON.stringify({ error: "bad" }), { status: 503 })) as typeof fetch,
      { emit: (event) => events.append(event as never) }
    );

    await expect(client.getConnectionStatus()).rejects.toThrow("503");
    expect(events.list().at(-1)?.details).toMatchObject({ eventType: "mcp-connection-failure" });
  });
});

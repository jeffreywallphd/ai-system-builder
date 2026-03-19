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

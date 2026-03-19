import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { PythonBackedMcpToolCatalog } from "../PythonBackedMcpToolCatalog";

describe("PythonBackedMcpToolCatalog", () => {
  it("lists tools, resources, and emits discovery events", async () => {
    const events = new RuntimeEventBuffer();
    const catalog = new PythonBackedMcpToolCatalog(
      {
        getConnectionStatus: async () => ({
          enabled: true,
          state: "ready",
          checkedAt: "2026-03-19T00:00:00.000Z",
          capabilities: { tools: true },
          servers: [],
        }),
        listTools: async () => [{ serverId: "server", name: "echo", inputSchema: { type: "object" } }],
        listResources: async () => [{ serverId: "server", uri: "memory://guide", name: "Guide" }],
        executeTool: async () => {
          throw new Error("unused");
        },
      },
      { emit: (event) => events.append(event as never) }
    );

    const tools = await catalog.listTools();
    const resources = await catalog.listResources();

    expect(tools).toHaveLength(1);
    expect(resources).toEqual([{ serverId: "server", uri: "memory://guide", name: "Guide" }]);
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-tool-discovery",
      "mcp-tool-discovery",
    ]);
  });
});

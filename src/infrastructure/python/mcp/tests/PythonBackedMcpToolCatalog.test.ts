import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "@application/runtime/RuntimeEventBuffer";
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
        searchTools: async () => ({ query: "", totalCount: 0, limit: 20, tools: [] }),
        getToolDescriptor: async () => undefined,
        listResources: async () => [{ serverId: "server", uri: "memory://guide", name: "Guide" }],
        executeTool: async () => {
          throw new Error("unused");
        },
      },
      { emit: (event) => events.append(event as never) }
    );

    const tools = await catalog.listTools();
    const resources = await catalog.listResources();

    expect(tools[0]?.id).toBe("mcp:server:echo");
    expect(resources).toEqual([{ serverId: "server", uri: "memory://guide", name: "Guide" }]);
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-tool-discovery",
      "mcp-tool-discovery",
    ]);
  });

  it("searches and fetches normalized descriptors via the runtime client", async () => {
    const catalog = new PythonBackedMcpToolCatalog({
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        capabilities: { tools: true },
        servers: [],
      }),
      listTools: async () => [],
      searchTools: async () => ({
        query: "echo",
        totalCount: 1,
        limit: 10,
        tools: [
          {
            serverId: "server",
            name: "echo",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
            },
            metadata: { category: "utility", tags: ["text"] },
          },
        ],
      }),
      getToolDescriptor: async () => ({
        serverId: "server",
        name: "echo",
        inputSchema: { type: "object" },
        metadata: { category: "utility", tags: ["text"] },
      }),
      listResources: async () => [],
      executeTool: async () => {
        throw new Error("unused");
      },
    });

    const result = await catalog.searchTools({ query: "echo" });
    const descriptor = await catalog.getToolDescriptor("mcp:server:echo");

    expect(result.tools[0]?.categories).toEqual(["utility"]);
    expect(result.tools[0]?.arguments[0]?.name).toBe("message");
    expect(descriptor?.id).toBe("mcp:server:echo");
    expect(descriptor?.tags).toEqual(["text"]);
  });
});


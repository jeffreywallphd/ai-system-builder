import { describe, expect, it } from "bun:test";
import { ListMcpToolsUseCase } from "../ListMcpToolsUseCase";
import type { IMcpToolCatalog } from "../../ports/interfaces/IMcpToolCatalog";

describe("ListMcpToolsUseCase", () => {
  it("returns normalized status, tools, and resources from the catalog", async () => {
    const catalog: IMcpToolCatalog = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        capabilities: { tools: true, resources: true, toolExecution: true },
        servers: [
          {
            serverId: "local",
            name: "Local MCP",
            transport: "inmemory",
            configured: true,
            enabled: true,
            state: "connected",
            connected: true,
            checkedAt: "2026-03-19T00:00:00.000Z",
            toolCount: 1,
            resourceCount: 2,
            capabilities: { tools: true, resources: true, toolExecution: true },
          },
        ],
      }),
      listTools: async () => [
        {
          serverId: " local ",
          name: " echo ",
          title: "Echo",
          description: " Returns input. ",
          inputSchema: {
            type: "object",
            required: ["message"],
            properties: {
              message: { type: "string", description: "Text to echo" },
            },
          },
          metadata: { category: "utility", tags: [" text ", "echo"] },
        },
      ] as any,
      searchTools: async () => ({ query: "", totalCount: 0, limit: 20, tools: [] }),
      getToolDescriptor: async () => undefined,
      listResources: async () => [
        {
          serverId: "local",
          uri: "memory://docs/guide",
          name: "Guide",
        },
      ],
    };

    const result = await new ListMcpToolsUseCase(catalog).execute();

    expect(result.status.state).toBe("ready");
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      id: "mcp:local:echo",
      serverId: "local",
      name: "echo",
      categories: ["utility"],
      tags: ["echo", "text"],
    });
    expect(result.tools[0]?.arguments).toEqual([
      {
        name: "message",
        title: undefined,
        description: "Text to echo",
        type: "string",
        required: true,
        defaultValue: undefined,
        enumValues: undefined,
        format: undefined,
        schema: { type: "string", description: "Text to echo" },
      },
    ]);
    expect(result.resources).toEqual([
      {
        serverId: "local",
        uri: "memory://docs/guide",
        name: "Guide",
      },
    ]);
  });
});

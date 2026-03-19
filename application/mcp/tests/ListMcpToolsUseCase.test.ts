import { describe, expect, it } from "bun:test";
import { ListMcpToolsUseCase } from "../ListMcpToolsUseCase";
import type { IMcpToolCatalog } from "../../ports/interfaces/IMcpToolCatalog";

describe("ListMcpToolsUseCase", () => {
  it("returns status, tools, and resources from the catalog", async () => {
    const catalog: IMcpToolCatalog = {
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        capabilities: { tools: true, resources: true },
        servers: [
          {
            id: "local",
            name: "Local MCP",
            transport: "inmemory",
            status: "connected",
            toolCount: 1,
            resourceCount: 2,
            capabilities: { tools: true, resources: true },
          },
        ],
      }),
      listTools: async () => [
        {
          serverId: "local",
          name: "echo",
          title: "Echo",
          inputSchema: { type: "object" },
        },
      ],
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
    expect(result.tools[0]?.name).toBe("echo");
    expect(result.resources).toEqual([
      {
        serverId: "local",
        uri: "memory://docs/guide",
        name: "Guide",
      },
    ]);
  });
});

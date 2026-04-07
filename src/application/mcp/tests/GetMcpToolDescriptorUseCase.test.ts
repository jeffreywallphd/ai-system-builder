import { describe, expect, it } from "bun:test";
import { GetMcpToolDescriptorUseCase } from "../GetMcpToolDescriptorUseCase";
import type { IMcpToolCatalog } from "../../ports/interfaces/IMcpToolCatalog";

const catalog: IMcpToolCatalog = {
  getConnectionStatus: async () => ({
    enabled: true,
    state: "ready",
    checkedAt: "2026-03-19T00:00:00.000Z",
    capabilities: { tools: true, resources: false, toolExecution: true },
    servers: [],
  }),
  listTools: async () => [
    {
      serverId: "local",
      name: "echo",
      inputSchema: {
        type: "object",
        properties: { message: { type: "string" } },
      },
    },
  ] as any,
  listResources: async () => [],
};

describe("GetMcpToolDescriptorUseCase", () => {
  it("supports fallback lookup from listed tools", async () => {
    const descriptor = await new GetMcpToolDescriptorUseCase(catalog).execute({
      serverId: "local",
      toolName: "echo",
    });

    expect(descriptor).toMatchObject({
      id: "mcp:local:echo",
      serverId: "local",
      name: "echo",
    });
  });

  it("delegates to catalog descriptor lookup when available", async () => {
    const runtimeCatalog: IMcpToolCatalog = {
      ...catalog,
      getToolDescriptor: async (toolId) => toolId === "mcp:local:echo"
        ? ({
          id: toolId,
          serverId: "local",
          name: "echo",
          inputSchema: { type: "object" },
          categories: ["utility"],
          tags: ["text"],
        } as any)
        : undefined,
    };

    const descriptor = await new GetMcpToolDescriptorUseCase(runtimeCatalog).execute({ toolId: "mcp:local:echo" });

    expect(descriptor?.categories).toEqual(["utility"]);
    expect(descriptor?.tags).toEqual(["text"]);
  });

  it("requires a resolvable tool identity", async () => {
    await expect(new GetMcpToolDescriptorUseCase(catalog).execute({})).rejects.toThrow(
      "MCP tool descriptor lookup requires a toolId or a serverId plus toolName."
    );
  });
});

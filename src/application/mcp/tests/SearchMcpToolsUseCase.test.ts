import { describe, expect, it } from "bun:test";
import { SearchMcpToolsUseCase } from "../SearchMcpToolsUseCase";
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
      title: "Echo",
      description: "Echo text back to the caller.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Message to echo" },
        },
      },
      categories: ["utility"],
      tags: ["text", "debug"],
    },
    {
      serverId: "docs",
      name: "search_docs",
      title: "Search Docs",
      description: "Search indexed documentation.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query" },
        },
      },
      categories: ["knowledge"],
      tags: ["docs", "search"],
    },
  ] as any,
  listResources: async () => [],
};

describe("SearchMcpToolsUseCase", () => {
  it("filters tool descriptors locally when the catalog does not expose search", async () => {
    const result = await new SearchMcpToolsUseCase(catalog).execute({
      query: { query: "docs", tags: ["search"], serverIds: ["docs"] },
    });

    expect(result.query).toBe("docs");
    expect(result.totalCount).toBe(1);
    expect(result.tools[0]).toMatchObject({
      id: "mcp:docs:search_docs",
      serverId: "docs",
      categories: ["knowledge"],
      tags: ["docs", "search"],
    });
  });

  it("passes normalized search criteria through runtime-backed search when available", async () => {
    const calls: unknown[] = [];
    const runtimeCatalog: IMcpToolCatalog = {
      ...catalog,
      searchTools: async (query) => {
        calls.push(query);
        return {
          query: query?.query ?? "",
          totalCount: 1,
          limit: query?.limit ?? 20,
          tools: [
            {
              serverId: "local",
              name: "echo",
              title: "Echo",
              description: "Echo text back to the caller.",
              inputSchema: { type: "object" },
              categories: ["utility"],
              tags: ["text"],
            },
          ] as any,
        };
      },
    };

    const result = await new SearchMcpToolsUseCase(runtimeCatalog).execute({
      query: { query: " echo ", categories: [" utility "], limit: 99 },
    });

    expect(calls).toEqual([
      {
        query: "echo",
        categories: ["utility"],
        limit: 50,
        serverIds: undefined,
        tags: undefined,
      },
    ]);
    expect(result.limit).toBe(50);
    expect(result.tools[0]?.id).toBe("mcp:local:echo");
  });
});

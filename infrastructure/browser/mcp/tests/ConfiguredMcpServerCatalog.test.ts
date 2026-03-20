import { describe, expect, it } from "bun:test";
import { ConfiguredMcpServerCatalog } from "../ConfiguredMcpServerCatalog";

describe("ConfiguredMcpServerCatalog", () => {
  it("falls back to persisted servers when runtime listing fails", async () => {
    const catalog = new ConfiguredMcpServerCatalog(
      {
        getConnectionStatus: async () => ({
          enabled: true,
          state: "unavailable",
          checkedAt: new Date().toISOString(),
          servers: [],
          capabilities: {},
        }),
        listConfiguredServers: async () => {
          throw new Error("runtime unavailable");
        },
        getServerStatus: async () => {
          throw new Error("runtime unavailable");
        },
      } as any,
      {
        listConfiguredServers: async () => ([
          {
            id: "local",
            name: "Local MCP",
            transport: "stdio",
            status: "disconnected",
            connected: false,
            toolCount: 0,
            resourceCount: 0,
            capabilities: { tools: true },
          },
        ]),
      } as any,
    );

    const result = await catalog.listConfiguredServers();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("local");
  });
});

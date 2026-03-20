import { describe, expect, it, mock } from "bun:test";
import { McpService } from "../McpService";

describe("McpService", () => {
  it("delegates configured listing, discovery, lifecycle, and tool inspection actions", async () => {
    const listConfigured = mock(async () => [{ id: "local", name: "Local MCP" }]);
    const search = mock(async () => ({ query: "docs", totalCount: 1, limit: 12, servers: [{ id: "docs", name: "Docs MCP" }], status: { enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: {} } }));
    const addConfigured = mock(async ({ server }: { server: { id: string } }) => server);
    const getConnectionStatus = mock(async () => ({ enabled: true, state: "ready", checkedAt: new Date().toISOString(), servers: [], capabilities: {} }));
    const getStatus = mock(async ({ serverId }: { serverId: string }) => ({ serverId, state: "connected" }));
    const connect = mock(async ({ serverId }: { serverId: string }) => ({ action: "connect", server: { id: serverId } }));
    const disconnect = mock(async ({ serverId }: { serverId: string }) => ({ action: "disconnect", server: { id: serverId } }));
    const reconnect = mock(async ({ serverId }: { serverId: string }) => ({ action: "reconnect", server: { id: serverId } }));
    const searchTools = mock(async ({ query }: { query?: { serverIds?: string[] } }) => ({ query: query?.serverIds?.[0] ?? "", totalCount: 1, limit: 10, tools: [{ id: "mcp:docs:echo" }] }));
    const getToolDescriptor = mock(async ({ toolId }: { toolId: string }) => ({ id: toolId, name: "echo" }));

    const service = new McpService(
      { execute: listConfigured } as any,
      { execute: search } as any,
      { execute: addConfigured } as any,
      { execute: getConnectionStatus } as any,
      { execute: getStatus } as any,
      { execute: connect } as any,
      { execute: disconnect } as any,
      { execute: reconnect } as any,
      { execute: searchTools } as any,
      { execute: getToolDescriptor } as any,
    );

    await service.listConfiguredServers();
    await service.searchServers({ query: "docs" });
    await service.addConfiguredServer({ id: "docs", name: "Docs MCP" } as any);
    await service.getConnectionStatus();
    await service.getServerStatus("docs");
    await service.connectServer("docs");
    await service.disconnectServer("docs");
    await service.reconnectServer("docs");
    await service.searchTools({ serverIds: ["docs"] });
    await service.getToolDescriptor("mcp:docs:echo");

    expect(listConfigured).toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith({ criteria: { query: "docs" } });
    expect(addConfigured).toHaveBeenCalledWith({ server: { id: "docs", name: "Docs MCP" } });
    expect(getConnectionStatus).toHaveBeenCalled();
    expect(getStatus).toHaveBeenCalledWith({ serverId: "docs" });
    expect(connect).toHaveBeenCalledWith({ serverId: "docs" });
    expect(disconnect).toHaveBeenCalledWith({ serverId: "docs" });
    expect(reconnect).toHaveBeenCalledWith({ serverId: "docs" });
    expect(searchTools).toHaveBeenCalledWith({ query: { serverIds: ["docs"] } });
    expect(getToolDescriptor).toHaveBeenCalledWith({ toolId: "mcp:docs:echo" });
  });
});

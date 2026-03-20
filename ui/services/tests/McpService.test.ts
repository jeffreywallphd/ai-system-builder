import { describe, expect, it, mock } from "bun:test";
import { McpService } from "../McpService";

describe("McpService", () => {
  it("delegates configured listing, lifecycle, local authoring, and tool inspection actions", async () => {
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
    const createLocalServer = mock(async ({ draft }: { draft: { serverId: string } }) => ({ created: true, server: { id: draft.serverId } }));
    const generateDraft = mock(async ({ prompt }: { prompt: string }) => ({ toolName: "generated_tool", code: `# ${prompt}` }));

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
      { execute: createLocalServer } as any,
      { execute: generateDraft } as any,
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
    await service.createLocalServer({ serverId: "local-authoring", serverName: "Local", toolName: "tool", code: "return {}" } as any);
    await service.generateLocalToolDraft("summarize release notes", { serverId: "local-authoring", serverName: "Local", toolName: "tool", code: "return {}" } as any);

    expect(createLocalServer).toHaveBeenCalledWith({ draft: expect.objectContaining({ serverId: "local-authoring" }) });
    expect(generateDraft).toHaveBeenCalledWith(expect.objectContaining({ prompt: "summarize release notes" }));
  });
});

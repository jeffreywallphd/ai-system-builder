import { describe, expect, it } from "bun:test";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

function makeNode(id: string, type: string, properties: ReadonlyArray<NodeProperty> = []) {
  return new Node({
    id,
    definition: new NodeDefinition({ id: `def-${id}`, type, title: type, category: "MCP", executionKind: "generic", properties, inputPorts: [], outputPorts: [] }),
    properties,
  });
}

describe("MCP node truthfulness", () => {
  it("executes MCP tool nodes with delegated runtime provenance", async () => {
    const executor = new LangChainNodeExecutor({
      mcpRuntimeClient: {
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        connectServer: async () => { throw new Error("not used"); },
        disconnectServer: async () => { throw new Error("not used"); },
        listTools: async () => [],
        searchTools: async () => ({ query: "", totalCount: 1, limit: 20, tools: [{ id: "mcp:local:echo", serverId: "local", source: { kind: "mcp-server", serverId: "local" }, name: "echo", inputSchema: { type: "object" }, arguments: [], categories: [], tags: [], live: true }] }),
        getToolDescriptor: async () => undefined,
        executeTool: async () => ({ executionId: "exec-1", serverId: "local", toolName: "echo", status: "completed", content: [], structuredContent: { echoed: true } }),
      },
      mcpServerCatalog: {
        listConfiguredServers: async () => [],
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        getServerStatus: async () => ({ serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "connected", sessionState: "connected", connected: true, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} }),
      },
    });

    const result = await executor.executeNode({
      workflow: { id: "wf-1" } as never,
      node: makeNode("mcp-tool", "mcp.tool_call", [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "echo" }),
      ]),
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { arguments: { message: "hi" } },
    });

    expect(result.status).toBe("completed");
    expect(result.provenance?.classification).toBe("delegated");
    expect(result.provenance?.mcp?.status).toBe("live");
    expect(result.outputs.structuredResult).toEqual({ echoed: true });
  });
});

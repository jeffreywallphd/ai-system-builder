import { describe, expect, it } from "bun:test";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { ExecuteMcpToolUseCase } from "../../../../application/mcp/ExecuteMcpToolUseCase";
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
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase({
      executeTool: async () => ({
        executionId: "exec-1",
        serverId: "local",
        toolName: "echo",
        status: "completed",
        content: [],
        structuredContent: { echoed: true },
      }),
    });
    const executor = new LangChainNodeExecutor({
      executeMcpToolUseCase,
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
    expect(result.outputs.toolResult).toBeDefined();
    expect(result.outputs.structuredResult).toEqual({ echoed: true });
  });

  it("surfaces structured registry failures for MCP workflow nodes", async () => {
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase({
      executeTool: async () => ({ executionId: "exec-2", serverId: "local", toolName: "echo", status: "completed", content: [] }),
    }, undefined, {
      getInstalledTool: async () => ({
        toolId: "mcp:local:echo",
        status: "disabled",
        installedAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        source: { kind: "inline", location: "inline" },
        definition: {
          id: "mcp:local:echo",
          version: "1.0.0",
          displayName: "Echo",
          description: "Echo",
          provider: { serverId: "local", toolName: "echo" },
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          sideEffects: "none",
          auth: { kind: "none" },
          tags: [],
          categories: [],
        },
      }),
      listInstalledTools: async () => [],
      findInstalledToolByBinding: async () => ({
        toolId: "mcp:local:echo",
        status: "disabled",
        installedAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        source: { kind: "inline", location: "inline" },
        definition: {
          id: "mcp:local:echo",
          version: "1.0.0",
          displayName: "Echo",
          description: "Echo",
          provider: { serverId: "local", toolName: "echo" },
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          sideEffects: "none",
          auth: { kind: "none" },
          tags: [],
          categories: [],
        },
      }),
      saveInstalledTool: async (record) => record,
      removeInstalledTool: async () => false,
    } as never);
    const executor = new LangChainNodeExecutor({
      executeMcpToolUseCase,
      mcpRuntimeClient: {
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        connectServer: async () => { throw new Error("not used"); },
        disconnectServer: async () => { throw new Error("not used"); },
        listTools: async () => [],
        searchTools: async () => ({ query: "", totalCount: 1, limit: 20, tools: [] }),
        getToolDescriptor: async () => undefined,
        executeTool: async () => ({ executionId: "exec-2", serverId: "local", toolName: "echo", status: "failed", content: [] }),
      },
    });

    const result = await executor.executeNode({
      workflow: { id: "wf-2" } as never,
      node: makeNode("mcp-tool", "mcp.tool_call", [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "echo" }),
      ]),
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {},
    });

    expect(result.status).toBe("failed");
    expect((result.outputs.mcpError as Record<string, unknown>).code).toBe("tool-disabled");
  });

  it("merges configured constants with upstream argument inputs for MCP tool calls", async () => {
    const observedRequests: Array<Readonly<Record<string, unknown>>> = [];
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase({
      executeTool: async (request) => {
        observedRequests.push(request.arguments ?? {});
        return {
          executionId: "exec-3",
          serverId: "local",
          toolName: "echo",
          status: "completed",
          content: [],
          structuredContent: { ok: true },
        };
      },
    });
    const executor = new LangChainNodeExecutor({
      executeMcpToolUseCase,
      mcpRuntimeClient: {
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        connectServer: async () => { throw new Error("not used"); },
        disconnectServer: async () => { throw new Error("not used"); },
        listTools: async () => [],
        searchTools: async () => ({ query: "", totalCount: 1, limit: 20, tools: [] }),
        getToolDescriptor: async () => undefined,
        executeTool: async () => ({ executionId: "exec-3", serverId: "local", toolName: "echo", status: "completed", content: [], structuredContent: { ok: true } }),
      },
      mcpServerCatalog: {
        listConfiguredServers: async () => [],
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        getServerStatus: async () => ({ serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "connected", sessionState: "connected", connected: true, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} }),
      },
    });

    await executor.executeNode({
      workflow: { id: "wf-3" } as never,
      node: makeNode("mcp-tool", "mcp.tool_call", [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "echo" }),
        new NodeProperty({ id: "arg.message", name: "Message", type: "text", value: "from-constant" }),
      ]),
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { arguments: { fromUpstream: "yes" } },
    });

    expect(observedRequests[0]).toEqual({
      message: "from-constant",
      fromUpstream: "yes",
    });
  });

  it("passes asset-backed argument payloads through the workflow MCP node into MCP execution", async () => {
    const observedRequests: Array<Readonly<Record<string, unknown>>> = [];
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase({
      executeTool: async (request) => {
        observedRequests.push(request.arguments ?? {});
        return {
          executionId: "exec-4",
          serverId: "local",
          toolName: "asset-tool",
          status: "completed",
          content: [],
          structuredContent: { transformed: true },
        };
      },
    });
    const executor = new LangChainNodeExecutor({
      executeMcpToolUseCase,
      mcpRuntimeClient: {
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        connectServer: async () => { throw new Error("not used"); },
        disconnectServer: async () => { throw new Error("not used"); },
        listTools: async () => [],
        searchTools: async () => ({ query: "", totalCount: 1, limit: 20, tools: [] }),
        getToolDescriptor: async () => undefined,
        executeTool: async () => ({ executionId: "exec-4", serverId: "local", toolName: "asset-tool", status: "completed", content: [], structuredContent: { transformed: true } }),
      },
      mcpServerCatalog: {
        listConfiguredServers: async () => [],
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        getServerStatus: async () => ({ serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "connected", sessionState: "connected", connected: true, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} }),
      },
    });

    await executor.executeNode({
      workflow: { id: "wf-4" } as never,
      node: makeNode("mcp-tool", "mcp.tool_call", [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "asset-tool" }),
      ]),
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {
        arguments: {
          source: {
            assetId: "asset-input",
            versionId: "asset-input:v1",
          },
        },
      },
    });

    expect((observedRequests[0]?.source as Record<string, unknown>).assetId).toBe("asset-input");
    expect((observedRequests[0]?.source as Record<string, unknown>).versionId).toBe("asset-input:v1");
  });

  it("normalizes runtime-declared MCP failures into workflow error outputs", async () => {
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase({
      executeTool: async () => ({
        executionId: "exec-5",
        serverId: "local",
        toolName: "echo",
        status: "failed",
        content: [],
        errorMessage: "Runtime timeout",
      }),
    });
    const executor = new LangChainNodeExecutor({
      executeMcpToolUseCase,
      mcpRuntimeClient: {
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} } }),
        connectServer: async () => { throw new Error("not used"); },
        disconnectServer: async () => { throw new Error("not used"); },
        listTools: async () => [],
        searchTools: async () => ({ query: "", totalCount: 0, limit: 20, tools: [] }),
        getToolDescriptor: async () => undefined,
        executeTool: async () => ({ executionId: "exec-5", serverId: "local", toolName: "echo", status: "failed", content: [], errorMessage: "Runtime timeout" }),
      },
      mcpServerCatalog: {
        listConfiguredServers: async () => [],
        getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-21T00:00:00.000Z", servers: [], capabilities: {} }),
        getServerStatus: async () => ({ serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "connected", sessionState: "connected", connected: true, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} }),
      },
    });

    const result = await executor.executeNode({
      workflow: { id: "wf-5" } as never,
      node: makeNode("mcp-tool", "mcp.tool_call", [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "echo" }),
      ]),
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: {},
    });

    expect(result.status).toBe("failed");
    expect(result.outputs.toolResult).toBeUndefined();
    expect((result.outputs.mcpError as Record<string, unknown>).code).toBe("execution-failed");
    expect((result.outputs.mcpError as Record<string, unknown>).category).toBe("runtime");
  });
});

import { describe, expect, it } from "bun:test";
import { Workflow } from "../../../../src/domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../../src/domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../../../../domain/nodes/NodePort";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { WorkflowConnection } from "../../../../src/domain/workflows/WorkflowConnection";
import { ExecuteMcpToolUseCase } from "../../../../application/mcp/ExecuteMcpToolUseCase";
import { DefaultNodeExecutionContextResolver } from "../DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "../DefaultNodeOutputStore";
import { InterpretedWorkflowExecutionStrategy } from "../InterpretedWorkflowExecutionStrategy";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

describe("Infrastructure InterpretedWorkflowExecutionStrategy", () => {
  it("runs interpreted execution and completes", async () => {
    const workflow = new Workflow({
      id: "wf",
      metadata: new WorkflowMetadata({ name: "wf" }),
      nodes: [makeNode({ id: "n1" })],
      connections: [],
    });

    const strategy = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: new LangChainNodeExecutor(),
      contextResolver: new DefaultNodeExecutionContextResolver(),
      outputStoreFactory: () => new DefaultNodeOutputStore(),
    });

    const result = await strategy.execute({ workflow });
    expect(result.status).toBe("completed");
  });

  it("executes MCP nodes as native workflow units and forwards outputs to downstream nodes", async () => {
    const mcpDefinition = new NodeDefinition({
      id: "def-mcp",
      type: "mcp.tool_call",
      title: "MCP Tool",
      category: "MCP",
      executionKind: "utility",
      properties: [
        new NodeProperty({ id: "serverId", name: "Server", type: "text", value: "local" }),
        new NodeProperty({ id: "toolName", name: "Tool", type: "text", value: "echo" }),
      ],
      inputPorts: [],
      outputPorts: [
        new NodePort({
          id: "resultText",
          name: "Result Text",
          direction: "output",
          compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
        }),
      ],
    });
    const sinkDefinition = new NodeDefinition({
      id: "def-sink",
      type: "test",
      title: "Sink",
      category: "utility",
      executionKind: "generic",
      properties: [],
      inputPorts: [
        new NodePort({
          id: "in",
          name: "In",
          direction: "input",
          compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"], isOptional: true }),
        }),
      ],
      outputPorts: [
        new NodePort({
          id: "result",
          name: "Result",
          direction: "output",
          compatibility: new NodePortCompatibilityProfile({ valueTypes: ["text"] }),
        }),
      ],
    });

    const mcpNode = new Node({ id: "mcp-node", definition: mcpDefinition });
    const sinkNode = new Node({ id: "sink-node", definition: sinkDefinition });
    const workflow = new Workflow({
      id: "wf-mcp-native",
      metadata: new WorkflowMetadata({ name: "wf-mcp-native" }),
      nodes: [mcpNode, sinkNode],
      connections: [
        new WorkflowConnection({
          id: "mcp-to-sink",
          source: { nodeId: "mcp-node", portId: "resultText" },
          target: { nodeId: "sink-node", portId: "in" },
        }),
      ],
    });

    const outputStore = new DefaultNodeOutputStore();
    const strategy = new InterpretedWorkflowExecutionStrategy({
      nodeExecutor: new LangChainNodeExecutor({
        executeMcpToolUseCase: new ExecuteMcpToolUseCase({
          executeTool: async () => ({
            executionId: "exec-native-1",
            serverId: "local",
            toolName: "echo",
            status: "completed",
            content: [],
            structuredContent: { echoed: true },
          }),
        }),
        mcpRuntimeClient: {
          getConnectionStatus: async () => ({ enabled: true, state: "ready", checkedAt: "2026-03-24T00:00:00.000Z", servers: [], capabilities: {} }),
          listServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-24T00:00:00.000Z", servers: [], capabilities: {} } }),
          searchServers: async () => ({ query: "", totalCount: 0, limit: 20, servers: [], status: { enabled: true, state: "ready", checkedAt: "2026-03-24T00:00:00.000Z", servers: [], capabilities: {} } }),
          connectServer: async () => { throw new Error("unused"); },
          disconnectServer: async () => { throw new Error("unused"); },
          listTools: async () => [],
          searchTools: async () => ({ query: "", totalCount: 0, limit: 20, tools: [] }),
          getToolDescriptor: async () => undefined,
          executeTool: async () => ({ executionId: "exec-native-1", serverId: "local", toolName: "echo", status: "completed", content: [], structuredContent: { echoed: true } }),
        },
      }),
      contextResolver: new DefaultNodeExecutionContextResolver(),
      outputStoreFactory: () => outputStore,
    });

    const result = await strategy.execute({ workflow });

    expect(result.status).toBe("completed");
    const sinkOutput = outputStore.getNodeOutput("sink-node");
    expect(typeof sinkOutput?.result).toBe("string");
    expect(String(sinkOutput?.result)).toContain("\"echoed\": true");
  });
});

import { describe, expect, it, mock } from "bun:test";
import { McpToolCallAuthoringService } from "../McpToolCallAuthoringService";
import { ImplementationRegistryNodeCatalogProvider } from "../../../src/infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "../../../src/infrastructure/nodes/mcp/McpNodeImplementationRegistry";
import { Workflow } from "../../../src/domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../src/domain/workflows/WorkflowMetadata";
import {
  MCP_TOOL_CALL_SERVER_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY,
  MCP_TOOL_CALL_TOOL_NAME_PROPERTY,
} from "../../../application/mcp/McpToolCallNodeConfigurationService";

describe("McpToolCallAuthoringService", () => {
  it("skips MCP lookups when the workflow has no MCP nodes", async () => {
    const listConfiguredServers = mock(async () => {
      throw new Error("should not be called");
    });
    const service = new McpToolCallAuthoringService({
      listConfiguredServers,
      searchTools: async () => ({ query: "", totalCount: 0, limit: 10, tools: [] }),
      getToolDescriptor: async () => undefined,
    } as any);
    const workflow = new Workflow({
      id: "wf-plain",
      metadata: new WorkflowMetadata({ name: "Plain" }),
      nodes: [],
    });

    await expect(service.hydrateWorkflow(workflow)).resolves.toBe(workflow);
    expect(listConfiguredServers).not.toHaveBeenCalled();
  });

  it("keeps MCP nodes usable when runtime-backed lookups fail", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(new McpNodeImplementationRegistry());
    const definition = await provider.getDefinitionByType("mcp.tool_call");
    if (!definition) {
      throw new Error("Expected mcp.tool_call definition.");
    }

    const node = definition.createInstance("call-1")
      .withPropertyValue(MCP_TOOL_CALL_SERVER_ID_PROPERTY, "local")
      .withPropertyValue(MCP_TOOL_CALL_TOOL_ID_PROPERTY, "mcp:local:echo")
      .withPropertyValue(MCP_TOOL_CALL_TOOL_NAME_PROPERTY, "echo")
      .withPropertyValue(MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY, {
        id: "mcp:local:echo",
        serverId: "local",
        source: { kind: "mcp-server", serverId: "local" },
        name: "echo",
        title: "Echo",
        inputSchema: { type: "object" },
        arguments: [{ name: "message", type: "string", required: true, schema: { type: "string" } }],
        categories: [],
        tags: [],
      });
    const workflow = new Workflow({
      id: "wf-mcp",
      metadata: new WorkflowMetadata({ name: "MCP Workflow" }),
      nodes: [node],
    });
    const service = new McpToolCallAuthoringService({
      listConfiguredServers: async () => {
        throw new Error("catalog unavailable");
      },
      searchTools: async () => {
        throw new Error("tool search unavailable");
      },
      getToolDescriptor: async () => {
        throw new Error("descriptor unavailable");
      },
    } as any);

    const hydrated = await service.hydrateWorkflow(workflow);
    const hydratedNode = hydrated.getNode("call-1");

    expect(hydratedNode?.getProperty(MCP_TOOL_CALL_SERVER_ID_PROPERTY)?.value).toBe("local");
    expect(hydratedNode?.getProperty(MCP_TOOL_CALL_TOOL_ID_PROPERTY)?.value).toBe("mcp:local:echo");
    expect(hydratedNode?.getProperty(MCP_TOOL_CALL_TOOL_NAME_PROPERTY)?.value).toBe("echo");
    expect(hydratedNode?.getProperty("arg.message")?.name).toBe("message");
  });
});

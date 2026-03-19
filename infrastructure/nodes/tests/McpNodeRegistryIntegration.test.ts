import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "../mcp/McpNodeImplementationRegistry";

describe("McpNodeImplementationRegistry integration", () => {
  it("registers the bounded MCP workflow nodes with catalog metadata", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new McpNodeImplementationRegistry(),
    );

    const definitions = await provider.getAllDefinitions();
    const toolCatalog = definitions.find((definition) => definition.type === "mcp.tool_catalog");
    const toolCall = definitions.find((definition) => definition.type === "mcp.tool_call");

    expect(definitions.map((definition) => definition.type)).toEqual([
      "mcp.tool_catalog",
      "mcp.tool_call",
    ]);
    expect(toolCatalog?.title).toBe("List MCP Tools");
    expect(toolCatalog?.executionKind).toBe("source");
    expect(toolCatalog?.outputPorts.map((port) => port.id)).toEqual([
      "tools",
      "toolCount",
      "status",
    ]);

    expect(toolCall?.title).toBe("Run MCP Tool");
    expect(toolCall?.category).toBe("MCP / Tools");
    expect(toolCall?.inputPorts.map((port) => port.id)).toEqual(["tool", "arguments"]);
    expect(toolCall?.outputPorts.map((port) => port.id)).toEqual([
      "result",
      "structuredContent",
      "resultText",
    ]);
    expect(toolCall?.properties.map((property) => property.id)).toEqual([
      "serverId",
      "toolName",
    ]);
  });

  it("keeps MCP node metadata canonical and workflow-meaningful", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new McpNodeImplementationRegistry(),
    );

    const toolCall = await provider.getDefinitionByType("mcp.tool_call");
    const toolCatalog = await provider.getDefinitionByType("mcp.tool_catalog");

    expect(toolCall?.description).toContain("Run an MCP tool from a workflow");
    expect(toolCall?.getProperty("serverId")?.constraints?.required).toBeTrue();
    expect(toolCall?.getInputPort("tool")?.compatibility.valueTypes).toEqual(["json", "text"]);
    expect(toolCall?.getOutputPort("result")?.compatibility.valueTypes).toEqual([
      "json",
      "tool-result",
    ]);

    expect(toolCatalog?.description).toContain("which MCP tools are available");
    expect(toolCatalog?.inputPorts).toHaveLength(0);
    expect(toolCatalog?.getOutputPort("toolCount")?.compatibility.valueTypes).toEqual(["number"]);
  });
});

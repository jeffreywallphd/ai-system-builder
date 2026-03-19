import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "../ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "../mcp/McpNodeImplementationRegistry";

function definitionByType(type: string) {
  return new ImplementationRegistryNodeCatalogProvider(
    new McpNodeImplementationRegistry(),
  ).getDefinitionByType(type);
}

describe("McpNodeImplementationRegistry integration", () => {
  it("registers the first workflow-valid MCP node set with catalog metadata", async () => {
    const provider = new ImplementationRegistryNodeCatalogProvider(
      new McpNodeImplementationRegistry(),
    );

    const definitions = await provider.getAllDefinitions();
    const serverSelect = definitions.find((definition) => definition.type === "mcp.server_select");
    const toolCatalog = definitions.find((definition) => definition.type === "mcp.tool_catalog");
    const toolCall = definitions.find((definition) => definition.type === "mcp.tool_call");

    expect(definitions.map((definition) => definition.type)).toEqual([
      "mcp.server_select",
      "mcp.tool_catalog",
      "mcp.tool_call",
    ]);

    expect(serverSelect?.title).toBe("Choose MCP Server");
    expect(serverSelect?.executionKind).toBe("selector");
    expect(serverSelect?.isVisibleInBasicMode).toBe(false);
    expect(serverSelect?.outputPorts.map((port) => port.id)).toEqual([
      "serverHandle",
      "connectionStatus",
    ]);
    expect(serverSelect?.properties.map((property) => property.id)).toEqual([
      "serverId",
      "autoConnect",
      "allowReconnect",
    ]);

    expect(toolCatalog?.title).toBe("List MCP Tools");
    expect(toolCatalog?.executionKind).toBe("source");
    expect(toolCatalog?.inputPorts.map((port) => port.id)).toEqual(["serverHandle"]);
    expect(toolCatalog?.outputPorts.map((port) => port.id)).toEqual(["tools"]);

    expect(toolCall?.title).toBe("Run MCP Tool");
    expect(toolCall?.category).toBe("MCP / Tools");
    expect(toolCall?.inputPorts.map((port) => port.id)).toEqual([
      "serverHandle",
      "tool",
      "arguments",
    ]);
    expect(toolCall?.outputPorts.map((port) => port.id)).toEqual([
      "toolResult",
      "resultText",
    ]);
    expect(toolCall?.properties.map((property) => property.id)).toEqual([
      "stringifyResult",
      "failOnMissingArgs",
    ]);
  });

  it("keeps MCP node metadata canonical, meaningful, and projection-aware", async () => {
    const registry = new McpNodeImplementationRegistry();
    const serverSelectImpl = registry.findByNodeType("mcp.server_select");
    const toolCatalogImpl = registry.findByNodeType("mcp.tool_catalog");
    const toolCallImpl = registry.findByNodeType("mcp.tool_call");

    const serverSelect = await definitionByType("mcp.server_select");
    const toolCatalog = await definitionByType("mcp.tool_catalog");
    const toolCall = await definitionByType("mcp.tool_call");

    expect(serverSelect?.description).toContain("configured MCP server");
    expect(serverSelect?.getProperty("serverId")?.constraints?.required).toBeTrue();
    expect(serverSelect?.getProperty("autoConnect")?.defaultValue).toBe(true);
    expect(serverSelectImpl?.descriptor.nodeDefinition?.technicalName).toBe("mcp.server_select");
    expect(serverSelectImpl?.descriptor.nodeDefinition?.projection?.supportsToolView).toBe(false);
    expect(serverSelectImpl?.descriptor.metadata?.isAdvancedInfrastructure).toBe(true);

    expect(toolCatalog?.getInputPort("serverHandle")?.compatibility.valueTypes).toEqual([
      "json",
      "workflow-state",
    ]);
    expect(toolCatalog?.getProperty("searchQuery")?.defaultValue).toBe("");
    expect(toolCatalogImpl?.descriptor.nodeDefinition?.projection?.supportsAuthoringView).toBe(true);

    expect(toolCall?.description).toContain("structured arguments");
    expect(toolCall?.getInputPort("tool")?.compatibility.valueTypes).toEqual(["json", "text"]);
    expect(toolCall?.getOutputPort("toolResult")?.compatibility.valueTypes).toEqual([
      "json",
      "tool-result",
    ]);
    expect(toolCall?.getProperty("stringifyResult")?.defaultValue).toBe(true);
    expect(toolCall?.getProperty("failOnMissingArgs")?.defaultValue).toBe(true);
    expect(toolCallImpl?.descriptor.metadata?.infrastructureBoundary).toBe("tool-usage");
  });
});

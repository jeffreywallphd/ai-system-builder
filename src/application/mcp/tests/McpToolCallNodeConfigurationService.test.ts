import { describe, expect, it } from "bun:test";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "@infrastructure/nodes/mcp/McpNodeImplementationRegistry";
import {
  McpToolCallNodeConfigurationService,
  MCP_TOOL_CALL_SERVER_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY,
  MCP_TOOL_CALL_TOOL_NAME_PROPERTY,
} from "../McpToolCallNodeConfigurationService";

async function createToolCallNode() {
  const provider = new ImplementationRegistryNodeCatalogProvider(new McpNodeImplementationRegistry());
  const definition = await provider.getDefinitionByType("mcp.tool_call");
  if (!definition) {
    throw new Error("Expected mcp.tool_call definition.");
  }

  return definition.createInstance("call-1");
}

describe("McpToolCallNodeConfigurationService", () => {
  it("maps discovered schema arguments into editable node properties", async () => {
    const service = new McpToolCallNodeConfigurationService();
    const node = await createToolCallNode();

    const configured = service.configureNode(node.withPropertyValue(MCP_TOOL_CALL_SERVER_ID_PROPERTY, "local"), {
      serverOptions: [{ label: "Local MCP", value: "local" }],
      toolOptions: [{ label: "Search Docs", value: "search_docs" }],
      toolDescriptor: {
        id: "mcp:local:search_docs",
        serverId: "local",
        source: { kind: "mcp-server", serverId: "local" },
        name: "search_docs",
        title: "Search Docs",
        description: "Search the docs index.",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", title: "Query", description: "Search terms." },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 3 },
            includeDrafts: { type: "boolean", default: false },
            tags: { type: "array", items: { enum: ["api", "guides", "reference"] } },
          },
        },
        arguments: [
          { name: "query", title: "Query", description: "Search terms.", type: "string", required: true, schema: { type: "string" } },
          { name: "limit", type: "integer", required: false, defaultValue: 3, schema: { type: "integer", minimum: 1, maximum: 10, default: 3 } },
          { name: "includeDrafts", type: "boolean", required: false, defaultValue: false, schema: { type: "boolean", default: false } },
          { name: "tags", type: "array", required: false, schema: { type: "array", items: { enum: ["api", "guides", "reference"] } } },
        ],
        categories: [],
        tags: [],
      },
    });

    expect(configured.getProperty(MCP_TOOL_CALL_SERVER_ID_PROPERTY)?.type).toBe("select");
    expect(configured.getProperty(MCP_TOOL_CALL_TOOL_NAME_PROPERTY)?.type).toBe("select");
    expect(configured.getProperty(MCP_TOOL_CALL_TOOL_ID_PROPERTY)?.value).toBe("mcp:local:search_docs");
    expect(configured.getProperty(MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY)?.projection?.authorVisibility).toBe("hidden");
    expect(configured.getProperty("arg.query")?.name).toBe("Query");
    expect(configured.getProperty("arg.query")?.constraints?.required).toBeTrue();
    expect(configured.getProperty("arg.limit")?.type).toBe("integer");
    expect(configured.getProperty("arg.limit")?.defaultValue).toBe(3);
    expect(configured.getProperty("arg.includeDrafts")?.type).toBe("boolean");
    expect(configured.getProperty("arg.tags")?.type).toBe("multi-select");
    expect(configured.getProperty("arg.tags")?.options?.map((option) => option.value)).toEqual([
      "api",
      "guides",
      "reference",
    ]);
  });

  it("preserves matching entered values while regenerating for a new tool schema", async () => {
    const service = new McpToolCallNodeConfigurationService();
    const node = await createToolCallNode();

    const initiallyConfigured = service.configureNode(node, {
      toolDescriptor: {
        id: "mcp:local:tool_a",
        serverId: "local",
        source: { kind: "mcp-server", serverId: "local" },
        name: "tool_a",
        inputSchema: { type: "object" },
        arguments: [
          { name: "query", type: "string", required: true, schema: { type: "string" } },
          { name: "limit", type: "integer", required: false, schema: { type: "integer" } },
        ],
        categories: [],
        tags: [],
      },
    });

    const withValues = initiallyConfigured
      .withPropertyValue("arg.query", "workflow registry")
      .withPropertyValue("arg.limit", 5);

    const reconfigured = service.configureNode(withValues, {
      toolDescriptor: {
        id: "mcp:local:tool_b",
        serverId: "local",
        source: { kind: "mcp-server", serverId: "local" },
        name: "tool_b",
        inputSchema: { type: "object" },
        arguments: [
          { name: "query", type: "string", required: true, schema: { type: "string" } },
          { name: "category", type: "string", required: false, schema: { type: "string", default: "docs" } },
        ],
        categories: [],
        tags: [],
      },
    });

    expect(reconfigured.getProperty("arg.query")?.value).toBe("workflow registry");
    expect(reconfigured.getProperty(MCP_TOOL_CALL_TOOL_ID_PROPERTY)?.value).toBe("mcp:local:tool_b");
    expect(reconfigured.getProperty("arg.limit")).toBeUndefined();
    expect(reconfigured.getProperty("arg.category")?.value).toBe("docs");
  });

  it("serializes configured argument fields into an invocation-ready object", async () => {
    const service = new McpToolCallNodeConfigurationService();
    const node = await createToolCallNode();
    const configured = service
      .configureNode(node, {
        toolDescriptor: {
          id: "mcp:local:echo",
          serverId: "local",
          source: { kind: "mcp-server", serverId: "local" },
          name: "echo",
          inputSchema: { type: "object" },
          arguments: [
            { name: "message", type: "string", required: true, schema: { type: "string" } },
            { name: "uppercase", type: "boolean", required: false, schema: { type: "boolean", default: false } },
          ],
          categories: [],
          tags: [],
        },
      })
      .withPropertyValue("arg.message", "hello")
      .withPropertyValue("arg.uppercase", true);

    expect(service.serializeConfiguredArguments(configured)).toEqual({
      message: "hello",
      uppercase: true,
    });
  });
});


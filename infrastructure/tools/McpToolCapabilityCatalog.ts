import type { McpToolDescriptor } from "../../application/mcp/models/McpToolDescriptor";
import type { IMcpToolCatalog } from "../../application/ports/interfaces/IMcpToolCatalog";
import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";
import { createToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";

export const MCP_TOOL_CAPABILITY_PROVIDER = Object.freeze({
  kind: "mcp",
  id: "python-mcp-runtime",
  label: "MCP Tools",
} as const);

export function mapMcpToolToCapability(tool: McpToolDescriptor): ToolCapabilityDescriptor {
  return createToolCapabilityDescriptor({
    id: tool.id,
    identity: Object.freeze({
      stableId: tool.id,
      providerScopedId: `${tool.serverId}:${tool.name}`,
    }),
    routingName: tool.name,
    displayName: tool.title ?? tool.name,
    description: tool.description,
    provider: MCP_TOOL_CAPABILITY_PROVIDER,
    source: Object.freeze({
      kind: "mcp",
      serverId: tool.serverId,
      toolName: tool.name,
    }),
    publication: Object.freeze({
      isPublished: false,
      title: tool.title ?? tool.name,
      description: tool.description,
      category:
        tool.categories[0] ??
        (typeof tool.metadata?.category === "string" ? tool.metadata.category : undefined),
      slug: tool.name,
    }),
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
    metadata: Object.freeze({
      ...(tool.metadata ?? {}),
      descriptorId: tool.id,
      categoryCount: tool.categories.length,
      tagCount: tool.tags.length,
    }),
  });
}

export class McpToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(private readonly catalog: IMcpToolCatalog) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    const tools = await this.catalog.listTools();

    return Object.freeze(tools.map((tool) => mapMcpToolToCapability(tool)));
  }
}

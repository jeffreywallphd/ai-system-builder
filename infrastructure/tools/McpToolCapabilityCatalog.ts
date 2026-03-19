import type { IMcpToolCatalog } from "../../application/ports/interfaces/IMcpToolCatalog";
import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";
import { buildToolCapabilityId } from "../../application/tools/models/ToolCapabilityDescriptor";

export const MCP_TOOL_CAPABILITY_PROVIDER = Object.freeze({
  kind: "mcp",
  id: "python-mcp-runtime",
  label: "MCP Tools",
} as const);

export class McpToolCapabilityCatalog implements IToolCapabilityCatalog {
  constructor(private readonly catalog: IMcpToolCatalog) {}

  public async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
    const tools = await this.catalog.listTools();

    return Object.freeze(
      tools.map((tool) =>
        Object.freeze({
          id: buildToolCapabilityId("mcp", tool.serverId, tool.name),
          displayName: tool.title ?? tool.name,
          description: tool.description,
          provider: MCP_TOOL_CAPABILITY_PROVIDER,
          source: Object.freeze({
            serverId: tool.serverId,
            toolName: tool.name,
          }),
          publication: Object.freeze({
            isPublished: false,
            title: tool.title ?? tool.name,
            description: tool.description,
            category: typeof tool.metadata?.category === "string" ? tool.metadata.category : undefined,
          }),
          inputSchema: Object.freeze({ ...tool.inputSchema }),
          outputSchema: tool.outputSchema
            ? Object.freeze({ ...tool.outputSchema })
            : undefined,
          annotations: tool.annotations
            ? Object.freeze({ ...tool.annotations })
            : undefined,
          metadata: tool.metadata
            ? Object.freeze({ ...tool.metadata })
            : undefined,
        })
      )
    );
  }
}

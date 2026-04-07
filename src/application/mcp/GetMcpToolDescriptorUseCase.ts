import type { IMcpToolCatalog } from "../ports/interfaces/IMcpToolCatalog";
import { buildMcpToolDescriptorId, normalizeMcpToolDescriptor, type McpToolDescriptor } from "./models/McpToolDescriptor";

export interface IGetMcpToolDescriptorRequest {
  readonly toolId?: string;
  readonly serverId?: string;
  readonly toolName?: string;
}

export class GetMcpToolDescriptorUseCase {
  constructor(private readonly catalog: IMcpToolCatalog) {}

  public async execute(request: IGetMcpToolDescriptorRequest): Promise<McpToolDescriptor | undefined> {
    const toolId = normalizeToolId(request);
    if (!toolId) {
      throw new Error("MCP tool descriptor lookup requires a toolId or a serverId plus toolName.");
    }

    if (typeof this.catalog.getToolDescriptor === "function") {
      const descriptor = await this.catalog.getToolDescriptor(toolId);
      return descriptor ? normalizeMcpToolDescriptor(descriptor) : undefined;
    }

    const tools = await this.catalog.listTools();
    const match = tools.find((tool) => normalizeMcpToolDescriptor(tool).id === toolId);
    return match ? normalizeMcpToolDescriptor(match) : undefined;
  }
}

function normalizeToolId(request: IGetMcpToolDescriptorRequest): string | undefined {
  const explicitToolId = request.toolId?.trim();
  if (explicitToolId) {
    return explicitToolId;
  }

  const serverId = request.serverId?.trim();
  const toolName = request.toolName?.trim();
  if (!serverId || !toolName) {
    return undefined;
  }

  return buildMcpToolDescriptorId(serverId, toolName);
}

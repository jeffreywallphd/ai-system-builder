import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import { buildMcpToolDescriptorId } from "@application/mcp/models/McpToolDescriptor";
import {
  McpToolCallNodeConfigurationService,
  MCP_TOOL_CALL_SERVER_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_ID_PROPERTY,
  MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY,
  MCP_TOOL_CALL_TOOL_NAME_PROPERTY,
  type McpToolCallNodeOption,
} from "@application/mcp/McpToolCallNodeConfigurationService";
import { McpService } from "./McpService";

export class McpToolCallAuthoringService {
  constructor(
    private readonly mcpService: McpService,
    private readonly configurationService: McpToolCallNodeConfigurationService = new McpToolCallNodeConfigurationService(),
  ) {}

  public async hydrateWorkflow(workflow: IWorkflow): Promise<IWorkflow> {
    const mcpNodes = workflow.nodes.filter((node) => this.configurationService.isMcpToolCallNode(node));
    if (mcpNodes.length === 0) {
      return workflow;
    }

    const serverOptions = await this.loadServerOptions();
    let updatedWorkflow = workflow;

    for (const node of mcpNodes) {
      const configuredNode = await this.configureNode(node, serverOptions);
      updatedWorkflow = updatedWorkflow.updateNode(configuredNode);
    }

    return updatedWorkflow;
  }

  public async applyPropertyChange(
    workflow: IWorkflow,
    nodeId: string,
    propertyId: string,
    value: unknown
  ): Promise<IWorkflow> {
    const node = workflow.getNode(nodeId.trim());
    if (!node) {
      throw new Error(`Node '${nodeId.trim()}' was not found.`);
    }

    if (!this.configurationService.isMcpToolCallNode(node)) {
      return workflow.updateNode(node.withPropertyValue(propertyId.trim(), value));
    }

    let updatedNode = node.withPropertyValue(propertyId.trim(), value);
    if (propertyId.trim() === MCP_TOOL_CALL_SERVER_ID_PROPERTY) {
      updatedNode = updatedNode
        .withPropertyValue(MCP_TOOL_CALL_TOOL_ID_PROPERTY, "")
        .withPropertyValue(MCP_TOOL_CALL_TOOL_NAME_PROPERTY, "")
        .withPropertyValue(MCP_TOOL_CALL_TOOL_DESCRIPTOR_PROPERTY, {});
      updatedNode = this.configurationService.configureNode(updatedNode, {
        serverOptions: await this.loadServerOptions(),
      });
      return workflow.updateNode(updatedNode);
    }

    if (propertyId.trim() !== MCP_TOOL_CALL_TOOL_NAME_PROPERTY) {
      return workflow.updateNode(updatedNode);
    }

    const serverOptions = await this.loadServerOptions();
    const configuredNode = await this.configureNode(updatedNode, serverOptions, true);
    return workflow.updateNode(configuredNode);
  }

  private async configureNode(
    node: IWorkflow["nodes"][number],
    serverOptions: ReadonlyArray<McpToolCallNodeOption>,
    forceRefreshDescriptor = false
  ) {
    const serverId = this.readNodeString(node, MCP_TOOL_CALL_SERVER_ID_PROPERTY);
    const toolName = this.readNodeString(node, MCP_TOOL_CALL_TOOL_NAME_PROPERTY);
    const existingDescriptor = this.configurationService.readStoredToolDescriptor(node);
    const descriptor =
      serverId && toolName
        ? await this.resolveDescriptor(serverId, toolName, existingDescriptor, forceRefreshDescriptor)
        : undefined;
    const toolOptions = serverId ? await this.loadToolOptions(serverId) : undefined;

    const configuredNode = this.configurationService.configureNode(node, {
      serverOptions,
      toolOptions,
      toolDescriptor: descriptor,
    });

    if (serverId && toolName) {
      return configuredNode.withPropertyValue(MCP_TOOL_CALL_TOOL_ID_PROPERTY, buildMcpToolDescriptorId(serverId, toolName));
    }

    return configuredNode;
  }

  private async resolveDescriptor(
    serverId: string,
    toolName: string,
    existingDescriptor: ReturnType<McpToolCallNodeConfigurationService["readStoredToolDescriptor"]>,
    forceRefreshDescriptor: boolean
  ) {
    if (
      !forceRefreshDescriptor
      && existingDescriptor
      && existingDescriptor.serverId === serverId
      && existingDescriptor.name === toolName
    ) {
      return existingDescriptor;
    }

    try {
      return await this.mcpService.getToolDescriptor(buildMcpToolDescriptorId(serverId, toolName));
    } catch {
      return existingDescriptor;
    }
  }

  private async loadServerOptions(): Promise<ReadonlyArray<McpToolCallNodeOption>> {
    try {
      const servers = await this.mcpService.listConfiguredServers();
      return Object.freeze(
        servers.map((server) => ({
          label: server.name || server.id,
          value: server.id,
          description: server.transport,
        }))
      );
    } catch {
      return Object.freeze([]);
    }
  }

  private async loadToolOptions(serverId: string): Promise<ReadonlyArray<McpToolCallNodeOption>> {
    try {
      const result = await this.mcpService.searchTools({ serverIds: [serverId] });
      return Object.freeze(
        result.tools
          .filter((tool) => tool.serverId === serverId)
          .map((tool) => ({
            label: tool.title || tool.name,
            value: tool.name,
            description: tool.description,
          }))
      );
    } catch {
      return Object.freeze([]);
    }
  }

  private readNodeString(node: IWorkflow["nodes"][number], propertyId: string): string | undefined {
    const value = node.getProperty(propertyId)?.value;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}


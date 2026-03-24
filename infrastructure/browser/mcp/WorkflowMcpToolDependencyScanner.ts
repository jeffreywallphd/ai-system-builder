import { MCP_TOOL_CALL_SERVER_ID_PROPERTY, MCP_TOOL_CALL_TOOL_NAME_PROPERTY, McpToolCallNodeConfigurationService } from "../../../application/mcp/McpToolCallNodeConfigurationService";
import type { IMcpToolDependencyScanner, McpToolDependencyReference } from "../../../application/ports/interfaces/IMcpToolDependencyScanner";
import type { IWorkflowRepository } from "../../../application/ports/interfaces/IWorkflowRepository";

export class WorkflowMcpToolDependencyScanner implements IMcpToolDependencyScanner {
  private readonly configurationService = new McpToolCallNodeConfigurationService();

  constructor(private readonly workflowRepository: IWorkflowRepository) {}

  public async scanToolReferences(toolId: string): Promise<ReadonlyArray<McpToolDependencyReference>> {
    const summaries = await this.workflowRepository.list();
    const references: McpToolDependencyReference[] = [];

    for (const summary of summaries) {
      const workflow = await this.workflowRepository.load(summary.id);
      if (!workflow) {
        continue;
      }

      const matchedNodes = workflow.nodes.filter((node) => {
        if (!this.configurationService.isMcpToolCallNode(node)) {
          return false;
        }

        const descriptor = this.configurationService.readStoredToolDescriptor(node);
        if (descriptor?.id === toolId) {
          return true;
        }

        const serverId = String(node.getProperty(MCP_TOOL_CALL_SERVER_ID_PROPERTY)?.value ?? "").trim();
        const toolName = String(node.getProperty(MCP_TOOL_CALL_TOOL_NAME_PROPERTY)?.value ?? "").trim();
        return descriptor ? false : !!serverId && !!toolName && `mcp:${encodeURIComponent(serverId)}:${encodeURIComponent(toolName)}` === toolId;
      });

      if (matchedNodes.length > 0) {
        references.push(
          Object.freeze({
            kind: "workflow",
            id: workflow.id,
            label: workflow.metadata.name,
            detail: `Referenced by ${matchedNodes.length} MCP node(s).`,
          }),
        );
      }
    }

    return Object.freeze(references);
  }
}

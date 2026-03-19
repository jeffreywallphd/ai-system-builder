import type { IMcpToolExecutor } from "../../application/ports/interfaces/IMcpToolExecutor";
import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "../../application/tools/models/ToolCapabilityInvocationRequest";
import type { ToolCapabilityInvocationResult } from "../../application/tools/models/ToolCapabilityInvocationResult";
import { MCP_TOOL_CAPABILITY_PROVIDER } from "./McpToolCapabilityCatalog";

export class McpToolCapabilityExecutor implements IToolCapabilityExecutor {
  constructor(private readonly executor: IMcpToolExecutor) {}

  public async invoke(
    request: ToolCapabilityInvocationRequest
  ): Promise<ToolCapabilityInvocationResult> {
    const serverId = request.source?.serverId;
    const toolName = request.source?.toolName;

    if (!serverId || !toolName) {
      throw new Error("MCP capability invocation requires serverId and toolName metadata.");
    }

    const result = await this.executor.executeTool({
      serverId,
      toolName,
      arguments: request.arguments,
      executionId: request.executionId,
      metadata: request.metadata,
    });

    return Object.freeze({
      capabilityId: request.capabilityId,
      executionId: result.executionId,
      status: result.status,
      provider: MCP_TOOL_CAPABILITY_PROVIDER,
      source: Object.freeze({
        serverId: result.serverId,
        toolName: result.toolName,
      }),
      content: Object.freeze(result.content.map((entry) => Object.freeze({ ...entry }))),
      structuredContent: result.structuredContent
        ? Object.freeze({ ...result.structuredContent })
        : undefined,
      metadata: result.metadata ? Object.freeze({ ...result.metadata }) : undefined,
      errorMessage: result.errorMessage,
    });
  }
}

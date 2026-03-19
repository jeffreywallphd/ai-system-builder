import type { IMcpToolExecutor } from "../ports/interfaces/IMcpToolExecutor";
import type { McpToolExecutionRequest } from "./models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "./models/McpToolExecutionResult";

export class ExecuteMcpToolUseCase {
  private readonly executor: IMcpToolExecutor;

  constructor(executor: IMcpToolExecutor) {
    this.executor = executor;
  }

  public async execute(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    if (!request.serverId.trim()) {
      throw new Error("MCP tool execution requires a serverId.");
    }

    if (!request.toolName.trim()) {
      throw new Error("MCP tool execution requires a toolName.");
    }

    return this.executor.executeTool({
      ...request,
      serverId: request.serverId.trim(),
      toolName: request.toolName.trim(),
      arguments: request.arguments ? Object.freeze({ ...request.arguments }) : undefined,
      metadata: request.metadata ? Object.freeze({ ...request.metadata }) : undefined,
    });
  }
}

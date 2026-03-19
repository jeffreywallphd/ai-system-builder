import { ExecutionContextToolPolicyService } from "../context/ExecutionContextToolPolicyService";
import type { IMcpToolExecutor } from "../ports/interfaces/IMcpToolExecutor";
import type { McpToolExecutionRequest } from "./models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "./models/McpToolExecutionResult";

export class ExecuteMcpToolUseCase {
  private readonly executor: IMcpToolExecutor;

  constructor(
    executor: IMcpToolExecutor,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService()
  ) {
    this.executor = executor;
  }

  public async execute(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    if (!request.serverId.trim()) {
      throw new Error("MCP tool execution requires a serverId.");
    }

    if (!request.toolName.trim()) {
      throw new Error("MCP tool execution requires a toolName.");
    }

    const normalizedRequest = {
      ...request,
      serverId: request.serverId.trim(),
      toolName: request.toolName.trim(),
      arguments: request.arguments ? Object.freeze({ ...request.arguments }) : undefined,
      context: request.context,
      metadata: Object.freeze({
        ...(request.metadata ? { ...request.metadata } : {}),
        ...(request.context
          ? {
              workflowContext: Object.freeze({
                packageReferences: request.context.packageReferences,
                assembledContext: request.context.assembledContext,
                trimmingPolicy: request.context.trimmingPolicy,
                budget: request.context.budget,
                inspection: request.context.inspection,
                toolUsePolicy: request.context.toolUsePolicy,
              }),
            }
          : {}),
      }),
    };

    this.policyService.assertInvocationAllowed(
      "mcp",
      { kind: "mcp", serverId: normalizedRequest.serverId, toolName: normalizedRequest.toolName },
      normalizedRequest.context
    );

    return this.executor.executeTool({
      ...normalizedRequest,
      metadata: Object.keys(normalizedRequest.metadata).length > 0 ? normalizedRequest.metadata : undefined,
    });
  }
}

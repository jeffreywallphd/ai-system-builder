import { ExecutionContextToolPolicyService } from "../context/ExecutionContextToolPolicyService";
import type { IMcpToolExecutor } from "../ports/interfaces/IMcpToolExecutor";
import type { IMcpToolRegistryRepository } from "../ports/interfaces/IMcpToolRegistryRepository";
import { McpToolContractValidationService } from "./registry/McpToolContractValidationService";
import { McpToolRegistryError } from "./registry/McpToolRegistryErrors";
import type { McpToolExecutionRequest } from "./models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "./models/McpToolExecutionResult";

export class ExecuteMcpToolUseCase {
  private readonly executor: IMcpToolExecutor;

  constructor(
    executor: IMcpToolExecutor,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService(),
    private readonly registryRepository?: IMcpToolRegistryRepository,
    private readonly contractValidationService: McpToolContractValidationService = new McpToolContractValidationService(),
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

    const installedTool = this.registryRepository
      ? await this.registryRepository.findInstalledToolByBinding(normalizedRequest.serverId, normalizedRequest.toolName)
      : undefined;

    if (installedTool) {
      const inputValidation = this.contractValidationService.validateInput(installedTool.definition, normalizedRequest.arguments ?? {});
      if (!inputValidation.valid) {
        throw new McpToolRegistryError("invalid-input-contract", "MCP tool input does not satisfy installed contract.", {
          toolId: installedTool.toolId,
          issues: inputValidation.issues,
        });
      }
    }

    const result = await this.executor.executeTool({
      ...normalizedRequest,
      metadata: Object.keys(normalizedRequest.metadata).length > 0 ? normalizedRequest.metadata : undefined,
    });

    if (installedTool && result.status === "completed") {
      const outputValidation = this.contractValidationService.validateOutput(installedTool.definition, result.structuredContent ?? (result.content[0] as unknown));
      if (!outputValidation.valid) {
        throw new McpToolRegistryError("invalid-output-contract", "MCP tool output violates installed contract.", {
          toolId: installedTool.toolId,
          issues: outputValidation.issues,
        });
      }
    }

    return result;
  }
}

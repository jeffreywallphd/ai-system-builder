import { ExecutionContextToolPolicyService } from "../context/ExecutionContextToolPolicyService";
import type { IMcpToolExecutor } from "../ports/interfaces/IMcpToolExecutor";
import type { IMcpToolRegistryRepository } from "../ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolExecutionAuditSink } from "../ports/interfaces/IMcpToolExecutionAuditSink";
import type { IMcpToolSecretRepository } from "../ports/interfaces/IMcpToolSecretRepository";
import { McpToolContractValidationService } from "./registry/McpToolContractValidationService";
import { McpToolRegistryError } from "./registry/McpToolRegistryErrors";
import type { McpToolExecutionRequest } from "./models/McpToolExecutionRequest";
import type { McpToolExecutionResult } from "./models/McpToolExecutionResult";
import { McpToolAuthService } from "./security/McpToolAuthService";
import { McpToolPermissionPolicyService } from "./security/McpToolPermissionPolicyService";
import type { McpToolPermissionScope } from "../../domain/mcp/McpToolTrust";

export class ExecuteMcpToolUseCase {
  private readonly executor: IMcpToolExecutor;

  constructor(
    executor: IMcpToolExecutor,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService(),
    private readonly registryRepository?: IMcpToolRegistryRepository,
    private readonly contractValidationService: McpToolContractValidationService = new McpToolContractValidationService(),
    private readonly secretRepository?: IMcpToolSecretRepository,
    private readonly permissionPolicyService: McpToolPermissionPolicyService = new McpToolPermissionPolicyService(),
    private readonly auditSink: IMcpToolExecutionAuditSink = { record: async () => undefined },
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

    const normalizedRequest: McpToolExecutionRequest = {
      ...request,
      serverId: request.serverId.trim(),
      toolName: request.toolName.trim(),
      arguments: request.arguments ? Object.freeze({ ...request.arguments }) : undefined,
      context: request.context,
      runtimePermissions: request.runtimePermissions ? Object.freeze([...request.runtimePermissions]) : undefined,
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
      if (installedTool.status !== "enabled") {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "tool-disabled",
        });
        throw new McpToolRegistryError("tool-disabled", "MCP tool is installed but currently disabled.", {
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          status: installedTool.status,
        });
      }

      const inputValidation = this.contractValidationService.validateInput(installedTool.definition, normalizedRequest.arguments ?? {});
      if (!inputValidation.valid) {
        throw new McpToolRegistryError("invalid-input-contract", "MCP tool input does not satisfy installed contract.", {
          toolId: installedTool.toolId,
          issues: inputValidation.issues,
        });
      }

      const authService = this.secretRepository ? new McpToolAuthService(this.secretRepository) : undefined;
      const credentialStatus = authService ? await authService.getCredentialStatus(installedTool) : undefined;
      const resolvedCredentials = authService ? await authService.resolveRequiredCredentials(installedTool) : undefined;
      if (installedTool.definition.auth.kind === "required" && !this.secretRepository) {
        throw new McpToolRegistryError("missing-auth-configuration", "MCP tool requires credentials but no secret repository is configured.", {
          toolId: installedTool.toolId,
        });
      }
      if (installedTool.definition.auth.kind === "required" && credentialStatus && credentialStatus.missingRequiredFields.length > 0) {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "missing-auth-configuration",
          metadata: Object.freeze({ missingRequiredFields: credentialStatus.missingRequiredFields }),
        });
        throw new McpToolRegistryError("missing-auth-configuration", "MCP tool credentials are missing required fields.", {
          toolId: installedTool.toolId,
          missingRequiredFields: credentialStatus.missingRequiredFields,
        });
      }
      if (installedTool.definition.auth.kind === "required" && !resolvedCredentials) {
        throw new McpToolRegistryError("auth-resolution-failed", "MCP tool credentials could not be resolved.", {
          toolId: installedTool.toolId,
        });
      }

      const permissionDecision = this.permissionPolicyService.evaluate(
        installedTool,
        normalizedRequest.runtimePermissions ?? extractContextGrantedPermissions(normalizedRequest.metadata),
      );
      if (!permissionDecision.allowed) {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "permission-denied",
          permissionDecision,
        });
        throw new McpToolRegistryError("permission-denied", "MCP tool invocation denied by permission policy.", {
          toolId: installedTool.toolId,
          deniedPermissions: permissionDecision.deniedPermissions,
          requiredPermissions: permissionDecision.requiredPermissions,
        });
      }

      await this.auditSink.record({
        toolId: installedTool.toolId,
        serverId: normalizedRequest.serverId,
        toolName: normalizedRequest.toolName,
        occurredAt: new Date().toISOString(),
        outcome: "allowed",
        reason: "policy-allowed",
        permissionDecision,
      });

      const executionRequest: McpToolExecutionRequest = resolvedCredentials
        ? Object.freeze({ ...normalizedRequest, resolvedCredentials: resolvedCredentials.values })
        : normalizedRequest;
      return this.executeWithOutputValidation(executionRequest, installedTool);
    }

    return this.executeWithOutputValidation(normalizedRequest, installedTool);
  }

  private async executeWithOutputValidation(
    request: McpToolExecutionRequest,
    installedTool?: Awaited<ReturnType<IMcpToolRegistryRepository["findInstalledToolByBinding"]>>,
  ): Promise<McpToolExecutionResult> {
    const result = await this.executor.executeTool({
      ...request,
      metadata: request.metadata && Object.keys(request.metadata).length > 0 ? request.metadata : undefined,
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

function extractContextGrantedPermissions(metadata: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<McpToolPermissionScope> {
  const permissions = metadata?.runtimePermissions;
  if (!Array.isArray(permissions)) {
    return Object.freeze([]);
  }
  return Object.freeze(permissions.filter((permission): permission is McpToolPermissionScope => typeof permission === "string"));
}

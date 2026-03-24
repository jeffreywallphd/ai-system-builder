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
import { McpToolApprovalPolicyService } from "./security/McpToolApprovalPolicyService";
import { McpToolPermissionPolicyService } from "./security/McpToolPermissionPolicyService";
import { McpToolSandboxPolicyService } from "./security/McpToolSandboxPolicyService";
import type { McpToolPermissionScope, McpToolSandboxCapabilityRequest, McpToolSandboxPolicy } from "../../domain/mcp/McpToolTrust";
import type { McpToolAssetIoCoordinator } from "./McpToolAssetIoCoordinator";
import type { McpCredentialResolutionContext } from "./security/McpCredentialResolution";

export class ExecuteMcpToolUseCase {
  private readonly executor: IMcpToolExecutor;

  constructor(
    executor: IMcpToolExecutor,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService(),
    private readonly registryRepository?: IMcpToolRegistryRepository,
    private readonly contractValidationService: McpToolContractValidationService = new McpToolContractValidationService(),
    private readonly secretRepository?: IMcpToolSecretRepository,
    private readonly approvalPolicyService: McpToolApprovalPolicyService = new McpToolApprovalPolicyService(),
    private readonly permissionPolicyService: McpToolPermissionPolicyService = new McpToolPermissionPolicyService(),
    private readonly sandboxPolicyService: McpToolSandboxPolicyService = new McpToolSandboxPolicyService(),
    private readonly auditSink: IMcpToolExecutionAuditSink = { record: async () => undefined },
    private readonly assetIoCoordinator?: McpToolAssetIoCoordinator,
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
      toolId: request.toolId?.trim() || undefined,
      serverId: request.serverId.trim(),
      toolName: request.toolName.trim(),
      arguments: request.arguments ? Object.freeze({ ...request.arguments }) : undefined,
      context: request.context,
      runtimePermissions: request.runtimePermissions ? Object.freeze([...request.runtimePermissions]) : undefined,
      sandboxRequest: request.sandboxRequest ? Object.freeze({ ...request.sandboxRequest }) : undefined,
      credentialContext: request.credentialContext ? Object.freeze({ ...request.credentialContext }) : undefined,
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
    const sanitizedExecutionContext = sanitizeExecutionContextForAudit(normalizedRequest);

    this.policyService.assertInvocationAllowed(
      "mcp",
      { kind: "mcp", serverId: normalizedRequest.serverId, toolName: normalizedRequest.toolName },
      normalizedRequest.context
    );

    let installedTool = this.registryRepository
      ? await this.registryRepository.findInstalledToolByBinding(normalizedRequest.serverId, normalizedRequest.toolName)
      : undefined;

    if (this.registryRepository && normalizedRequest.toolId) {
      const installedById = await this.registryRepository.getInstalledTool(normalizedRequest.toolId);
      if (!installedById && !installedTool) {
        throw new McpToolRegistryError("tool-not-found", "MCP tool identity could not be resolved from the installed registry.", {
          toolId: normalizedRequest.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
        });
      }

      if (!installedById) {
        // Keep backward-compatible behavior for repositories that can resolve
        // by binding but not by id.
      } else {

        if (
          installedById.definition.binding?.serverId !== normalizedRequest.serverId
          || installedById.definition.binding?.toolName !== normalizedRequest.toolName
        ) {
          throw new McpToolRegistryError("invalid-input-contract", "MCP tool identity does not match requested server/tool binding.", {
            toolId: normalizedRequest.toolId,
            expected: installedById.definition.binding,
            actual: Object.freeze({
              serverId: normalizedRequest.serverId,
              toolName: normalizedRequest.toolName,
            }),
          });
        }

        installedTool = installedById;
      }
    }

    if (installedTool) {
      if (installedTool.status !== "enabled") {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "tool-disabled",
          metadata: sanitizedExecutionContext,
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
      const credentialContext = resolveCredentialContext(normalizedRequest);
      const credentialStatus = authService ? await authService.getCredentialStatus(installedTool, credentialContext) : undefined;
      const credentialResolution = authService ? await authService.resolveCredentials(installedTool, credentialContext) : undefined;
      const resolvedCredentials = authService ? await authService.resolveRequiredCredentials(installedTool, credentialContext) : undefined;
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
      if (installedTool.definition.auth.kind === "required" && credentialResolution?.status === "invalid") {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "invalid-credentials",
          metadata: Object.freeze({
            malformedFields: credentialResolution.malformedFields,
            scopeType: credentialResolution.scope.scopeType,
            scopeId: credentialResolution.scope.scopeId,
            ...sanitizedExecutionContext,
          }),
        });
        throw new McpToolRegistryError("invalid-credentials", "MCP tool credentials are malformed.", {
          toolId: installedTool.toolId,
          malformedFields: credentialResolution.malformedFields,
        });
      }
      if (installedTool.definition.auth.kind === "required" && !resolvedCredentials) {
        throw new McpToolRegistryError("auth-resolution-failed", "MCP tool credentials could not be resolved.", {
          toolId: installedTool.toolId,
          status: credentialResolution?.status,
        });
      }

      const permissionDecision = this.permissionPolicyService.evaluate(
        installedTool,
        normalizedRequest.runtimePermissions ?? extractContextGrantedPermissions(normalizedRequest.metadata),
      );
      if (!permissionDecision.allowed) {
        const approvalDecision = this.approvalPolicyService.evaluate(
          installedTool,
          resolveApprovalScope(normalizedRequest),
          normalizedRequest.runtimePermissions ?? extractContextGrantedPermissions(normalizedRequest.metadata),
        );
        const sandboxDecision = this.sandboxPolicyService.evaluate(installedTool, resolveSandboxRequest(normalizedRequest));
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "permission-denied",
          permissionDecision,
          approvalDecision,
          sandboxDecision,
          metadata: sanitizedExecutionContext,
        });
        throw new McpToolRegistryError("permission-denied", "MCP tool invocation denied by permission policy.", {
          toolId: installedTool.toolId,
          deniedPermissions: permissionDecision.deniedPermissions,
          requiredPermissions: permissionDecision.requiredPermissions,
        });
      }

      const approvalDecision = this.approvalPolicyService.evaluate(
        installedTool,
        resolveApprovalScope(normalizedRequest),
        normalizedRequest.runtimePermissions ?? extractContextGrantedPermissions(normalizedRequest.metadata),
      );
      const sandboxDecision = this.sandboxPolicyService.evaluate(installedTool, resolveSandboxRequest(normalizedRequest));
      const effectiveTrust = Object.freeze({
        permissionDecision,
        approvalDecision,
        sandboxDecision,
      });

      if (!approvalDecision.allowed) {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "approval-required",
          permissionDecision,
          approvalDecision,
          sandboxDecision,
          metadata: sanitizedExecutionContext,
        });
        throw new McpToolRegistryError("approval-required", "MCP tool invocation requires explicit permission approval.", {
          toolId: installedTool.toolId,
          missingApprovals: approvalDecision.missingApprovals,
          deniedApprovals: approvalDecision.deniedApprovals,
          approvalScope: approvalDecision.approvalScope,
        });
      }


      if (!sandboxDecision.allowed) {
        await this.auditSink.record({
          toolId: installedTool.toolId,
          serverId: normalizedRequest.serverId,
          toolName: normalizedRequest.toolName,
          occurredAt: new Date().toISOString(),
          outcome: "denied",
          reason: "sandbox-denied",
          permissionDecision,
          approvalDecision,
          sandboxDecision,
          metadata: Object.freeze({
            ...sanitizedExecutionContext,
            sandboxPolicy: sanitizeSandboxPolicySnapshot(sandboxDecision.policy),
          }),
        });
        throw new McpToolRegistryError("sandbox-denied", "MCP tool invocation denied by sandbox policy.", {
          toolId: installedTool.toolId,
          deniedCapabilities: sandboxDecision.deniedCapabilities,
          sandboxPolicy: sandboxDecision.policy,
          sandboxEnforcement: sandboxDecision.enforcement,
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
        approvalDecision,
        sandboxDecision,
        metadata: sanitizedExecutionContext,
      });

      const executionRequest: McpToolExecutionRequest = resolvedCredentials
        ? Object.freeze({
            ...normalizedRequest,
            resolvedCredentials: resolvedCredentials.values,
            metadata: Object.freeze({ ...(normalizedRequest.metadata ?? {}), trust: effectiveTrust }),
          })
        : Object.freeze({ ...normalizedRequest, metadata: Object.freeze({ ...(normalizedRequest.metadata ?? {}), trust: effectiveTrust }) });
      return this.executeWithOutputValidation(executionRequest, installedTool);
    }

    return this.executeWithOutputValidation(normalizedRequest, installedTool);
  }

  private async executeWithOutputValidation(
    request: McpToolExecutionRequest,
    installedTool?: Awaited<ReturnType<IMcpToolRegistryRepository["findInstalledToolByBinding"]>>,
  ): Promise<McpToolExecutionResult> {
    this.assertAssetOutputPersistenceModel(installedTool);
    const preparation = installedTool && this.assetIoCoordinator
      ? await this.assetIoCoordinator.prepareInput(installedTool, request.arguments ?? {})
      : undefined;
    const executionRequest = preparation
      ? Object.freeze({ ...request, arguments: preparation.arguments })
      : request;
    const result = await this.executor.executeTool({
      ...executionRequest,
      metadata: executionRequest.metadata && Object.keys(executionRequest.metadata).length > 0 ? executionRequest.metadata : undefined,
    });

    if (installedTool && result.status === "completed") {
      const outputValidation = this.contractValidationService.validateOutput(installedTool.definition, result.structuredContent ?? (result.content[0] as unknown));
      if (!outputValidation.valid) {
        throw new McpToolRegistryError("invalid-output-contract", "MCP tool output violates installed contract.", {
          toolId: installedTool.toolId,
          issues: outputValidation.issues,
        });
      }

      if (this.assetIoCoordinator) {
        const finalization = await this.assetIoCoordinator.finalizeOutput({
          installedTool,
          executionId: result.executionId,
          requestArguments: executionRequest.arguments ?? {},
          inputVersionIds: preparation?.inputVersionIds ?? [],
          structuredContent: result.structuredContent,
          fallbackOutput: result.content[0],
        });
        if (finalization.resultMetadata) {
          const existingAssetIo = result.metadata?.assetIo as Record<string, unknown> | undefined;
          const finalAssetIo = finalization.resultMetadata.assetIo as Record<string, unknown> | undefined;
          const consumedAssetIo = preparation?.consumedAssets?.length
            ? Object.freeze({ consumedAssets: preparation.consumedAssets })
            : undefined;
          return Object.freeze({
            ...result,
            metadata: Object.freeze({
              ...(result.metadata ?? {}),
              ...(finalization.resultMetadata ?? {}),
              assetIo: Object.freeze({
                ...(existingAssetIo ?? {}),
                ...(finalAssetIo ?? {}),
                ...(consumedAssetIo ?? {}),
              }),
            }),
          });
        }
      }
    }
    return sanitizeMcpResultErrors(result);
  }

  private assertAssetOutputPersistenceModel(
    installedTool?: Awaited<ReturnType<IMcpToolRegistryRepository["findInstalledToolByBinding"]>>,
  ): void {
    if (!installedTool) {
      return;
    }
    const declaredAssetOutputs = installedTool.definition.assetIo?.outputs?.filter((entry) => entry.mode !== "raw") ?? [];
    if (declaredAssetOutputs.length > 0 && !this.assetIoCoordinator) {
      throw new McpToolRegistryError(
        "invalid-output-contract",
        "Installed MCP tool declares asset outputs, but canonical asset persistence is not configured.",
        { toolId: installedTool.toolId, outputModes: declaredAssetOutputs.map((entry) => entry.mode) },
      );
    }
  }
}

function resolveApprovalScope(request: McpToolExecutionRequest): { readonly scopeType: "global" | "project" | "user"; readonly scopeId?: string } {
  const metadataContext = request.metadata?.credentialContext as { projectId?: unknown; userId?: unknown } | undefined;
  const projectId = request.credentialContext?.projectId
    ?? (typeof metadataContext?.projectId === "string" ? metadataContext.projectId : undefined);
  if (projectId) {
    return Object.freeze({ scopeType: "project", scopeId: projectId });
  }
  const userId = request.credentialContext?.userId
    ?? (typeof metadataContext?.userId === "string" ? metadataContext.userId : undefined);
  if (userId) {
    return Object.freeze({ scopeType: "user", scopeId: userId });
  }
  return Object.freeze({ scopeType: "global" });
}

function extractContextGrantedPermissions(metadata: Readonly<Record<string, unknown>> | undefined): ReadonlyArray<McpToolPermissionScope> {
  const permissions = metadata?.runtimePermissions;
  if (!Array.isArray(permissions)) {
    return Object.freeze([]);
  }
  return Object.freeze(permissions.filter((permission): permission is McpToolPermissionScope => typeof permission === "string"));
}

function resolveCredentialContext(request: McpToolExecutionRequest): McpCredentialResolutionContext {
  const metadataContext = request.metadata?.credentialContext as { projectId?: unknown; userId?: unknown } | undefined;
  return Object.freeze({
    projectId: request.credentialContext?.projectId
      ?? (typeof metadataContext?.projectId === "string" ? metadataContext.projectId : undefined),
    userId: request.credentialContext?.userId
      ?? (typeof metadataContext?.userId === "string" ? metadataContext.userId : undefined),
  });
}


function resolveSandboxRequest(request: McpToolExecutionRequest): McpToolSandboxCapabilityRequest {
  const metadataRequest = request.metadata?.sandboxRequest;
  if (request.sandboxRequest) {
    return request.sandboxRequest;
  }
  if (!metadataRequest || typeof metadataRequest !== "object") {
    return Object.freeze({});
  }
  return Object.freeze({ ...(metadataRequest as Record<string, unknown>) }) as McpToolSandboxCapabilityRequest;
}

function sanitizeMcpResultErrors(result: McpToolExecutionResult): McpToolExecutionResult {
  if (result.status !== "failed" || !result.errorMessage) {
    return result;
  }
  const sanitized = result.errorMessage.replace(/(api[-_ ]?key|token|secret|password)\s*[:=]\s*([^\s,;]+)/gi, "$1=[REDACTED]");
  return Object.freeze({ ...result, errorMessage: sanitized });
}

function sanitizeExecutionContextForAudit(request: McpToolExecutionRequest): Readonly<Record<string, unknown>> {
  return Object.freeze({
    executionId: request.executionId,
    hasArguments: Object.keys(request.arguments ?? {}).length > 0,
    runtimePermissions: request.runtimePermissions ?? [],
    hasSandboxRequest: !!request.sandboxRequest,
    credentialScope: request.credentialContext
      ? Object.freeze({
          projectId: request.credentialContext.projectId,
          userId: request.credentialContext.userId,
        })
      : undefined,
  });
}

function sanitizeSandboxPolicySnapshot(policy: McpToolSandboxPolicy): Readonly<Record<string, unknown>> {
  return Object.freeze(JSON.parse(JSON.stringify(policy)));
}

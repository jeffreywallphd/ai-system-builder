import type { Agent } from "../../../domain/agents/Agent";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import { isMcpToolId, parseMcpToolId } from "../../../domain/mcp/McpToolIdentity";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import { McpToolPermissionPolicyService } from "../../mcp/security/McpToolPermissionPolicyService";
import { McpToolApprovalPolicyService } from "../../mcp/security/McpToolApprovalPolicyService";
import { McpToolSandboxPolicyService } from "../../mcp/security/McpToolSandboxPolicyService";

export interface AgentMcpToolGovernanceIssue {
  readonly stepId: string;
  readonly toolId: string;
  readonly code:
    | "tool-not-allowed"
    | "tool-not-installed"
    | "tool-disabled"
    | "permission-denied"
    | "approval-required"
    | "approval-denied"
    | "sandbox-denied"
    | "input-schema-mismatch"
    | "output-schema-missing";
  readonly message: string;
  readonly requiresApproval?: boolean;
}

export interface AgentMcpToolGovernanceResult {
  readonly allowed: boolean;
  readonly issues: ReadonlyArray<AgentMcpToolGovernanceIssue>;
}

export class AgentMcpToolGovernanceService {
  private readonly permissionPolicy = new McpToolPermissionPolicyService();
  private readonly approvalPolicy = new McpToolApprovalPolicyService();
  private readonly sandboxPolicy = new McpToolSandboxPolicyService();

  constructor(private readonly registry: IMcpToolRegistryRepository) {}

  public async validatePlan(agent: Agent, plan: AgentPlan): Promise<AgentMcpToolGovernanceResult> {
    const issues: AgentMcpToolGovernanceIssue[] = [];

    for (const step of plan.steps) {
      if (!isMcpToolId(step.toolId)) {
        continue;
      }

      if (!agent.toolAccess.allowedToolIds.includes(step.toolId)) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "tool-not-allowed",
          message: `Agent step '${step.stepId}' references MCP tool '${step.toolId}' that is not in agent toolAccess.`,
        });
        continue;
      }

      const installedTool = await this.registry.getInstalledTool(step.toolId);
      if (!installedTool) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "tool-not-installed",
          message: `Agent step '${step.stepId}' references MCP tool '${step.toolId}' that is not installed in the MCP registry.`,
        });
        continue;
      }

      if (installedTool.status !== "enabled") {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "tool-disabled",
          message: `Agent step '${step.stepId}' references disabled MCP tool '${step.toolId}'.`,
        });
      }

      const permission = this.permissionPolicy.evaluate(installedTool);
      const deniedByPolicy = permission.deniedPermissions.filter((permissionId) =>
        agent.policy.safetyConstraints.deniedPermissionIds.includes(permissionId),
      );
      if (permission.deniedPermissions.length > 0 || deniedByPolicy.length > 0) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "permission-denied",
          message: `Agent step '${step.stepId}' lacks required MCP permissions (${permission.deniedPermissions.join(", ") || deniedByPolicy.join(", ")}).`,
        });
      }

      const approval = this.approvalPolicy.evaluate(installedTool, { scopeType: "global" });
      if (!approval.allowed) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: approval.reason === "approval-required" ? "approval-required" : "approval-denied",
          message: `Agent step '${step.stepId}' MCP approvals are not satisfied (${[...approval.missingApprovals, ...approval.deniedApprovals].join(", ")}).`,
          requiresApproval: approval.reason === "approval-required",
        });
      }

      const sandbox = this.sandboxPolicy.evaluate(installedTool);
      if (!sandbox.allowed) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "sandbox-denied",
          message: `Agent step '${step.stepId}' is denied by sandbox policy (${sandbox.deniedCapabilities.join(", ")}).`,
        });
      }

      const toolInvocation = step.intent.toolInvocation;
      if (toolInvocation?.kind === "mcp" && toolInvocation.structuredInput) {
        const requiredKeys = Array.isArray(installedTool.definition.inputSchema.required)
          ? installedTool.definition.inputSchema.required.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
          : [];
        const missingRequired = requiredKeys.filter((key) => !(key in toolInvocation.structuredInput!));
        if (missingRequired.length > 0) {
          issues.push({
            stepId: step.stepId,
            toolId: step.toolId,
            code: "input-schema-mismatch",
            message: `Agent step '${step.stepId}' MCP input is missing required fields: ${missingRequired.join(", ")}.`,
          });
        }
      }

      if (step.intent.expectedOutputKey && !installedTool.definition.outputSchema) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "output-schema-missing",
          message: `Agent step '${step.stepId}' expects an output key but MCP tool '${step.toolId}' has no declared output schema.`,
        });
      }

      const identity = parseMcpToolId(step.toolId);
      const matchingBinding = agent.toolAccess.allowedMcpTools?.find((entry) => entry.toolId === identity.toolId);
      if (!matchingBinding || matchingBinding.serverId !== identity.serverId || matchingBinding.toolName !== identity.toolName) {
        issues.push({
          stepId: step.stepId,
          toolId: step.toolId,
          code: "tool-not-allowed",
          message: `Agent step '${step.stepId}' MCP identity '${identity.toolId}' is missing canonical binding in toolAccess.allowedMcpTools.`,
        });
      }
    }

    return Object.freeze({
      allowed: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }
}

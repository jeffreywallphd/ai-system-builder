import type { Agent } from "@domain/agents/Agent";
import type { AgentPlan } from "@domain/agents/AgentPlan";
import { isMcpToolId, parseMcpToolId } from "@domain/mcp/McpToolIdentity";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import { McpToolPermissionPolicyService } from "../../mcp/security/McpToolPermissionPolicyService";
import { McpToolApprovalPolicyService } from "../../mcp/security/McpToolApprovalPolicyService";
import { McpToolSandboxPolicyService } from "../../mcp/security/McpToolSandboxPolicyService";

export type AgentMcpToolGovernanceIssueCode =
  | "tool-not-allowed"
  | "tool-not-installed"
  | "tool-disabled"
  | "permission-denied"
  | "approval-required"
  | "approval-denied"
  | "sandbox-denied"
  | "input-schema-mismatch"
  | "output-schema-missing";

export type AgentMcpToolGovernanceDecision = "allowed" | "approval-required" | "denied" | "unavailable" | "incompatible";

export interface AgentMcpToolGovernanceIssue {
  readonly stepId: string;
  readonly toolId: string;
  readonly code: AgentMcpToolGovernanceIssueCode;
  readonly decision: Exclude<AgentMcpToolGovernanceDecision, "allowed">;
  readonly message: string;
  readonly requiresApproval?: boolean;
}

export interface AgentMcpToolGovernanceResult {
  readonly allowed: boolean;
  readonly decision: AgentMcpToolGovernanceDecision;
  readonly issues: ReadonlyArray<AgentMcpToolGovernanceIssue>;
}

function mapCodeToDecision(code: AgentMcpToolGovernanceIssueCode): Exclude<AgentMcpToolGovernanceDecision, "allowed"> {
  if (code === "approval-required") {
    return "approval-required";
  }
  if (code === "tool-not-installed" || code === "tool-disabled") {
    return "unavailable";
  }
  if (code === "input-schema-mismatch" || code === "output-schema-missing") {
    return "incompatible";
  }
  return "denied";
}

function summarizeDecision(issues: ReadonlyArray<AgentMcpToolGovernanceIssue>): AgentMcpToolGovernanceDecision {
  if (issues.length === 0) {
    return "allowed";
  }
  if (issues.some((issue) => issue.decision === "denied")) {
    return "denied";
  }
  if (issues.some((issue) => issue.decision === "approval-required")) {
    return "approval-required";
  }
  if (issues.some((issue) => issue.decision === "unavailable")) {
    return "unavailable";
  }
  return "incompatible";
}

export class AgentMcpToolGovernanceService {
  private readonly permissionPolicy = new McpToolPermissionPolicyService();
  private readonly approvalPolicy = new McpToolApprovalPolicyService();
  private readonly sandboxPolicy = new McpToolSandboxPolicyService();

  constructor(private readonly registry: IMcpToolRegistryRepository) {}

  public async validateToolSelection(input: {
    readonly agent: Agent;
    readonly toolId: string;
    readonly stepId: string;
    readonly action: string;
    readonly structuredInput?: Readonly<Record<string, unknown>>;
    readonly expectedOutputKey?: string;
  }): Promise<ReadonlyArray<AgentMcpToolGovernanceIssue>> {
    if (!isMcpToolId(input.toolId)) {
      return Object.freeze([]);
    }

    const issues: AgentMcpToolGovernanceIssue[] = [];
    const pushIssue = (issue: Omit<AgentMcpToolGovernanceIssue, "decision">) => {
      issues.push(Object.freeze({ ...issue, decision: mapCodeToDecision(issue.code) }));
    };

    if (!input.agent.toolAccess.allowedToolIds.includes(input.toolId)) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "tool-not-allowed",
        message: `Agent step '${input.stepId}' references MCP tool '${input.toolId}' that is not in agent toolAccess.`,
      });
      return Object.freeze(issues);
    }

    const installedTool = await this.registry.getInstalledTool(input.toolId);
    if (!installedTool) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "tool-not-installed",
        message: `Agent step '${input.stepId}' references MCP tool '${input.toolId}' that is not installed in the MCP registry.`,
      });
      return Object.freeze(issues);
    }

    if (installedTool.status !== "enabled") {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "tool-disabled",
        message: `Agent step '${input.stepId}' references disabled MCP tool '${input.toolId}'.`,
      });
    }

    const permission = this.permissionPolicy.evaluate(installedTool);
    const deniedByPolicy = permission.deniedPermissions.filter((permissionId) =>
      input.agent.policy.safetyConstraints.deniedPermissionIds.includes(permissionId),
    );
    if (permission.deniedPermissions.length > 0 || deniedByPolicy.length > 0) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "permission-denied",
        message: `Agent step '${input.stepId}' lacks required MCP permissions (${permission.deniedPermissions.join(", ") || deniedByPolicy.join(", ")}).`,
      });
    }

    const approval = this.approvalPolicy.evaluate(installedTool, { scopeType: "global" });
    if (!approval.allowed) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: approval.reason === "approval-required" ? "approval-required" : "approval-denied",
        message: `Agent step '${input.stepId}' MCP approvals are not satisfied (${[...approval.missingApprovals, ...approval.deniedApprovals].join(", ")}).`,
        requiresApproval: approval.reason === "approval-required",
      });
    }

    const sandbox = this.sandboxPolicy.evaluate(installedTool);
    if (!sandbox.allowed) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "sandbox-denied",
        message: `Agent step '${input.stepId}' is denied by sandbox policy (${sandbox.deniedCapabilities.join(", ")}).`,
      });
    }

    if (input.structuredInput) {
      const requiredKeys = Array.isArray(installedTool.definition.inputSchema.required)
        ? installedTool.definition.inputSchema.required.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        : [];
      const missingRequired = requiredKeys.filter((key) => !(key in input.structuredInput!));
      if (missingRequired.length > 0) {
        pushIssue({
          stepId: input.stepId,
          toolId: input.toolId,
          code: "input-schema-mismatch",
          message: `Agent step '${input.stepId}' MCP input is missing required fields: ${missingRequired.join(", ")}.`,
        });
      }
    }

    if (input.expectedOutputKey && !installedTool.definition.outputSchema) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "output-schema-missing",
        message: `Agent step '${input.stepId}' expects an output key but MCP tool '${input.toolId}' has no declared output schema.`,
      });
    }

    const identity = parseMcpToolId(input.toolId);
    const matchingBinding = input.agent.toolAccess.allowedMcpTools?.find((entry) => entry.toolId === identity.toolId);
    if (!matchingBinding || matchingBinding.serverId !== identity.serverId || matchingBinding.toolName !== identity.toolName) {
      pushIssue({
        stepId: input.stepId,
        toolId: input.toolId,
        code: "tool-not-allowed",
        message: `Agent step '${input.stepId}' MCP identity '${identity.toolId}' is missing canonical binding in toolAccess.allowedMcpTools.`,
      });
    }

    return Object.freeze(issues);
  }

  public async validatePlan(agent: Agent, plan: AgentPlan): Promise<AgentMcpToolGovernanceResult> {
    const issues: AgentMcpToolGovernanceIssue[] = [];

    for (const step of plan.steps) {
      const toolInvocation = step.intent.toolInvocation;
      const stepIssues = await this.validateToolSelection({
        agent,
        toolId: step.toolId,
        stepId: step.stepId,
        action: step.intent.action,
        structuredInput: toolInvocation?.kind === "mcp" ? toolInvocation.structuredInput : undefined,
        expectedOutputKey: step.intent.expectedOutputKey,
      });
      issues.push(...stepIssues);
    }

    const decision = summarizeDecision(issues);
    return Object.freeze({
      allowed: decision === "allowed",
      decision,
      issues: Object.freeze(issues),
    });
  }
}


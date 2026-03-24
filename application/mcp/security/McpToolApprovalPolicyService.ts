import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import {
  deriveRequiredMcpToolPermissions,
  type McpToolExecutionApprovalDecision,
  type McpToolPermissionApprovalStatus,
  type McpToolPermissionScope,
  type McpToolTrustScope,
} from "../../../domain/mcp/McpToolTrust";

export class McpToolApprovalPolicyService {
  public evaluate(
    tool: InstalledMcpToolRecord,
    scope: McpToolTrustScope,
    runtimePermissions: ReadonlyArray<McpToolPermissionScope> = [],
  ): McpToolExecutionApprovalDecision {
    const requiredPermissions = deriveRequiredMcpToolPermissions(tool.definition);
    const missingApprovals: McpToolPermissionScope[] = [];
    const deniedApprovals: McpToolPermissionScope[] = [];

    for (const permission of requiredPermissions) {
      if (runtimePermissions.includes(permission)) {
        continue;
      }
      const status = this.resolveApprovalStatus(tool, permission, scope);
      if (status === "approved") {
        continue;
      }
      if (status === "denied" || status === "revoked") {
        deniedApprovals.push(permission);
      } else {
        missingApprovals.push(permission);
      }
    }

    const reason = deniedApprovals.length > 0
      ? "approval-denied"
      : missingApprovals.length > 0
        ? "approval-required"
        : "approved";

    return Object.freeze({
      allowed: deniedApprovals.length === 0 && missingApprovals.length === 0,
      requiredPermissions,
      missingApprovals: Object.freeze(missingApprovals),
      deniedApprovals: Object.freeze(deniedApprovals),
      approvalScope: scope,
      reason,
    });
  }

  private resolveApprovalStatus(
    tool: InstalledMcpToolRecord,
    permission: McpToolPermissionScope,
    scope: McpToolTrustScope,
  ): McpToolPermissionApprovalStatus | undefined {
    const approvals = tool.permissionApprovals ?? [];
    const scopeMatches = (scopeType: "global" | "project" | "user", scopeId?: string) =>
      approvals
        .filter((entry) => entry.permission === permission)
        .filter((entry) => entry.scope.scopeType === scopeType)
        .filter((entry) => entry.scope.scopeId === scopeId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const exactMatch = scopeMatches(scope.scopeType, scope.scopeId)[0];
    if (exactMatch) {
      return exactMatch.status;
    }

    if (scope.scopeType === "project") {
      const global = scopeMatches("global")[0];
      if (global) {
        return global.status;
      }
    }

    if (scope.scopeType === "user") {
      const user = scopeMatches("user", scope.scopeId)[0];
      if (user) {
        return user.status;
      }
      const global = scopeMatches("global")[0];
      if (global) {
        return global.status;
      }
    }

    return undefined;
  }
}

import type { InstalledMcpToolRecord } from "@domain/mcp/InstalledMcpTool";
import {
  deriveRequiredMcpToolPermissions,
  type McpToolExecutionPermissionDecision,
  type McpToolPermissionScope,
} from "@domain/mcp/McpToolTrust";

export class McpToolPermissionPolicyService {
  public evaluate(tool: InstalledMcpToolRecord, contextGrantedPermissions: ReadonlyArray<McpToolPermissionScope> = []): McpToolExecutionPermissionDecision {
    const requiredPermissions = deriveRequiredMcpToolPermissions(tool.definition);
    const grantedPermissions = new Set<McpToolPermissionScope>([...(tool.grantedPermissions ?? []), ...contextGrantedPermissions]);
    const deniedPermissions = requiredPermissions.filter((permission) => !grantedPermissions.has(permission));

    return Object.freeze({
      allowed: deniedPermissions.length === 0,
      requiredPermissions,
      grantedPermissions: Object.freeze([...grantedPermissions]),
      deniedPermissions: Object.freeze(deniedPermissions),
      reason: deniedPermissions.length === 0 ? "allowed" : "missing-grants",
    });
  }
}


import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import {
  createDefaultMcpToolSandboxEnforcementSummary,
  createDefaultMcpToolSandboxPolicy,
  deriveRequiredMcpToolPermissions,
  type McpToolExecutionSandboxDecision,
} from "../../../domain/mcp/McpToolTrust";

export class McpToolSandboxPolicyService {
  public evaluate(tool: InstalledMcpToolRecord): McpToolExecutionSandboxDecision {
    const policy = tool.sandboxPolicy ?? createDefaultMcpToolSandboxPolicy();
    const enforcement = tool.sandboxEnforcement ?? createDefaultMcpToolSandboxEnforcementSummary();
    const requiredPermissions = deriveRequiredMcpToolPermissions(tool.definition);
    const declaredCapabilities = new Set<"network" | "filesystem" | "asset" | "environment">();

    if (requiredPermissions.includes("network.access")) {
      declaredCapabilities.add("network");
    }
    if (requiredPermissions.includes("filesystem.read") || requiredPermissions.includes("filesystem.write") || requiredPermissions.includes("system.exec")) {
      declaredCapabilities.add("filesystem");
    }
    if (requiredPermissions.includes("asset.read") || requiredPermissions.includes("asset.write")) {
      declaredCapabilities.add("asset");
    }
    if (policy.environmentExposure.mode !== "none") {
      declaredCapabilities.add("environment");
    }

    const deniedCapabilities: Array<"network" | "filesystem" | "asset" | "environment"> = [];

    if (declaredCapabilities.has("network") && policy.networkAccess === "deny") {
      deniedCapabilities.push("network");
    }

    const requiresFsRead = requiredPermissions.includes("filesystem.read");
    const requiresFsWrite = requiredPermissions.includes("filesystem.write") || requiredPermissions.includes("system.exec");
    if ((requiresFsRead || requiresFsWrite) && policy.filesystemAccess.mode === "deny") {
      deniedCapabilities.push("filesystem");
    } else if (requiresFsWrite && policy.filesystemAccess.mode === "read-only") {
      deniedCapabilities.push("filesystem");
    }

    const requiresAssetRead = requiredPermissions.includes("asset.read");
    const requiresAssetWrite = requiredPermissions.includes("asset.write");
    if ((requiresAssetRead || requiresAssetWrite) && policy.assetAccess === "deny") {
      deniedCapabilities.push("asset");
    } else if (requiresAssetWrite && policy.assetAccess === "read-only") {
      deniedCapabilities.push("asset");
    }

    return Object.freeze({
      allowed: deniedCapabilities.length === 0,
      deniedCapabilities: Object.freeze(deniedCapabilities),
      declaredCapabilities: Object.freeze([...declaredCapabilities]),
      policy,
      enforcement,
      reason: deniedCapabilities.length === 0 ? "sandbox-allowed" : "sandbox-denied",
    });
  }
}

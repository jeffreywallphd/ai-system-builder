import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import {
  createDefaultMcpToolSandboxEnforcementSummary,
  createDefaultMcpToolSandboxPolicy,
  deriveRequiredMcpToolPermissions,
  type McpToolSandboxCapabilityRequest,
  type McpToolExecutionSandboxDecision,
} from "../../../domain/mcp/McpToolTrust";

export class McpToolSandboxPolicyService {
  public evaluate(
    tool: InstalledMcpToolRecord,
    request: McpToolSandboxCapabilityRequest = Object.freeze({}),
  ): McpToolExecutionSandboxDecision {
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
    if (policy.environment.mode !== "none") {
      declaredCapabilities.add("environment");
    }

    const deniedCapabilities: Array<"network" | "filesystem" | "asset" | "environment"> = [];

    if (declaredCapabilities.has("network") && !policy.network.allowed) {
      deniedCapabilities.push("network");
    }
    if (!deniedCapabilities.includes("network") && declaredCapabilities.has("network")) {
      const requestedHosts = request.network?.hosts ?? [];
      const allowedHosts = policy.network.allowedHosts ?? [];
      if (allowedHosts.length > 0 && requestedHosts.some((host) => !allowedHosts.includes(host))) {
        deniedCapabilities.push("network");
      }
      const requestedProtocols = request.network?.protocols ?? [];
      const allowedProtocols = policy.network.allowedProtocols ?? [];
      if (allowedProtocols.length > 0 && requestedProtocols.some((protocol) => !allowedProtocols.includes(protocol))) {
        deniedCapabilities.push("network");
      }
    }

    const requiresFsRead = requiredPermissions.includes("filesystem.read");
    const requiresFsWrite = requiredPermissions.includes("filesystem.write") || requiredPermissions.includes("system.exec");
    if ((requiresFsRead || requiresFsWrite) && !policy.filesystem.allowed) {
      deniedCapabilities.push("filesystem");
    }
    if (!deniedCapabilities.includes("filesystem")) {
      const requestedReadPaths = request.filesystem?.readPaths ?? [];
      const requestedWritePaths = request.filesystem?.writePaths ?? [];
      const allowedReadPaths = policy.filesystem.readPaths ?? [];
      const allowedWritePaths = policy.filesystem.writePaths ?? [];
      if (allowedReadPaths.length > 0 && requestedReadPaths.some((path) => !allowedReadPaths.includes(path))) {
        deniedCapabilities.push("filesystem");
      }
      if (allowedWritePaths.length > 0 && requestedWritePaths.some((path) => !allowedWritePaths.includes(path))) {
        deniedCapabilities.push("filesystem");
      }
    }

    const requiresAssetRead = requiredPermissions.includes("asset.read");
    const requiresAssetWrite = requiredPermissions.includes("asset.write");
    if ((requiresAssetRead && !policy.assets.read) || (requiresAssetWrite && !policy.assets.write)) {
      deniedCapabilities.push("asset");
    }
    if (!deniedCapabilities.includes("asset")) {
      const requestedActions = request.asset?.actions ?? [];
      if (requestedActions.includes("write") && !policy.assets.write) {
        deniedCapabilities.push("asset");
      } else if (requestedActions.includes("read") && !policy.assets.read) {
        deniedCapabilities.push("asset");
      }
    }

    if (request.environment?.variableNames?.length && policy.environment.mode === "none") {
      deniedCapabilities.push("environment");
    } else if (
      request.environment?.variableNames?.length
      && policy.environment.mode === "allowlist"
      && (policy.environment.allowedEnvVars?.length ?? 0) > 0
      && request.environment.variableNames.some((name) => !(policy.environment.allowedEnvVars ?? []).includes(name))
    ) {
      deniedCapabilities.push("environment");
    }

    return Object.freeze({
      allowed: deniedCapabilities.length === 0,
      deniedCapabilities: Object.freeze(deniedCapabilities),
      declaredCapabilities: Object.freeze([...declaredCapabilities]),
      requestedCapabilities: request,
      policy,
      enforcement,
      reason: deniedCapabilities.length === 0 ? "sandbox-allowed" : "sandbox-denied",
    });
  }
}

import { describe, expect, it } from "bun:test";
import { McpToolApprovalPolicyService } from "../security/McpToolApprovalPolicyService";
import { McpToolSandboxPolicyService } from "../security/McpToolSandboxPolicyService";
import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";

function makeTool(overrides: Partial<InstalledMcpToolRecord> = {}): InstalledMcpToolRecord {
  return Object.freeze({
    toolId: "mcp:local:secure-weather",
    status: "enabled",
    installedAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    source: Object.freeze({ kind: "inline", location: "inline:test" }),
    grantedPermissions: Object.freeze(["network.access"] as const),
    definition: Object.freeze({
      id: "mcp:local:secure-weather",
      version: "1.0.0",
      displayName: "Secure Weather",
      sideEffects: "network",
      auth: Object.freeze({ kind: "none" }),
      permissions: Object.freeze(["network.access"] as const),
      tags: Object.freeze([]),
      categories: Object.freeze([]),
      binding: Object.freeze({ serverId: "local", toolName: "secure-weather" }),
      inputSchema: Object.freeze({ type: "object" }),
    }),
    ...overrides,
  });
}

describe("Mcp trust decision services", () => {
  it("requires explicit approvals even when permission grants exist", () => {
    const decision = new McpToolApprovalPolicyService().evaluate(makeTool(), { scopeType: "global" }, []);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("approval-required");
    expect(decision.missingApprovals).toEqual(["network.access"]);
  });

  it("requires explicit approval when no legacy grants exist", () => {
    const decision = new McpToolApprovalPolicyService().evaluate(
      makeTool({ grantedPermissions: Object.freeze([]), permissionApprovals: Object.freeze([]) }),
      { scopeType: "global" },
      [],
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("approval-required");
    expect(decision.missingApprovals).toEqual(["network.access"]);
  });

  it("returns declared-only environment enforcement while enforcing network/asset/filesystem policy gates", () => {
    const decision = new McpToolSandboxPolicyService().evaluate(makeTool({
      sandboxPolicy: Object.freeze({
        networkAccess: "deny",
        networkAllowlist: Object.freeze({ hosts: Object.freeze([]), protocols: Object.freeze(["https"]) }),
        filesystemAccess: Object.freeze({ mode: "deny", readAllowedPaths: Object.freeze([]), writeAllowedPaths: Object.freeze([]) }),
        assetAccess: "deny",
        environmentExposure: Object.freeze({ mode: "allowlist", allowlist: Object.freeze(["SAFE_ENV"]) }),
      }),
    }));
    expect(decision.allowed).toBe(false);
    expect(decision.deniedCapabilities).toContain("network");
    expect(decision.enforcement.environmentExposure).toBe("declared-only");
  });
});

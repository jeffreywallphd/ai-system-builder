import { describe, expect, it } from "bun:test";
import { normalizeAgentPolicy } from "../AgentPolicy";

const basePolicy = {
  toolAccess: {
    allowedToolIds: ["mcp:local:echo"],
    scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute"] }],
  },
  restrictedActions: [],
  costLimits: {},
  executionLimits: {},
  safetyConstraints: {
    requiredApprovals: [],
    deniedPermissionIds: [],
    sandbox: {
      network: { allowed: false },
      filesystem: { allowed: false },
      assets: { read: true, write: false },
      environment: { mode: "none" as const },
    },
  },
} as const;

describe("AgentPolicy", () => {
  it("aligns with canonical MCP permission and sandbox semantics without duplicate vocab", () => {
    const policy = normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        requiredApprovals: [{ permissionId: "network.access", minimumStatus: "approved", scopeType: "tool", scopeId: "mcp:local:echo" }],
        deniedPermissionIds: ["workspace.write"],
        sandbox: {
          network: { allowed: true, allowedHosts: ["api.example.com"], allowedProtocols: ["https"] },
          filesystem: { allowed: true, readPaths: ["/workspace"], writePaths: [] },
          assets: { read: true, write: false },
          environment: { mode: "allowlist", allowedEnvVars: ["TZ"] },
        },
      },
    });

    expect(policy.safetyConstraints.requiredApprovals[0]?.permissionId).toBe("network.access");
    expect(policy.safetyConstraints.sandbox.network.allowedProtocols).toEqual(["https"]);
    expect(policy.safetyConstraints.deniedPermissionIds).toEqual(["workspace.write"]);
    expect(policy.toolAccess.allowedMcpTools).toEqual([{ toolId: "mcp:local:echo", serverId: "local", toolName: "echo" }]);
  });

  it("rejects malformed tool scopes and invalid limits", () => {
    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      toolAccess: {
        allowedToolIds: ["mcp:local:echo"],
        scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["bad scope"] }],
      },
    })).toThrow("malformed");

    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      costLimits: { maxTokens: 0 },
    })).toThrow("positive integer");
  });

  it("rejects conflicting approvals/denials and approval collisions", () => {
    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        ...basePolicy.safetyConstraints,
        requiredApprovals: [{ permissionId: "filesystem.read", minimumStatus: "approved", scopeType: "global" }],
        deniedPermissionIds: ["filesystem.read"],
        sandbox: {
          network: { allowed: false },
          filesystem: { allowed: true, readPaths: ["/workspace"] },
          assets: { read: true, write: false },
          environment: { mode: "none" },
        },
      },
    })).toThrow("cannot be both required and denied");

    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        ...basePolicy.safetyConstraints,
        requiredApprovals: [
          { permissionId: "network.access", minimumStatus: "approved", scopeType: "tool", scopeId: "mcp:local:echo" },
          { permissionId: "network.access", minimumStatus: "pending", scopeType: "tool", scopeId: "mcp:local:echo" },
        ],
      },
    })).toThrow("conflicting minimumStatus");
  });

  it("enforces sandbox-policy edge cases", () => {
    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        ...basePolicy.safetyConstraints,
        sandbox: {
          network: { allowed: false, allowedHosts: ["api.example.com"] },
          filesystem: { allowed: false },
          assets: { read: true, write: false },
          environment: { mode: "none" },
        },
      },
    })).toThrow("cannot include allowedHosts");

    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        ...basePolicy.safetyConstraints,
        sandbox: {
          network: { allowed: false },
          filesystem: { allowed: false, readPaths: ["/workspace"] },
          assets: { read: true, write: false },
          environment: { mode: "none" },
        },
      },
    })).toThrow("cannot include readPaths");

    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      safetyConstraints: {
        ...basePolicy.safetyConstraints,
        sandbox: {
          network: { allowed: false },
          filesystem: { allowed: false },
          assets: { read: true, write: false },
          environment: { mode: "none", allowedEnvVars: ["TZ"] },
        },
      },
    })).toThrow("none mode cannot include allowedEnvVars");
  });

  it("rejects explicit MCP bindings that do not match canonical identity", () => {
    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      toolAccess: {
        allowedToolIds: ["mcp:local:echo"],
        allowedMcpTools: [{ toolId: "mcp:local:echo", serverId: "other", toolName: "echo" }],
        scopeConstraints: [],
      },
    })).toThrow("must match canonical");
  });

  it("rejects non-canonical workflow tool identity segments", () => {
    expect(() => normalizeAgentPolicy({
      ...basePolicy,
      toolAccess: {
        allowedToolIds: ["workflow:bad segment"],
        scopeConstraints: [],
      },
    })).toThrow("non-canonical");
  });
});

import { describe, expect, it } from "bun:test";
import { applyAgentPolicyConfiguration } from "../AgentPolicyConfiguration";
import type { AgentPolicy } from "../AgentPolicy";

const basePolicy: AgentPolicy = {
  toolAccess: {
    allowedToolIds: ["mcp:local:echo"],
    scopeConstraints: [],
  },
  restrictedActions: [],
  costLimits: {},
  executionLimits: { maxSteps: 3 },
  safetyConstraints: {
    requiredApprovals: [],
    deniedPermissionIds: [],
    sandbox: {
      network: { allowed: false },
      filesystem: { allowed: false },
      assets: { read: true, write: false },
      environment: { mode: "none" },
    },
  },
};

describe("AgentPolicyConfiguration", () => {
  it("supports structured backend-ready policy updates", () => {
    const updated = applyAgentPolicyConfiguration(basePolicy, [
      {
        type: "set-cost-limits",
        costLimits: { maxTokens: 2000, maxEstimatedUsd: 2.25 },
      },
      {
        type: "set-execution-limits",
        executionLimits: { maxSteps: 5, maxWallClockMs: 60_000 },
      },
      {
        type: "set-required-approvals",
        requiredApprovals: [{
          permissionId: "network.access",
          minimumStatus: "approved",
          scopeType: "tool",
          scopeId: "mcp:local:echo",
        }],
      },
      {
        type: "set-sandbox-policy",
        sandbox: {
          network: { allowed: true, allowedHosts: ["api.example.com"], allowedProtocols: ["https"] },
          filesystem: { allowed: false },
          assets: { read: true, write: false },
          environment: { mode: "none" },
        },
      },
    ]);

    expect(updated.costLimits.maxEstimatedUsd).toBe(2.25);
    expect(updated.executionLimits.maxSteps).toBe(5);
    expect(updated.safetyConstraints.requiredApprovals).toHaveLength(1);
    expect(updated.safetyConstraints.sandbox.network.allowed).toBe(true);
  });

  it("rejects contradictory policy combinations", () => {
    expect(() => applyAgentPolicyConfiguration(basePolicy, [
      {
        type: "set-sandbox-policy",
        sandbox: {
          network: { allowed: true },
          filesystem: { allowed: false },
          assets: { read: true, write: false },
          environment: { mode: "none" },
        },
      },
      {
        type: "set-denied-permissions",
        deniedPermissionIds: ["network.access"],
      },
      {
        type: "set-required-approvals",
        requiredApprovals: [{
          permissionId: "network.access",
          minimumStatus: "approved",
          scopeType: "tool",
          scopeId: "mcp:local:echo",
        }],
      },
    ])).toThrow("cannot be both required and denied");
  });
});

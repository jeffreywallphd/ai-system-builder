import { describe, expect, it } from "bun:test";
import { AgentMcpToolGovernanceService } from "../services/AgentMcpToolGovernanceService";
import { createAgent } from "@domain/agents/Agent";
import { AssetId } from "@domain/assets/AssetId";
import { createAgentPlan } from "@domain/agents/AgentPlan";
import { createInstalledMcpToolRecord, type InstalledMcpToolRecord } from "@domain/mcp/InstalledMcpTool";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";

function makeAgent() {
  return createAgent({
    id: "agent-1",
    name: "Agent 1",
    goals: [{ id: "goal-1", objective: "Do task", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 1 }],
    policy: {
      toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
      restrictedActions: [],
      costLimits: {},
      executionLimits: { maxSteps: 1 },
      safetyConstraints: {
        requiredApprovals: [],
        deniedPermissionIds: [],
        sandbox: { network: { allowed: true }, filesystem: { allowed: false }, assets: { read: true, write: false }, environment: { mode: "none" } },
      },
    },
    planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    memory: {
      agentId: "agent-1",
      assets: [{ assetId: new AssetId("asset:memory:1"), memoryType: "working" }],
      retrieval: { strategy: "latest-first", maxEntries: 5 },
      policy: { retrievableTypes: ["working"], writableTypes: ["working", "episodic"], retention: { mode: "bounded", maxDurableEntries: 10 } },
      revision: 1,
    },
    execution: { requireTrustedTools: true, maxExecutionUnits: 1 },
  });
}

function makePlan() {
  return createAgentPlan({
    planId: "agent-plan:1",
    agentId: "agent-1",
    strategyId: "deterministic",
    steps: [{
      stepId: "s1",
      toolId: "mcp:local:echo",
      dependsOnStepIds: [],
      intent: {
        action: "Echo",
        expectedOutputKey: "result",
        inputReferences: [],
        toolInvocation: {
          kind: "mcp",
          toolId: "mcp:local:echo",
          structuredInput: { text: "hello" },
        },
      },
    }],
  });
}

function makeRepo(tool?: InstalledMcpToolRecord): IMcpToolRegistryRepository {
  return {
    async listInstalledTools() { return tool ? [tool] : []; },
    async getInstalledTool(toolId: string) { return tool?.toolId === toolId ? tool : undefined; },
    async findInstalledToolByBinding() { return undefined; },
    async saveInstalledTool(record: InstalledMcpToolRecord) { return record; },
    async removeInstalledTool() { return false; },
  };
}

describe("AgentMcpToolGovernanceService", () => {
  it("allows plans that target enabled registry tools with canonical bindings", async () => {
    const installed = createInstalledMcpToolRecord({
      definition: {
        id: "mcp:local:echo",
        version: "1.0.0",
        displayName: "Echo",
        inputSchema: { type: "object", required: ["text"] },
        outputSchema: { type: "object" },
        sideEffects: "none",
        auth: { kind: "none" },
        tags: [],
        categories: ["utility"],
      },
      source: { kind: "inline", location: "test" },
      status: "enabled",
    });
    const service = new AgentMcpToolGovernanceService(makeRepo(installed));

    const result = await service.validatePlan(makeAgent(), makePlan());
    expect(result.allowed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns deterministic denial issues for missing registry tools", async () => {
    const service = new AgentMcpToolGovernanceService(makeRepo(undefined));

    const result = await service.validatePlan(makeAgent(), makePlan());
    expect(result.allowed).toBe(false);
    expect(result.issues[0]?.code).toBe("tool-not-installed");
  });
});


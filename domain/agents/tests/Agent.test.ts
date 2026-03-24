import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import { createAgent, toAgentReadModel, updateAgent } from "../Agent";

describe("Agent domain", () => {
  it("creates a first-class agent with structured goals, policy, and asset-backed memory", () => {
    const agent = createAgent({
      id: "agent-weather",
      name: "Weather Analyst",
      description: "Analyzes weather and reports risk.",
      goals: [{
        id: "g1",
        objective: "Retrieve weather and summarize risks",
        constraints: ["Use approved weather tools only"],
        successCriteria: ["Forecast includes severe-weather guidance"],
        priority: "high",
        priorityOrder: 1,
        requiredToolIds: ["mcp:local:get_weather"],
      }],
      policy: {
        allowedTools: ["mcp:local:get_weather"],
        toolScopeConstraints: [{ toolId: "mcp:local:get_weather", allowedScopes: ["forecast.read"] }],
        restrictedActions: ["filesystem.write"],
        costLimits: { maxTokens: 12_000 },
        executionLimits: { maxSteps: 3, maxWallClockMs: 30_000 },
        safetyConstraints: { requiredApprovals: ["weather-data"], deniedPermissions: ["network.open"] },
      },
      memory: {
        agentId: "agent-weather",
        assets: [{ assetId: new AssetId("asset:memory:weather"), memoryType: "episodic", lineageTag: "seed" }],
        retrieval: { strategy: "hybrid", maxEntries: 5, requiredTags: ["weather"] },
        revision: 1,
      },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      execution: { trustPolicyId: "trust:strict", requireTrustedTools: true, maxExecutionSteps: 3 },
    });

    expect(agent.name).toBe("Weather Analyst");
    expect(agent.policy.allowedTools[0]).toBe("mcp:local:get_weather");
    expect(agent.memory.assets[0]?.assetId.toString()).toBe("asset:memory:weather");
  });

  it("returns stable read models without caller-side reconstruction", () => {
    const agent = createAgent({
      id: "agent-read",
      name: "Read Model Agent",
      goals: [
        { id: "g2", objective: "Secondary", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 20 },
        { id: "g1", objective: "Primary", constraints: [], successCriteria: ["done"], priority: "critical", priorityOrder: 1 },
      ],
      policy: {
        allowedTools: ["mcp:local:echo"],
        toolScopeConstraints: [],
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
      },
      memory: {
        agentId: "agent-read",
        assets: [{ assetId: new AssetId("asset:memory:read"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 10 },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    });

    const readModel = toAgentReadModel(agent);
    expect(readModel.goals[0]?.id).toBe("g1");
    expect(readModel.memory.maxEntries).toBe(10);
  });

  it("rejects invalid policy and memory configuration", () => {
    expect(() =>
      createAgent({
        id: "agent-invalid",
        name: "Invalid Agent",
        goals: [{ id: "g1", objective: "Bad tool", constraints: [], successCriteria: ["Never"], priority: "normal", priorityOrder: 1 }],
        policy: {
          allowedTools: [],
          toolScopeConstraints: [],
          restrictedActions: [],
          costLimits: {},
          executionLimits: {},
          safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
        },
        memory: {
          agentId: "agent-invalid",
          assets: [],
          retrieval: { strategy: "latest-first", maxEntries: 1 },
          revision: 1,
        },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      }),
    ).toThrow("allowed tool");
  });

  it("rejects goals requiring tools outside allowed policy", () => {
    expect(() =>
      createAgent({
        id: "agent-invalid-goal-tool",
        name: "Invalid Goal Tool Agent",
        goals: [{
          id: "g1",
          objective: "Use secret tool",
          constraints: [],
          successCriteria: ["Done"],
          priority: "normal",
          priorityOrder: 1,
          requiredToolIds: ["mcp:local:secret"],
        }],
        policy: {
          allowedTools: ["mcp:local:echo"],
          toolScopeConstraints: [],
          restrictedActions: [],
          costLimits: {},
          executionLimits: {},
          safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
        },
        memory: {
          agentId: "agent-invalid-goal-tool",
          assets: [{ assetId: new AssetId("asset:memory:a"), memoryType: "working" }],
          retrieval: { strategy: "latest-first", maxEntries: 5 },
          revision: 1,
        },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      }),
    ).toThrow("not allowed by policy");
  });

  it("updates lifecycle status and validates changes", () => {
    const existing = createAgent({
      id: "agent-update",
      name: "Agent Update",
      goals: [{ id: "g1", objective: "Goal", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 1 }],
      policy: {
        allowedTools: ["mcp:local:echo"],
        toolScopeConstraints: [],
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
      },
      memory: {
        agentId: "agent-update",
        assets: [{ assetId: new AssetId("asset:memory:update"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 5 },
        revision: 1,
      },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
    });

    const updated = updateAgent(existing, {
      status: "paused",
      execution: { maxExecutionSteps: 2, requireTrustedTools: true },
    });

    expect(updated.status).toBe("paused");
    expect(updated.execution.maxExecutionSteps).toBe(2);
  });
});

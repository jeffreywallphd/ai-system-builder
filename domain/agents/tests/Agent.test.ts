import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import { createAgent, toAgentReadModel, updateAgent } from "../Agent";
import { normalizeAgentGoal } from "../AgentGoal";
import { normalizeAgentMemoryConfiguration } from "../AgentMemory";
import { normalizeAgentPolicy } from "../AgentPolicy";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
} from "../AgentExecutionSession";

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
        retrieval: {
          strategy: "hybrid",
          maxEntries: 5,
          requiredTags: ["weather"],
          memoryTypes: ["episodic", "semantic"],
          semantic: { minRelevanceScore: 0.4 },
          recency: { preferLatest: true, lookbackWindowEntries: 20 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      execution: { trustPolicyId: "trust:strict", requireTrustedTools: true, maxExecutionSteps: 3 },
    });

    expect(agent.name).toBe("Weather Analyst");
    expect(agent.policy.allowedTools[0]).toBe("mcp:local:get_weather");
    expect(agent.memory.assets[0]?.assetId.toString()).toBe("asset:memory:weather");
    expect(agent.memory.retrieval.semantic?.minRelevanceScore).toBe(0.4);
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

  it("enforces core agent invariants", () => {
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

    expect(() =>
      createAgent({
        id: "agent-invalid-execution",
        name: "Invalid execution",
        goals: [{ id: "g1", objective: "Goal", constraints: [], successCriteria: ["Done"], priority: "normal", priorityOrder: 1 }],
        policy: {
          allowedTools: ["mcp:local:echo"],
          toolScopeConstraints: [],
          restrictedActions: [],
          costLimits: {},
          executionLimits: { maxSteps: 2 },
          safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
        },
        memory: {
          agentId: "agent-invalid-execution",
          assets: [{ assetId: new AssetId("asset:memory:x"), memoryType: "working" }],
          retrieval: { strategy: "latest-first", maxEntries: 5 },
          revision: 1,
        },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
        execution: { maxExecutionSteps: 3, requireTrustedTools: true },
      }),
    ).toThrow("cannot exceed policy execution maxSteps");
  });

  it("supports immutable update semantics and timestamp evolution", () => {
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
      now: new Date("2026-03-24T00:00:00.000Z"),
    });

    const updated = updateAgent(existing, {
      status: "paused",
      execution: { maxExecutionSteps: 2, requireTrustedTools: true },
      now: new Date("2026-03-24T00:05:00.000Z"),
    });

    expect(updated.status).toBe("paused");
    expect(updated.execution.maxExecutionSteps).toBe(2);
    expect(updated.createdAt).toBe("2026-03-24T00:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-03-24T00:05:00.000Z");
  });
});

describe("Agent goal and policy invariants", () => {
  it("validates structured goal shape", () => {
    const goal = normalizeAgentGoal({
      id: "g1",
      objective: "Ship bounded plan",
      constraints: [" use trusted tools ", "use trusted tools"],
      successCriteria: ["done"],
      priority: "critical",
      priorityOrder: 0,
      requiredToolIds: ["mcp:local:echo", "mcp:local:echo"],
    });

    expect(goal.constraints).toEqual(["use trusted tools"]);
    expect(goal.requiredToolIds).toEqual(["mcp:local:echo"]);
  });

  it("validates structured policy limits and scope constraints", () => {
    const policy = normalizeAgentPolicy({
      allowedTools: ["mcp:local:echo", "mcp:local:echo"],
      toolScopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute", "runtime.execute"] }],
      restrictedActions: ["filesystem.write", "filesystem.write"],
      costLimits: { maxTokens: 1000, maxEstimatedUsd: 1.25 },
      executionLimits: { maxSteps: 3, maxWallClockMs: 10000 },
      safetyConstraints: { requiredApprovals: ["tool.run"], deniedPermissions: ["network.open"] },
    });

    expect(policy.allowedTools).toEqual(["mcp:local:echo"]);
    expect(policy.toolScopeConstraints[0]?.allowedScopes).toEqual(["runtime.execute"]);
    expect(policy.restrictedActions).toEqual(["filesystem.write"]);
  });

  it("rejects malformed policy constraints", () => {
    expect(() =>
      normalizeAgentPolicy({
        allowedTools: ["mcp:local:echo"],
        toolScopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: [] }],
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: { requiredApprovals: [], deniedPermissions: [] },
      }),
    ).toThrow("at least one scope");
  });
});

describe("Agent memory invariants", () => {
  it("accepts typed retrieval configuration and deduplicates retrieval filters", () => {
    const memory = normalizeAgentMemoryConfiguration({
      agentId: "agent-m",
      assets: [{ assetId: new AssetId("asset:memory:one"), memoryType: "semantic", assetVersionId: "v1" }],
      retrieval: {
        strategy: "semantic-filter",
        maxEntries: 10,
        requiredTags: ["project", "project"],
        memoryTypes: ["semantic", "semantic", "working"],
        semantic: { minRelevanceScore: 0.8 },
        recency: { preferLatest: true, lookbackWindowEntries: 100 },
      },
      revision: 2,
    });

    expect(memory.retrieval.requiredTags).toEqual(["project"]);
    expect(memory.retrieval.memoryTypes).toEqual(["semantic", "working"]);
    expect(memory.retrieval.semantic?.minRelevanceScore).toBe(0.8);
  });

  it("rejects malformed retrieval and duplicate asset references", () => {
    expect(() =>
      normalizeAgentMemoryConfiguration({
        agentId: "agent-m",
        assets: [
          { assetId: new AssetId("asset:memory:one"), memoryType: "semantic", assetVersionId: "v1" },
          { assetId: new AssetId("asset:memory:one"), memoryType: "semantic", assetVersionId: "v1" },
        ],
        retrieval: { strategy: "semantic-filter", maxEntries: 10, semantic: { minRelevanceScore: 1.5 } },
        revision: 1,
      }),
    ).toThrow("duplicate asset reference");

    expect(() =>
      normalizeAgentMemoryConfiguration({
        agentId: "agent-m",
        assets: [{ assetId: new AssetId("asset:memory:one"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 5, semantic: { minRelevanceScore: 0.5 } },
        revision: 1,
      }),
    ).toThrow("semantic config is not allowed");
  });
});

describe("Agent execution session invariants", () => {
  it("enforces lifecycle transitions and terminal timestamp coherence", () => {
    const queued = createAgentExecutionSession({
      id: "sess-1",
      agentId: "agent-1",
      startTime: new Date("2026-03-24T10:00:00.000Z"),
    });

    const planning = transitionAgentExecutionSession(queued, { status: AgentExecutionSessionStatuses.planning });
    const running = transitionAgentExecutionSession(planning, {
      status: AgentExecutionSessionStatuses.running,
      appendExecutionRunId: "run-1",
    });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendDiagnosticAssetId: "asset:diag:1",
      endedAt: new Date("2026-03-24T10:03:00.000Z"),
    });

    expect(completed.executionRunIds).toEqual(["run-1"]);
    expect(completed.diagnosticAssetIds).toEqual(["asset:diag:1"]);
    expect(completed.endTime).toBe("2026-03-24T10:03:00.000Z");

    expect(() =>
      transitionAgentExecutionSession(completed, { status: AgentExecutionSessionStatuses.running }),
    ).toThrow("Invalid agent execution session transition");
  });

  it("rejects session construction in terminal state", () => {
    expect(() =>
      createAgentExecutionSession({
        id: "sess-2",
        agentId: "agent-2",
        status: AgentExecutionSessionStatuses.completed,
      }),
    ).toThrow("cannot be created in a terminal status");
  });
});

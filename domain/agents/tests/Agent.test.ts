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

const defaultSafety = {
  requiredApprovals: [],
  deniedPermissionIds: [],
  sandbox: {
    network: { allowed: false },
    filesystem: { allowed: false },
    assets: { read: true, write: false },
    environment: { mode: "none" as const },
  },
} as const;

describe("Agent domain", () => {
  it("creates a first-class agent with explicit tool access, policy, and asset-backed memory", () => {
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
        toolAccess: {
          allowedToolIds: ["mcp:local:get_weather"],
          scopeConstraints: [{ toolId: "mcp:local:get_weather", allowedScopes: ["forecast.read"] }],
        },
        restrictedActions: ["filesystem.write"],
        costLimits: { maxTokens: 12_000 },
        executionLimits: { maxSteps: 3, maxWallClockMs: 30_000 },
        safetyConstraints: {
          requiredApprovals: [{ permissionId: "network.access", minimumStatus: "approved", scopeType: "tool", scopeId: "mcp:local:get_weather" }],
          deniedPermissionIds: [],
          sandbox: {
            network: { allowed: true, allowedHosts: ["api.weather.example"], allowedProtocols: ["https"] },
            filesystem: { allowed: true, readPaths: ["/workspace"], writePaths: [] },
            assets: { read: true, write: false },
            environment: { mode: "allowlist", allowedEnvVars: ["TZ"] },
          },
        },
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
        policy: {
          maxRetrievalEntries: 5,
          retrievableTypes: ["episodic", "semantic"],
          writableTypes: ["episodic", "working"],
          sessionOnlyTypes: ["working"],
          retention: { mode: "bounded", maxDurableEntries: 200 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { trustPolicyId: "trust:strict", requireTrustedTools: true, maxExecutionUnits: 3 },
    });

    expect(agent.toolAccess.allowedToolIds[0]).toBe("mcp:local:get_weather");
    expect(agent.toolAccess).toBe(agent.policy.toolAccess);
    expect(agent.memory.assets[0]?.assetId.toString()).toBe("asset:memory:weather");
  });

  it("returns stable read models without caller-side reconstruction", () => {
    const agent = createAgent({
      id: "agent-read",
      name: "Read Model Agent",
      goals: [
        { id: "g2", objective: "Secondary", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 2 },
        { id: "g1", objective: "Primary", constraints: [], successCriteria: ["done"], priority: "critical", priorityOrder: 1 },
      ],
      policy: {
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: defaultSafety,
      },
      memory: {
        agentId: "agent-read",
        assets: [{ assetId: new AssetId("asset:memory:read"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 10 },
        policy: {
          writableTypes: ["episodic", "semantic", "working"],
          retention: { mode: "bounded", maxDurableEntries: 200 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { maxExecutionUnits: 3, maxRunDurationMs: 30_000, requireTrustedTools: true },
    });

    const readModel = toAgentReadModel(agent);
    expect(readModel.goals[0]?.id).toBe("g1");
    expect(readModel.toolAccess.allowedToolIds).toEqual(["mcp:local:echo"]);
    expect(readModel.memory.assets.map((entry) => entry.assetId)).toEqual(["asset:memory:read"]);
  });

  it("enforces core agent invariants", () => {
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
          toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
          restrictedActions: [],
          costLimits: {},
          executionLimits: {},
          safetyConstraints: defaultSafety,
        },
        memory: {
          agentId: "agent-invalid-goal-tool",
          assets: [{ assetId: new AssetId("asset:memory:a"), memoryType: "working" }],
          retrieval: { strategy: "latest-first", maxEntries: 5 },
          policy: {
            writableTypes: ["working"],
            sessionOnlyTypes: ["working"],
            retention: { mode: "bounded", maxDurableEntries: 50 },
          },
          revision: 1,
        },
        planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
        execution: { maxExecutionUnits: 2, requireTrustedTools: true },
      }),
    ).toThrow("not allowed by policy");
  });

  it("supports immutable update semantics and timestamp evolution", () => {
    const existing = createAgent({
      id: "agent-update",
      name: "Agent Update",
      goals: [{ id: "g1", objective: "Goal", constraints: [], successCriteria: ["done"], priority: "normal", priorityOrder: 1 }],
      policy: {
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: defaultSafety,
      },
      memory: {
        agentId: "agent-update",
        assets: [{ assetId: new AssetId("asset:memory:update"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 5 },
        policy: {
          writableTypes: ["working", "episodic"],
          sessionOnlyTypes: ["working"],
          retention: { mode: "bounded", maxDurableEntries: 20 },
        },
        revision: 1,
      },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { maxExecutionUnits: 2, requireTrustedTools: true },
      now: new Date("2026-03-24T00:00:00.000Z"),
    });

    const updated = updateAgent(existing, {
      status: "paused",
      execution: { maxExecutionUnits: 2, requireTrustedTools: true },
      now: new Date("2026-03-24T00:05:00.000Z"),
    });

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
      priorityOrder: 1,
      requiredToolIds: ["mcp:local:echo", "mcp:local:echo"],
    });

    expect(goal.constraints).toEqual(["use trusted tools"]);
    expect(goal.requiredToolIds).toEqual(["mcp:local:echo"]);
  });

  it("validates policy alignment with MCP-style permission and sandbox semantics", () => {
    const policy = normalizeAgentPolicy({
      toolAccess: {
        allowedToolIds: ["mcp:local:echo", "mcp:local:echo"],
        scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: ["runtime.execute", "runtime.execute"] }],
      },
      restrictedActions: ["filesystem.write", "filesystem.write"],
      costLimits: { maxTokens: 1000, maxEstimatedUsd: 1.25 },
      executionLimits: { maxSteps: 3, maxWallClockMs: 10_000 },
      safetyConstraints: {
        requiredApprovals: [{ permissionId: "runtime.execute", minimumStatus: "approved", scopeType: "global" }],
        deniedPermissionIds: ["filesystem.write"],
        sandbox: {
          network: { allowed: true, allowedProtocols: ["https", "https"] },
          filesystem: { allowed: true, readPaths: ["/workspace", "/workspace"], writePaths: [] },
          assets: { read: true, write: false },
          environment: { mode: "allowlist", allowedEnvVars: ["TZ", "TZ"] },
        },
      },
    });

    expect(policy.toolAccess.allowedToolIds).toEqual(["mcp:local:echo"]);
    expect(policy.safetyConstraints.sandbox.filesystem.readPaths).toEqual(["/workspace"]);
    expect(policy.safetyConstraints.sandbox.environment.allowedEnvVars).toEqual(["TZ"]);
  });

  it("rejects malformed policy constraints", () => {
    expect(() =>
      normalizeAgentPolicy({
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [{ toolId: "mcp:local:echo", allowedScopes: [] }] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: defaultSafety,
      }),
    ).toThrow("at least one scope");

    expect(() =>
      normalizeAgentPolicy({
        toolAccess: { allowedToolIds: ["mcp:local:echo"], scopeConstraints: [] },
        restrictedActions: [],
        costLimits: {},
        executionLimits: {},
        safetyConstraints: {
          requiredApprovals: [],
          deniedPermissionIds: ["network.access"],
          sandbox: defaultSafety.sandbox,
        },
      }),
    ).toThrow("redundantly deny network.access");
  });
});

describe("Agent memory invariants", () => {
  it("accepts session-only initialization without durable asset references", () => {
    const memory = normalizeAgentMemoryConfiguration({
      agentId: "agent-m",
      assets: [],
      retrieval: { strategy: "latest-first", maxEntries: 5 },
      policy: {
        writableTypes: ["working"],
        sessionOnlyTypes: ["working"],
        retention: { mode: "disabled" },
      },
      revision: 1,
    });

    expect(memory.assets).toEqual([]);
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
        policy: { writableTypes: ["semantic"], retention: { mode: "bounded", maxDurableEntries: 20 } },
        revision: 1,
      }),
    ).toThrow("duplicate asset reference");

    expect(() =>
      normalizeAgentMemoryConfiguration({
        agentId: "agent-m",
        assets: [{ assetId: new AssetId("memory:one"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 5 },
        policy: {
          writableTypes: ["working"],
          sessionOnlyTypes: ["working"],
          retention: { mode: "bounded", maxDurableEntries: 20 },
        },
        revision: 1,
      }),
    ).toThrow("canonical asset id format");

    expect(() =>
      normalizeAgentMemoryConfiguration({
        agentId: "agent-m",
        assets: [{ assetId: new AssetId("asset:memory:one"), memoryType: "working" }],
        retrieval: { strategy: "latest-first", maxEntries: 5 },
        policy: {
          maxRetrievalEntries: 10,
          writableTypes: ["working"],
          sessionOnlyTypes: ["semantic"],
          retention: { mode: "disabled", maxDurableEntries: 5 },
        },
        revision: 1,
      }),
    ).toThrow("retention maxDurableEntries");
  });
});

describe("Agent execution session invariants", () => {
  it("enforces lifecycle transitions and canonical diagnostic references", () => {
    const queued = createAgentExecutionSession({
      id: "sess-1",
      agentId: "agent-1",
      planId: "agent-plan:1",
      startTime: new Date("2026-03-24T10:00:00.000Z"),
    });

    const ready = transitionAgentExecutionSession(queued, { status: AgentExecutionSessionStatuses.ready });
    const running = transitionAgentExecutionSession(ready, {
      status: AgentExecutionSessionStatuses.running,
      appendExecutionRun: { runId: "run-1", planId: "agent-plan:1", status: "running" },
    });
    const completed = transitionAgentExecutionSession(running, {
      status: AgentExecutionSessionStatuses.completed,
      appendDiagnostic: { assetId: new AssetId("asset:diag:1"), assetVersionId: "v1" },
      endedAt: new Date("2026-03-24T10:03:00.000Z"),
    });

    expect(completed.executionRuns.map((run) => run.runId)).toEqual(["run-1"]);
    expect(completed.diagnostics[0]?.assetId.toString()).toBe("asset:diag:1");
    expect(completed.endTime).toBe("2026-03-24T10:03:00.000Z");
  });

  it("rejects invalid transition and execution run/session plan mismatch", () => {
    const queued = createAgentExecutionSession({ id: "sess-2", agentId: "agent-2", planId: "agent-plan:2" });

    expect(() =>
      transitionAgentExecutionSession(queued, {
        status: AgentExecutionSessionStatuses.completed,
      }),
    ).toThrow("Invalid agent execution session transition");

    expect(() =>
      transitionAgentExecutionSession(queued, {
        status: AgentExecutionSessionStatuses.ready,
        appendExecutionRun: { runId: "run-bad", planId: "agent-plan:other", status: "running" },
      }),
    ).toThrow("must match session planId");
  });
});

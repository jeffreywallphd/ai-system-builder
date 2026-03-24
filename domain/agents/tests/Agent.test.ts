import { describe, expect, it } from "bun:test";
import { createAgent, toAgentReadModel, updateAgent } from "../Agent";

describe("Agent domain", () => {
  it("creates an agent with goals, policy, MCP tools, and memory assets", () => {
    const agent = createAgent({
      id: "agent-weather",
      name: "Weather Analyst",
      goals: [{ goalId: "g1", title: "Fetch weather", successCriteria: ["Returns forecast"], requiredToolIds: ["mcp:local:get_weather"] }],
      allowedTools: [{ toolId: "mcp:local:get_weather" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:weather"], retrieval: { tags: ["weather"], maxEntries: 5 } },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      executionPolicy: { trustPolicyId: "trust:strict", requireTrustedTools: true, maxExecutionSteps: 3 },
    });

    expect(agent.name).toBe("Weather Analyst");
    expect(agent.status).toBe("ready");
    expect(agent.allowedTools[0]?.toolId).toBe("mcp:local:get_weather");
    expect(agent.memoryConfig.memoryAssetIds).toEqual(["asset:memory:weather"]);
  });

  it("returns stable read models without caller-side reconstruction", () => {
    const agent = createAgent({
      id: "agent-read",
      name: "Read Model Agent",
      goals: [
        { goalId: "g2", title: "Secondary", successCriteria: ["done"], priority: 20 },
        { goalId: "g1", title: "Primary", successCriteria: ["done"], priority: 1 },
      ],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:read"] },
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
    });

    const readModel = toAgentReadModel(agent);
    expect(readModel.goals[0]?.goalId).toBe("g1");
    expect(readModel.memory.retrievalMaxEntries).toBe(10);
  });

  it("rejects invalid allowed tool and memory configuration", () => {
    expect(() =>
      createAgent({
        id: "agent-invalid",
        name: "Invalid Agent",
        goals: [{ goalId: "g1", title: "Bad tool", successCriteria: ["Never"] }],
        allowedTools: [{ toolId: "workflow:tool-a" }],
        memoryConfig: { memoryAssetIds: [] },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      }),
    ).toThrow("mcp:");
  });

  it("rejects goals requiring tools outside allowed set", () => {
    expect(() =>
      createAgent({
        id: "agent-invalid-goal-tool",
        name: "Invalid Goal Tool Agent",
        goals: [{ goalId: "g1", title: "Use secret tool", successCriteria: ["Done"], requiredToolIds: ["mcp:local:secret"] }],
        allowedTools: [{ toolId: "mcp:local:echo" }],
        memoryConfig: { memoryAssetIds: ["asset:memory:a"] },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      }),
    ).toThrow("not in allowedTools");
  });

  it("updates lifecycle status and validates changes", () => {
    const existing = createAgent({
      id: "agent-update",
      name: "Agent Update",
      goals: [{ goalId: "g1", title: "Goal", successCriteria: ["done"] }],
      allowedTools: [{ toolId: "mcp:local:echo" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:update"] },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
    });

    const updated = updateAgent(existing, {
      status: "paused",
      executionPolicy: { maxExecutionSteps: 2 },
    });

    expect(updated.status).toBe("paused");
    expect(updated.executionPolicy.maxExecutionSteps).toBe(2);
  });
});

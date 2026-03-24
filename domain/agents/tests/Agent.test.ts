import { describe, expect, it } from "bun:test";
import { createAgent } from "../Agent";

describe("Agent domain", () => {
  it("creates an agent with structured goals and MCP tool references", () => {
    const agent = createAgent({
      id: "agent-weather",
      goals: [{ goalId: "g1", title: "Fetch weather", successCriteria: ["Returns forecast"] }],
      allowedTools: [{ toolId: "mcp:local:get_weather" }],
      memoryConfig: { memoryAssetIds: ["asset:memory:weather"], retrieval: { tags: ["weather"] } },
      planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
    });

    expect(agent.id).toBe("agent-weather");
    expect(agent.allowedTools[0]?.toolId).toBe("mcp:local:get_weather");
    expect(agent.memoryConfig.memoryAssetIds).toEqual(["asset:memory:weather"]);
  });

  it("rejects non-MCP tool references", () => {
    expect(() =>
      createAgent({
        id: "agent-invalid",
        goals: [{ goalId: "g1", title: "Bad tool", successCriteria: ["Never"] }],
        allowedTools: [{ toolId: "workflow:tool-a" }],
        memoryConfig: { memoryAssetIds: [] },
        planningStrategy: { strategyId: "linear-default", mode: "deterministic-linear" },
      }),
    ).toThrow("mcp:");
  });
});

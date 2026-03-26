import { describe, expect, it } from "bun:test";
import { applyAgentGoalConfiguration } from "../AgentGoalConfiguration";

const baseGoals = [
  {
    id: "goal-1",
    objective: "First",
    constraints: [],
    successCriteria: ["done"],
    priority: "normal" as const,
    priorityOrder: 1,
    requiredToolIds: ["mcp:local:echo"],
  },
];

describe("AgentGoalConfiguration", () => {
  it("applies add/update/remove/reorder deterministically", () => {
    const added = applyAgentGoalConfiguration(baseGoals, [{
      type: "add",
      goal: {
        id: "goal-2",
        objective: "Second",
        constraints: [],
        successCriteria: ["done"],
        priority: "high",
        priorityOrder: 2,
        requiredToolIds: ["workflow:tool:summary"],
      },
    }]);

    const updated = applyAgentGoalConfiguration(added, [{
      type: "update",
      goalId: "goal-2",
      goal: {
        objective: "Second updated",
        constraints: [],
        successCriteria: ["done"],
        priority: "critical",
        priorityOrder: 2,
        requiredToolIds: ["mcp:local:echo"],
      },
    }]);

    const reordered = applyAgentGoalConfiguration(updated, [{
      type: "reorder",
      goalIdsInPriorityOrder: ["goal-2", "goal-1"],
    }]);

    const removed = applyAgentGoalConfiguration(reordered, [{ type: "remove", goalId: "goal-1" }]);
    expect(removed.map((goal) => goal.id)).toEqual(["goal-2"]);
    expect(reordered[0]?.priorityOrder).toBe(1);
  });

  it("rejects duplicates, malformed required tool ids, and incoherent ordering", () => {
    expect(() => applyAgentGoalConfiguration(baseGoals, [{ type: "add", goal: baseGoals[0] }])).toThrow("already exists");

    expect(() => applyAgentGoalConfiguration(baseGoals, [{
      type: "add",
      goal: {
        id: "goal-2",
        objective: "Bad tool",
        constraints: [],
        successCriteria: ["done"],
        priority: "normal",
        priorityOrder: 2,
        requiredToolIds: ["invalid-tool"],
      },
    }])).toThrow("malformed");

    expect(() => applyAgentGoalConfiguration(baseGoals, [{
      type: "add",
      goal: {
        id: "goal-2",
        objective: "Bad order",
        constraints: [],
        successCriteria: ["done"],
        priority: "normal",
        priorityOrder: 3,
        requiredToolIds: ["mcp:local:echo"],
      },
    }])).toThrow("contiguous and start at 1");
  });
});

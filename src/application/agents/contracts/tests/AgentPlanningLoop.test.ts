import { describe, expect, it } from "bun:test";
import { createAgentPlan } from "@domain/agents/AgentPlan";
import {
  AgentPlanningStatuses,
  AgentReplanTriggerReasons,
  createPlannedOutcome,
  createPlanningOutcome,
  createReplanEvaluation,
  createTerminalEvaluation,
} from "../AgentPlanningLoop";

function createPlan() {
  return createAgentPlan({
    planId: "agent-plan:loop",
    agentId: "agent-loop",
    strategyId: "deterministic",
    steps: [{ stepId: "s1", toolId: "mcp:local:echo", dependsOnStepIds: [], intent: { action: "Ping", inputReferences: [] } }],
  });
}

describe("Agent planning loop contracts", () => {
  it("creates a planned outcome for the initial planning phase", () => {
    const outcome = createPlannedOutcome(createPlan());
    expect(outcome.evaluation.status).toBe(AgentPlanningStatuses.planned);
    expect(outcome.evaluation.affectedStepIds).toEqual([]);
  });

  it("creates bounded replan signals without runtime orchestration", () => {
    const evaluation = createReplanEvaluation({
      reason: AgentReplanTriggerReasons.executionFailure,
      summary: "Step failed with timeout",
      affectedStepIds: ["s1"],
    });

    expect(evaluation.status).toBe(AgentPlanningStatuses.needsReplan);
    expect(evaluation.reason).toBe(AgentReplanTriggerReasons.executionFailure);
    expect(evaluation.affectedStepIds).toEqual(["s1"]);
  });

  it("supports a minimal terminal evaluation helper", () => {
    const evaluation = createTerminalEvaluation({ summary: "all goals satisfied", affectedStepIds: ["s1", "s1"] });
    expect(evaluation.status).toBe(AgentPlanningStatuses.terminal);
    expect(evaluation.affectedStepIds).toEqual(["s1"]);
  });

  it("validates evaluation consistency against plan semantics", () => {
    const plan = createPlan();

    expect(() =>
      createPlanningOutcome(plan, {
        status: AgentPlanningStatuses.needsReplan,
        reason: AgentReplanTriggerReasons.unmetGoal,
        affectedStepIds: [],
      }),
    ).toThrow("requires at least one affected step id");

    expect(() =>
      createPlanningOutcome(plan, {
        status: AgentPlanningStatuses.planned,
        reason: AgentReplanTriggerReasons.externalChange,
        affectedStepIds: [],
      }),
    ).toThrow("cannot include a replan reason");

    expect(() =>
      createPlanningOutcome(plan, {
        status: AgentPlanningStatuses.terminal,
        affectedStepIds: ["missing-step"],
      }),
    ).toThrow("unknown affected step");
  });
});


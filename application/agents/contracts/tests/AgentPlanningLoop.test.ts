import { describe, expect, it } from "bun:test";
import { createAgentPlan } from "../../../../domain/agents/AgentPlan";
import {
  AgentPlanningStatuses,
  AgentReplanTriggerReasons,
  createPlannedOutcome,
  createReplanEvaluation,
} from "../AgentPlanningLoop";

describe("Agent planning loop contracts", () => {
  it("creates a planned outcome for the initial planning phase", () => {
    const plan = createAgentPlan({
      planId: "agent-plan:loop",
      agentId: "agent-loop",
      strategyId: "deterministic",
      steps: [{ stepId: "s1", toolId: "mcp:local:echo", dependsOnStepIds: [], intent: { action: "Ping", inputReferences: [] } }],
    });

    const outcome = createPlannedOutcome(plan);
    expect(outcome.evaluation.status).toBe(AgentPlanningStatuses.planned);
    expect(outcome.evaluation.affectedStepIds).toEqual([]);
  });

  it("creates bounded replan signals without runtime orchestration", () => {
    const evaluation = createReplanEvaluation({
      reason: AgentReplanTriggerReasons.executionFailure,
      summary: "Step failed with timeout",
      affectedStepIds: ["s2"],
    });

    expect(evaluation.status).toBe(AgentPlanningStatuses.needsReplan);
    expect(evaluation.reason).toBe(AgentReplanTriggerReasons.executionFailure);
    expect(evaluation.affectedStepIds).toEqual(["s2"]);
  });
});

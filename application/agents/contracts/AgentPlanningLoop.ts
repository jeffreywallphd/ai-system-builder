import type { AgentPlan } from "../../../domain/agents/AgentPlan";

export const AgentPlanningStatuses = Object.freeze({
  planned: "planned",
  needsReplan: "needs-replan",
  terminal: "terminal",
});

export type AgentPlanningStatus = typeof AgentPlanningStatuses[keyof typeof AgentPlanningStatuses];

export const AgentReplanTriggerReasons = Object.freeze({
  executionFailure: "execution-failure",
  unmetGoal: "unmet-goal",
  policyConstraint: "policy-constraint",
  externalChange: "external-change",
});

export type AgentReplanTriggerReason = typeof AgentReplanTriggerReasons[keyof typeof AgentReplanTriggerReasons];

export interface AgentPlanEvaluation {
  readonly status: AgentPlanningStatus;
  readonly reason?: AgentReplanTriggerReason;
  readonly summary?: string;
  readonly affectedStepIds: ReadonlyArray<string>;
}

export interface AgentPlanningOutcome {
  readonly plan: AgentPlan;
  readonly evaluation: AgentPlanEvaluation;
}

export function createPlannedOutcome(plan: AgentPlan): AgentPlanningOutcome {
  return Object.freeze({
    plan,
    evaluation: Object.freeze({
      status: AgentPlanningStatuses.planned,
      affectedStepIds: Object.freeze([]),
    }),
  });
}

export function createReplanEvaluation(input: {
  readonly reason: AgentReplanTriggerReason;
  readonly summary?: string;
  readonly affectedStepIds?: ReadonlyArray<string>;
}): AgentPlanEvaluation {
  const affectedStepIds = Object.freeze([...(input.affectedStepIds ?? [])]);
  return Object.freeze({
    status: AgentPlanningStatuses.needsReplan,
    reason: input.reason,
    summary: input.summary?.trim() || undefined,
    affectedStepIds,
  });
}

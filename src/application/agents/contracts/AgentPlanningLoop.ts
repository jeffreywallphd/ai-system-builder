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

function normalizeStepIds(stepIds: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const normalized = [...new Set((stepIds ?? []).map((stepId) => stepId.trim()).filter(Boolean))];
  return Object.freeze(normalized);
}

function normalizeSummary(summary: string | undefined): string | undefined {
  const normalized = summary?.trim();
  return normalized ? normalized : undefined;
}

function validateEvaluation(evaluation: AgentPlanEvaluation, plan: AgentPlan): void {
  const validStepIds = new Set(plan.steps.map((step) => step.stepId));

  for (const stepId of evaluation.affectedStepIds) {
    if (!validStepIds.has(stepId)) {
      throw new Error(`Agent planning evaluation references unknown affected step '${stepId}'.`);
    }
  }

  if (evaluation.status === AgentPlanningStatuses.needsReplan) {
    if (!evaluation.reason) {
      throw new Error("Agent planning replan evaluation requires a reason.");
    }
    if (evaluation.affectedStepIds.length === 0) {
      throw new Error("Agent planning replan evaluation requires at least one affected step id.");
    }
    return;
  }

  if (evaluation.reason) {
    throw new Error(`Agent planning evaluation status '${evaluation.status}' cannot include a replan reason.`);
  }
}

export function createPlannedOutcome(plan: AgentPlan): AgentPlanningOutcome {
  return createPlanningOutcome(plan, {
    status: AgentPlanningStatuses.planned,
    affectedStepIds: [],
  });
}

export function createTerminalEvaluation(input?: {
  readonly summary?: string;
  readonly affectedStepIds?: ReadonlyArray<string>;
}): AgentPlanEvaluation {
  return Object.freeze({
    status: AgentPlanningStatuses.terminal,
    affectedStepIds: normalizeStepIds(input?.affectedStepIds),
    summary: normalizeSummary(input?.summary),
  });
}

export function createReplanEvaluation(input: {
  readonly reason: AgentReplanTriggerReason;
  readonly summary?: string;
  readonly affectedStepIds?: ReadonlyArray<string>;
}): AgentPlanEvaluation {
  const affectedStepIds = normalizeStepIds(input.affectedStepIds);
  if (affectedStepIds.length === 0) {
    throw new Error("Agent planning replan evaluation requires at least one affected step id.");
  }

  return Object.freeze({
    status: AgentPlanningStatuses.needsReplan,
    reason: input.reason,
    summary: normalizeSummary(input.summary),
    affectedStepIds,
  });
}

export function createPlanningOutcome(plan: AgentPlan, evaluation: AgentPlanEvaluation): AgentPlanningOutcome {
  const normalizedEvaluation = Object.freeze({
    status: evaluation.status,
    reason: evaluation.reason,
    summary: normalizeSummary(evaluation.summary),
    affectedStepIds: normalizeStepIds(evaluation.affectedStepIds),
  });
  validateEvaluation(normalizedEvaluation, plan);

  return Object.freeze({
    plan,
    evaluation: normalizedEvaluation,
  });
}

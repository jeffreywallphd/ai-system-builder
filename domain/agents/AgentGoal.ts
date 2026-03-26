import { isCanonicalAgentToolId } from "./AgentToolIdentity";

export const AgentGoalPriorityLevels = Object.freeze({
  low: "low",
  normal: "normal",
  high: "high",
  critical: "critical",
});

export type AgentGoalPriorityLevel = typeof AgentGoalPriorityLevels[keyof typeof AgentGoalPriorityLevels];

export interface AgentGoal {
  readonly id: string;
  readonly objective: string;
  readonly constraints: ReadonlyArray<string>;
  readonly successCriteria: ReadonlyArray<string>;
  readonly priority: AgentGoalPriorityLevel;
  readonly priorityOrder: number;
  readonly requiredToolIds?: ReadonlyArray<string>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

export function normalizeAgentGoal(input: AgentGoal): AgentGoal {
  const id = normalizeRequired(input.id, "Agent goal id");
  const objective = normalizeRequired(input.objective, "Agent goal objective");
  const constraints = normalizeList(input.constraints);
  const successCriteria = normalizeList(input.successCriteria);
  const requiredToolIds = normalizeList(input.requiredToolIds);

  if (successCriteria.length === 0) {
    throw new Error("Agent goals must define at least one success criterion.");
  }
  if (!Object.values(AgentGoalPriorityLevels).includes(input.priority)) {
    throw new Error("Agent goal priority must be one of low, normal, high, or critical.");
  }
  if (!Number.isInteger(input.priorityOrder) || input.priorityOrder < 1) {
    throw new Error("Agent goal priorityOrder must be an integer greater than or equal to 1.");
  }

  for (const requiredToolId of requiredToolIds) {
    if (!isCanonicalAgentToolId(requiredToolId)) {
      throw new Error(`Agent goal required tool id '${requiredToolId}' is malformed.`);
    }
  }

  return Object.freeze({
    id,
    objective,
    constraints,
    successCriteria,
    priority: input.priority,
    priorityOrder: input.priorityOrder,
    requiredToolIds,
  });
}

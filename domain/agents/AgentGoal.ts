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
  return Object.freeze((values ?? []).map((value) => value.trim()).filter(Boolean));
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
  if (!Number.isInteger(input.priorityOrder) || input.priorityOrder < 0) {
    throw new Error("Agent goal priorityOrder must be a non-negative integer.");
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

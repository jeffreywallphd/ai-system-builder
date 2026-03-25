import type { AgentGoal } from "./AgentGoal";
import { normalizeAgentGoal } from "./AgentGoal";

export type AgentGoalConfigurationOperation =
  | { readonly type: "add"; readonly goal: AgentGoal }
  | { readonly type: "update"; readonly goalId: string; readonly goal: Omit<AgentGoal, "id"> }
  | { readonly type: "remove"; readonly goalId: string }
  | { readonly type: "reorder"; readonly goalIdsInPriorityOrder: ReadonlyArray<string> };

export function applyAgentGoalConfiguration(
  goals: ReadonlyArray<AgentGoal>,
  operations: ReadonlyArray<AgentGoalConfigurationOperation>,
): ReadonlyArray<AgentGoal> {
  let next = [...goals];
  for (const operation of operations) {
    if (operation.type === "add") {
      const goal = normalizeAgentGoal(operation.goal);
      if (next.some((entry) => entry.id === goal.id)) {
        throw new Error(`Agent goal '${goal.id}' already exists.`);
      }
      next.push(goal);
      continue;
    }

    if (operation.type === "remove") {
      const goalId = operation.goalId.trim();
      const beforeCount = next.length;
      next = next.filter((goal) => goal.id !== goalId);
      if (beforeCount === next.length) {
        throw new Error(`Agent goal '${goalId}' was not found.`);
      }
      continue;
    }

    if (operation.type === "update") {
      const goalId = operation.goalId.trim();
      let updated = false;
      next = next.map((goal) => {
        if (goal.id !== goalId) {
          return goal;
        }
        updated = true;
        return normalizeAgentGoal({
          id: goal.id,
          ...operation.goal,
        });
      });
      if (!updated) {
        throw new Error(`Agent goal '${goalId}' was not found.`);
      }
      continue;
    }

    next = reorderGoals(next, operation.goalIdsInPriorityOrder);
  }

  validateGoalPriorityOrdering(next);
  return Object.freeze(next.map((goal) => Object.freeze(goal)));
}

function reorderGoals(goals: ReadonlyArray<AgentGoal>, goalIdsInPriorityOrder: ReadonlyArray<string>): AgentGoal[] {
  const normalizedIds = goalIdsInPriorityOrder.map((id) => id.trim()).filter(Boolean);
  const existingIds = goals.map((goal) => goal.id);
  if (normalizedIds.length !== existingIds.length) {
    throw new Error("Goal reorder operation must include every existing goal exactly once.");
  }
  const idSet = new Set(normalizedIds);
  if (idSet.size !== normalizedIds.length || existingIds.some((id) => !idSet.has(id))) {
    throw new Error("Goal reorder operation must include every existing goal exactly once.");
  }

  const goalById = new Map(goals.map((goal) => [goal.id, goal] as const));
  return normalizedIds.map((goalId, index) => {
    const goal = goalById.get(goalId);
    if (!goal) {
      throw new Error(`Agent goal '${goalId}' was not found.`);
    }
    return Object.freeze({
      ...goal,
      priorityOrder: index + 1,
    });
  });
}

function validateGoalPriorityOrdering(goals: ReadonlyArray<AgentGoal>): void {
  const priorityOrders = goals.map((goal) => goal.priorityOrder);
  if (new Set(priorityOrders).size !== priorityOrders.length) {
    throw new Error("Goal priorityOrder values must be unique.");
  }
  const sorted = [...priorityOrders].sort((left, right) => left - right);
  const contiguous = sorted.every((value, index) => value === index + 1);
  if (!contiguous) {
    throw new Error("Goal priorityOrder values must be contiguous and start at 1.");
  }
}

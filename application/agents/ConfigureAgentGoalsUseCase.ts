import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { AgentGoal } from "../../domain/agents/AgentGoal";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export type AgentGoalConfigurationOperation =
  | { readonly type: "add"; readonly goal: AgentGoal }
  | { readonly type: "update"; readonly goalId: string; readonly goal: Omit<AgentGoal, "id"> }
  | { readonly type: "remove"; readonly goalId: string }
  | { readonly type: "reorder"; readonly goalIdsInPriorityOrder: ReadonlyArray<string> };

export interface ConfigureAgentGoalsRequest {
  readonly agentId: string;
  readonly operations: ReadonlyArray<AgentGoalConfigurationOperation>;
}

export class ConfigureAgentGoalsUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(request: ConfigureAgentGoalsRequest): Promise<AgentReadModel> {
    const agentId = request.agentId.trim();
    const current = await this.repository.get(agentId);
    if (!current) {
      throw new Error(`Agent '${agentId}' was not found.`);
    }

    let goals = [...current.goals];
    for (const operation of request.operations) {
      if (operation.type === "add") {
        goals.push(operation.goal);
        continue;
      }

      if (operation.type === "remove") {
        const goalId = operation.goalId.trim();
        goals = goals.filter((goal) => goal.id !== goalId);
        continue;
      }

      if (operation.type === "update") {
        const goalId = operation.goalId.trim();
        let updated = false;
        goals = goals.map((goal) => {
          if (goal.id !== goalId) {
            return goal;
          }
          updated = true;
          return Object.freeze({
            id: goal.id,
            ...operation.goal,
          });
        });
        if (!updated) {
          throw new Error(`Agent goal '${goalId}' was not found.`);
        }
        continue;
      }

      goals = reorderGoals(goals, operation.goalIdsInPriorityOrder);
    }

    const saved = await this.repository.save(updateAgent(current, { goals }));
    return toAgentReadModel(saved);
  }
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

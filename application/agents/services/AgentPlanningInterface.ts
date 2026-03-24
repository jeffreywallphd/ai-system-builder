import type { Agent } from "../../../domain/agents/Agent";

export interface AgentPlanStep {
  readonly stepId: string;
  readonly goalId: string;
  readonly toolId?: string;
  readonly action: string;
}

export interface AgentPlanningInterface {
  planNextStep(agent: Agent, context?: Readonly<Record<string, unknown>>): AgentPlanStep;
}

export class DeterministicAgentPlanningService implements AgentPlanningInterface {
  public planNextStep(agent: Agent): AgentPlanStep {
    const goal = agent.goals[0];
    return Object.freeze({
      stepId: `plan:${agent.id}:${goal?.goalId ?? "goal"}`,
      goalId: goal?.goalId ?? "goal",
      toolId: agent.allowedTools[0]?.toolId,
      action: goal?.title ?? "execute-agent-goal",
    });
  }
}

import type { Agent } from "../../../domain/agents/Agent";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";

export interface AgentPlanningStrategyRequest {
  readonly agent: Agent;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface AgentPlanningStrategyDescriptor {
  readonly id: string;
  readonly mode: string;
  readonly label?: string;
}

export interface AgentPlanningStrategy {
  readonly descriptor: AgentPlanningStrategyDescriptor;
  plan(request: AgentPlanningStrategyRequest): Promise<AgentPlan>;
}

export type AgentPlanningInterface = AgentPlanningStrategy;

import type { Agent } from "@domain/agents/Agent";
import type { AgentGoal } from "@domain/agents/AgentGoal";
import type { AgentPlan } from "@domain/agents/AgentPlan";

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

export interface AgentPlanToolCompatibilityIssue {
  readonly toolId: string;
  readonly category: "unavailable" | "not-allowed" | "approval-required" | "denied" | "incompatible";
  readonly code: string;
  readonly message: string;
}

export interface AgentPlanToolSelectionRequest {
  readonly agent: Agent;
  readonly goal: AgentGoal;
  readonly candidateToolIds: ReadonlyArray<string>;
  readonly action: string;
  readonly expectedOutputKey?: string;
}

export interface AgentPlanToolSelectionResult {
  readonly selectedToolId?: string;
  readonly issues: ReadonlyArray<AgentPlanToolCompatibilityIssue>;
}

export interface AgentPlanToolSelectionService {
  selectToolForGoal(request: AgentPlanToolSelectionRequest): Promise<AgentPlanToolSelectionResult>;
}

export type AgentPlanningInterface = AgentPlanningStrategy;


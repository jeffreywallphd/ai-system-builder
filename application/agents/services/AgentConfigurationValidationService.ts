import { createAgent, type AgentExecutionConfiguration, type AgentPlanningStrategy } from "../../../domain/agents/Agent";
import type { AgentGoal } from "../../../domain/agents/AgentGoal";
import type { AgentMemoryConfiguration } from "../../../domain/agents/AgentMemory";
import type { AgentPolicy } from "../../../domain/agents/AgentPolicy";

export interface AgentConfigurationValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface AgentConfigurationValidationInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly memory: AgentMemoryConfiguration;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly execution: AgentExecutionConfiguration;
}

export interface AgentConfigurationValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<AgentConfigurationValidationIssue>;
}

export class AgentConfigurationValidationService {
  public validate(input: AgentConfigurationValidationInput): AgentConfigurationValidationResult {
    const issues: AgentConfigurationValidationIssue[] = [];

    const priorityOrders = input.goals.map((goal) => goal.priorityOrder);
    const uniqueOrderCount = new Set(priorityOrders).size;
    if (uniqueOrderCount !== priorityOrders.length) {
      issues.push({
        code: "goal-priority-order-duplicate",
        path: "goals",
        message: "Goal priorityOrder values must be unique.",
        severity: "error",
      });
    }

    if (input.policy.executionLimits.maxSteps !== undefined && input.goals.length > input.policy.executionLimits.maxSteps) {
      issues.push({
        code: "execution-limits-max-steps-too-low",
        path: "policy.executionLimits.maxSteps",
        message: "policy.executionLimits.maxSteps is lower than the number of configured goals.",
        severity: "error",
      });
    }

    if (input.execution.maxExecutionUnits !== undefined && input.goals.length > input.execution.maxExecutionUnits) {
      issues.push({
        code: "execution-max-units-too-low",
        path: "execution.maxExecutionUnits",
        message: "execution.maxExecutionUnits is lower than the number of configured goals.",
        severity: "error",
      });
    }

    if (input.planningStrategy.mode !== "deterministic-linear") {
      issues.push({
        code: "strategy-mode-not-production-ready",
        path: "planningStrategy.mode",
        message: "Only deterministic-linear strategy is currently production-hardened.",
        severity: "warning",
      });
    }

    try {
      createAgent({
        id: input.id,
        name: input.name,
        description: input.description,
        goals: input.goals,
        policy: input.policy,
        memory: input.memory,
        planningStrategy: input.planningStrategy,
        execution: input.execution,
      });
    } catch (error) {
      issues.push({
        code: "agent-configuration-invalid",
        path: "agent",
        message: error instanceof Error ? error.message : "Agent configuration is invalid.",
        severity: "error",
      });
    }

    const hasError = issues.some((issue) => issue.severity === "error");
    return Object.freeze({
      valid: !hasError,
      issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    });
  }
}

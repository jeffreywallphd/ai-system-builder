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
    const allowedToolIds = new Set(input.policy.toolAccess.allowedToolIds);

    if (input.goals.length === 0) {
      issues.push({
        code: "goal-missing",
        path: "goals",
        message: "At least one goal is required.",
        severity: "error",
      });
    }

    const goalIds = input.goals.map((goal) => goal.id.trim()).filter(Boolean);
    if (goalIds.length !== input.goals.length) {
      issues.push({
        code: "goal-id-missing",
        path: "goals",
        message: "Every goal must define a non-empty id.",
        severity: "error",
      });
    }
    if (new Set(goalIds).size !== goalIds.length) {
      issues.push({
        code: "goal-id-duplicate",
        path: "goals",
        message: "Goal ids must be unique.",
        severity: "error",
      });
    }

    for (const goal of input.goals) {
      if (!goal.objective.trim()) {
        issues.push({
          code: "goal-objective-missing",
          path: `goals.${goal.id || "<unknown>"}.objective`,
          message: "Goal objective is required.",
          severity: "error",
        });
      }
      if (goal.successCriteria.length === 0) {
        issues.push({
          code: "goal-success-criteria-missing",
          path: `goals.${goal.id || "<unknown>"}.successCriteria`,
          message: "Goal successCriteria must include at least one value.",
          severity: "error",
        });
      }
      for (const requiredToolId of goal.requiredToolIds ?? []) {
        if (!/^mcp:[^:\s]+:[^:\s]+$/.test(requiredToolId) && !/^workflow:[^:\s]+/.test(requiredToolId)) {
          issues.push({
            code: "goal-required-tool-malformed",
            path: `goals.${goal.id || "<unknown>"}.requiredToolIds`,
            message: `Goal required tool id '${requiredToolId}' is malformed.`,
            severity: "error",
          });
          continue;
        }
        if (!allowedToolIds.has(requiredToolId)) {
          issues.push({
            code: "goal-required-tool-not-allowed",
            path: `goals.${goal.id || "<unknown>"}.requiredToolIds`,
            message: `Goal requires tool '${requiredToolId}' that is not present in policy.toolAccess.allowedToolIds.`,
            severity: "error",
          });
        }
      }
    }

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
    const sortedPriority = [...priorityOrders].sort((left, right) => left - right);
    const contiguous = sortedPriority.every((value, index) => Number.isInteger(value) && value === index + 1);
    if (!contiguous) {
      issues.push({
        code: "goal-priority-order-noncontiguous",
        path: "goals",
        message: "Goal priorityOrder values must be contiguous and start at 1.",
        severity: "error",
      });
    }

    const malformedToolIds = input.policy.toolAccess.allowedToolIds.filter(
      (toolId) => !/^mcp:[^:\s]+:[^:\s]+$/.test(toolId) && !/^workflow:[^:\s]+/.test(toolId),
    );
    if (malformedToolIds.length > 0) {
      issues.push({
        code: "tool-id-malformed",
        path: "policy.toolAccess.allowedToolIds",
        message: `Malformed tool ids detected: ${malformedToolIds.join(", ")}.`,
        severity: "error",
      });
    }

    if (input.policy.toolAccess.allowedToolIds.length === 0) {
      issues.push({
        code: "tool-id-missing",
        path: "policy.toolAccess.allowedToolIds",
        message: "At least one allowed tool id is required.",
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
    if (
      input.execution.maxExecutionUnits !== undefined
      && input.policy.executionLimits.maxSteps !== undefined
      && input.execution.maxExecutionUnits > input.policy.executionLimits.maxSteps
    ) {
      issues.push({
        code: "execution-max-units-exceeds-policy-max-steps",
        path: "execution.maxExecutionUnits",
        message: "execution.maxExecutionUnits cannot exceed policy.executionLimits.maxSteps.",
        severity: "error",
      });
    }

    if (input.memory.agentId !== input.id) {
      issues.push({
        code: "memory-agent-id-mismatch",
        path: "memory.agentId",
        message: "memory.agentId must match the agent id.",
        severity: "error",
      });
    }

    if (input.memory.retrieval.strategy === "hybrid" && !input.memory.retrieval.semantic && !input.memory.retrieval.recency) {
      issues.push({
        code: "memory-hybrid-config-missing",
        path: "memory.retrieval",
        message: "Hybrid retrieval requires semantic or recency configuration.",
        severity: "error",
      });
    }
    if (input.memory.retrieval.strategy === "latest-first" && input.memory.retrieval.semantic) {
      issues.push({
        code: "memory-latest-first-semantic-not-allowed",
        path: "memory.retrieval.semantic",
        message: "latest-first retrieval does not allow semantic configuration.",
        severity: "error",
      });
    }
    if (
      input.memory.policy.sessionOnlyTypes
      && input.memory.policy.writableTypes
      && input.memory.policy.sessionOnlyTypes.some((memoryType) => !input.memory.policy.writableTypes?.includes(memoryType))
    ) {
      issues.push({
        code: "memory-session-only-not-writable",
        path: "memory.policy.sessionOnlyTypes",
        message: "sessionOnlyTypes must be a subset of writableTypes.",
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
    if (input.planningStrategy.mode === "deterministic-linear" && !input.planningStrategy.strategyId.toLowerCase().includes("deterministic")) {
      issues.push({
        code: "strategy-id-mode-mismatch",
        path: "planningStrategy.strategyId",
        message: "deterministic-linear mode should use a deterministic strategy id.",
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

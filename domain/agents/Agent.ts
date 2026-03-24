import type { AgentGoal } from "./AgentGoal";
import { normalizeAgentGoal } from "./AgentGoal";
import type { AgentPolicy } from "./AgentPolicy";
import { normalizeAgentPolicy } from "./AgentPolicy";
import type { AgentMemoryConfiguration } from "./AgentMemory";
import { normalizeAgentMemoryConfiguration } from "./AgentMemory";

export type AgentLifecycleStatus = "draft" | "ready" | "paused" | "archived";

export interface AgentPlanningStrategy {
  readonly strategyId: string;
  readonly mode: "deterministic-linear" | "workflow-guided";
}

export interface AgentExecutionConfiguration {
  readonly maxExecutionSteps?: number;
  readonly defaultExecutionTimeoutMs?: number;
  readonly requireTrustedTools: boolean;
  readonly trustPolicyId?: string;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: AgentMemoryConfiguration;
  readonly execution: AgentExecutionConfiguration;
  readonly status: AgentLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AgentReadModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: AgentLifecycleStatus;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: {
    readonly revision: number;
    readonly retrievalStrategy: AgentMemoryConfiguration["retrieval"]["strategy"];
    readonly maxEntries: number;
    readonly assetIds: ReadonlyArray<string>;
  };
  readonly execution: AgentExecutionConfiguration;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeExecutionConfiguration(input: AgentExecutionConfiguration | undefined): AgentExecutionConfiguration {
  const maxExecutionSteps = input?.maxExecutionSteps;
  if (maxExecutionSteps !== undefined && (!Number.isInteger(maxExecutionSteps) || maxExecutionSteps <= 0)) {
    throw new Error("Agent execution maxExecutionSteps must be a positive integer when provided.");
  }

  const timeout = input?.defaultExecutionTimeoutMs;
  if (timeout !== undefined && (!Number.isInteger(timeout) || timeout <= 0)) {
    throw new Error("Agent execution defaultExecutionTimeoutMs must be a positive integer when provided.");
  }

  return Object.freeze({
    maxExecutionSteps,
    defaultExecutionTimeoutMs: timeout,
    requireTrustedTools: input?.requireTrustedTools ?? true,
    trustPolicyId: input?.trustPolicyId?.trim() || undefined,
  });
}

function normalizePlanningStrategy(input: AgentPlanningStrategy): AgentPlanningStrategy {
  return Object.freeze({
    strategyId: normalizeRequired(input.strategyId, "Agent planning strategy id"),
    mode: input.mode,
  });
}

export function createAgent(input: {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: AgentMemoryConfiguration;
  readonly execution?: AgentExecutionConfiguration;
  readonly status?: AgentLifecycleStatus;
  readonly now?: Date;
}): Agent {
  const id = normalizeRequired(input.id, "Agent id");
  const name = normalizeRequired(input.name, "Agent name");
  const goals = Object.freeze((input.goals ?? []).map((goal) => normalizeAgentGoal(goal)));
  if (goals.length === 0) {
    throw new Error("Agent requires at least one goal.");
  }

  const policy = normalizeAgentPolicy(input.policy);
  for (const goal of goals) {
    for (const toolId of goal.requiredToolIds ?? []) {
      if (!policy.allowedTools.includes(toolId)) {
        throw new Error(`Agent goal '${goal.id}' requires tool '${toolId}' that is not allowed by policy.`);
      }
    }
  }

  const memory = normalizeAgentMemoryConfiguration(input.memory);
  if (memory.agentId !== id) {
    throw new Error("Agent memory configuration agentId must match agent id.");
  }

  const planningStrategy = normalizePlanningStrategy(input.planningStrategy);
  const execution = normalizeExecutionConfiguration(input.execution);
  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    name,
    description: input.description?.trim() || undefined,
    goals,
    policy,
    planningStrategy,
    memory,
    execution,
    status: input.status ?? "ready",
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAgent(agent: Agent, changes: {
  readonly name?: string;
  readonly description?: string;
  readonly goals?: ReadonlyArray<AgentGoal>;
  readonly policy?: AgentPolicy;
  readonly planningStrategy?: AgentPlanningStrategy;
  readonly memory?: AgentMemoryConfiguration;
  readonly execution?: AgentExecutionConfiguration;
  readonly status?: AgentLifecycleStatus;
  readonly now?: Date;
}): Agent {
  const updated = createAgent({
    id: agent.id,
    name: changes.name ?? agent.name,
    description: changes.description ?? agent.description,
    goals: changes.goals ?? agent.goals,
    policy: changes.policy ?? agent.policy,
    planningStrategy: changes.planningStrategy ?? agent.planningStrategy,
    memory: changes.memory ?? agent.memory,
    execution: changes.execution ?? agent.execution,
    status: changes.status ?? agent.status,
    now: changes.now,
  });

  return Object.freeze({
    ...updated,
    createdAt: agent.createdAt,
    updatedAt: (changes.now ?? new Date()).toISOString(),
  });
}

export function toAgentReadModel(agent: Agent): AgentReadModel {
  return Object.freeze({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    goals: Object.freeze([...agent.goals].sort((left, right) => left.priorityOrder - right.priorityOrder)),
    policy: agent.policy,
    planningStrategy: agent.planningStrategy,
    memory: Object.freeze({
      revision: agent.memory.revision,
      retrievalStrategy: agent.memory.retrieval.strategy,
      maxEntries: agent.memory.retrieval.maxEntries,
      assetIds: Object.freeze(agent.memory.assets.map((entry) => entry.assetId.toString())),
    }),
    execution: agent.execution,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

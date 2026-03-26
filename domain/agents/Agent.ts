import type { AgentGoal } from "./AgentGoal";
import { normalizeAgentGoal } from "./AgentGoal";
import type { AgentPolicy } from "./AgentPolicy";
import { normalizeAgentPolicy } from "./AgentPolicy";
import type { AgentToolAccessPolicy } from "./AgentPolicy";
import type { AgentMemoryConfiguration } from "./AgentMemory";
import { normalizeAgentMemoryConfiguration } from "./AgentMemory";

export const AgentLifecycleStatuses = Object.freeze({
  draft: "draft",
  ready: "ready",
  paused: "paused",
  archived: "archived",
});

export type AgentLifecycleStatus = typeof AgentLifecycleStatuses[keyof typeof AgentLifecycleStatuses];

export const AgentPlanningStrategyModes = Object.freeze({
  deterministicLinear: "deterministic-linear",
});

export type AgentPlanningStrategyMode = typeof AgentPlanningStrategyModes[keyof typeof AgentPlanningStrategyModes];

export interface AgentPlanningStrategy {
  readonly strategyId: string;
  readonly mode: AgentPlanningStrategyMode;
}

export interface AgentExecutionConfiguration {
  readonly maxExecutionUnits?: number;
  readonly maxRunDurationMs?: number;
  readonly requireTrustedTools: boolean;
  readonly trustPolicyId?: string;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly toolAccess: AgentToolAccessPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: AgentMemoryConfiguration;
  readonly execution: AgentExecutionConfiguration;
  readonly status: AgentLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const SupportedAgentPlanningStrategies = Object.freeze([
  Object.freeze({
    strategyId: "deterministic",
    mode: AgentPlanningStrategyModes.deterministicLinear,
  }),
]);

export interface AgentReadModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: AgentLifecycleStatus;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly toolAccess: AgentToolAccessPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: {
    readonly revision: number;
    readonly assets: ReadonlyArray<{
      readonly assetId: string;
      readonly assetVersionId?: string;
      readonly memoryType: string;
      readonly lineageTag?: string;
    }>;
    readonly retrieval: AgentMemoryConfiguration["retrieval"];
    readonly policy: {
      readonly maxRetrievalEntries?: number;
      readonly retrievableTypes: ReadonlyArray<string>;
      readonly writableTypes: ReadonlyArray<string>;
      readonly sessionOnlyTypes: ReadonlyArray<string>;
      readonly retentionMode: string;
      readonly maxDurableEntries?: number;
    };
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
  if (!input) {
    throw new Error("Agent execution configuration is required.");
  }

  const maxExecutionUnits = input.maxExecutionUnits;
  if (maxExecutionUnits !== undefined && (!Number.isInteger(maxExecutionUnits) || maxExecutionUnits <= 0)) {
    throw new Error("Agent execution maxExecutionUnits must be a positive integer when provided.");
  }

  const timeout = input.maxRunDurationMs;
  if (timeout !== undefined && (!Number.isInteger(timeout) || timeout <= 0)) {
    throw new Error("Agent execution maxRunDurationMs must be a positive integer when provided.");
  }

  if (!input.requireTrustedTools && !input.trustPolicyId?.trim()) {
    throw new Error("Agent execution trustPolicyId is required when requireTrustedTools is false.");
  }

  return Object.freeze({
    maxExecutionUnits,
    maxRunDurationMs: timeout,
    requireTrustedTools: input.requireTrustedTools,
    trustPolicyId: input.trustPolicyId?.trim() || undefined,
  });
}

function normalizePlanningStrategy(input: AgentPlanningStrategy): AgentPlanningStrategy {
  if (!Object.values(AgentPlanningStrategyModes).includes(input.mode)) {
    throw new Error("Agent planning strategy mode must be deterministic-linear.");
  }

  const strategyId = normalizeRequired(input.strategyId, "Agent planning strategy id").toLowerCase();
  const supported = SupportedAgentPlanningStrategies
    .some((entry) => entry.strategyId === strategyId && entry.mode === input.mode);
  if (!supported) {
    const supportedLabel = SupportedAgentPlanningStrategies
      .map((entry) => `${entry.strategyId}@${entry.mode}`)
      .join(", ");
    throw new Error(`Unsupported agent planning strategy '${strategyId}@${input.mode}'. Supported strategies: ${supportedLabel}.`);
  }

  return Object.freeze({
    strategyId,
    mode: input.mode,
  });
}

function validateGoalPriorityOrdering(goals: ReadonlyArray<AgentGoal>): void {
  const priorityOrders = goals.map((goal) => goal.priorityOrder);
  if (new Set(priorityOrders).size !== priorityOrders.length) {
    throw new Error("Agent goals must use unique priorityOrder values.");
  }

  const sorted = [...priorityOrders].sort((left, right) => left - right);
  const contiguous = sorted.every((value, index) => value === index + 1);
  if (!contiguous) {
    throw new Error("Agent goals priorityOrder values must be contiguous and start at 1.");
  }
}

export function createAgent(input: {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly memory: AgentMemoryConfiguration;
  readonly execution: AgentExecutionConfiguration;
  readonly status?: AgentLifecycleStatus;
  readonly now?: Date;
}): Agent {
  const id = normalizeRequired(input.id, "Agent id");
  const name = normalizeRequired(input.name, "Agent name");
  const goals = Object.freeze((input.goals ?? []).map((goal) => normalizeAgentGoal(goal)));
  if (goals.length === 0) {
    throw new Error("Agent requires at least one goal.");
  }

  const goalIds = new Set(goals.map((goal) => goal.id));
  if (goalIds.size !== goals.length) {
    throw new Error("Agent goals must use unique ids.");
  }
  validateGoalPriorityOrdering(goals);

  const policy = normalizeAgentPolicy(input.policy);
  for (const goal of goals) {
    for (const toolId of goal.requiredToolIds ?? []) {
      if (!policy.toolAccess.allowedToolIds.includes(toolId)) {
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
  if (
    execution.maxExecutionUnits !== undefined
    && policy.executionLimits.maxSteps !== undefined
    && execution.maxExecutionUnits > policy.executionLimits.maxSteps
  ) {
    throw new Error("Agent execution maxExecutionUnits cannot exceed policy execution maxSteps.");
  }

  const status = input.status ?? AgentLifecycleStatuses.ready;
  if (!Object.values(AgentLifecycleStatuses).includes(status)) {
    throw new Error("Agent lifecycle status must be draft, ready, paused, or archived.");
  }

  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    name,
    description: input.description?.trim() || undefined,
    goals,
    policy,
    toolAccess: policy.toolAccess,
    planningStrategy,
    memory,
    execution,
    status,
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
    toolAccess: agent.toolAccess,
    planningStrategy: agent.planningStrategy,
    memory: Object.freeze({
      revision: agent.memory.revision,
      assets: Object.freeze(agent.memory.assets.map((entry) => Object.freeze({
        assetId: entry.assetId.toString(),
        assetVersionId: entry.assetVersionId,
        memoryType: entry.memoryType,
        lineageTag: entry.lineageTag,
      }))),
      retrieval: agent.memory.retrieval,
      policy: Object.freeze({
        maxRetrievalEntries: agent.memory.policy.maxRetrievalEntries,
        retrievableTypes: Object.freeze([...(agent.memory.policy.retrievableTypes ?? [])]),
        writableTypes: Object.freeze([...(agent.memory.policy.writableTypes ?? [])]),
        sessionOnlyTypes: Object.freeze([...(agent.memory.policy.sessionOnlyTypes ?? [])]),
        retentionMode: agent.memory.policy.retention.mode,
        maxDurableEntries: agent.memory.policy.retention.maxDurableEntries,
      }),
    }),
    execution: agent.execution,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

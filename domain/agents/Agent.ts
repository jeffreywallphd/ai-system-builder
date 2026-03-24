export type AgentLifecycleStatus = "draft" | "ready" | "paused" | "archived";

export interface AgentGoal {
  readonly goalId: string;
  readonly title: string;
  readonly successCriteria: ReadonlyArray<string>;
  readonly priority?: number;
  readonly requiredToolIds?: ReadonlyArray<string>;
}

export interface AgentToolReference {
  readonly toolId: string;
}

export interface AgentMemoryConfig {
  readonly memoryAssetIds: ReadonlyArray<string>;
  readonly retrieval?: {
    readonly maxEntries?: number;
    readonly tags?: ReadonlyArray<string>;
  };
}

export interface AgentPlanningStrategyReference {
  readonly strategyId: string;
  readonly mode: "deterministic-linear" | "workflow-guided";
}

export interface AgentExecutionPolicy {
  readonly trustPolicyId?: string;
  readonly requireTrustedTools?: boolean;
  readonly maxExecutionSteps?: number;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly allowedTools: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig: AgentMemoryConfig;
  readonly planningStrategy: AgentPlanningStrategyReference;
  readonly executionPolicy: AgentExecutionPolicy;
  readonly status: AgentLifecycleStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AgentReadModel {
  readonly id: string;
  readonly name: string;
  readonly status: AgentLifecycleStatus;
  readonly goals: ReadonlyArray<{
    readonly goalId: string;
    readonly title: string;
    readonly priority: number;
    readonly requiredToolIds: ReadonlyArray<string>;
    readonly successCriteria: ReadonlyArray<string>;
  }>;
  readonly planningStrategy: AgentPlanningStrategyReference;
  readonly executionPolicy: AgentExecutionPolicy;
  readonly allowedToolIds: ReadonlyArray<string>;
  readonly memory: {
    readonly assetIds: ReadonlyArray<string>;
    readonly retrievalMaxEntries: number;
    readonly retrievalTags: ReadonlyArray<string>;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createAgent(input: {
  readonly id: string;
  readonly name: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly allowedTools: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig: AgentMemoryConfig;
  readonly planningStrategy: AgentPlanningStrategyReference;
  readonly executionPolicy?: AgentExecutionPolicy;
  readonly status?: AgentLifecycleStatus;
  readonly now?: Date;
}): Agent {
  const id = input.id.trim();
  const name = input.name.trim();
  if (!id) {
    throw new Error("Agent id is required.");
  }
  if (!name) {
    throw new Error("Agent name is required.");
  }

  const normalizedGoals = Object.freeze(input.goals.map((goal) => normalizeGoal(goal)));
  const normalizedTools = Object.freeze(input.allowedTools.map((tool) => normalizeToolReference(tool)));
  const allowedToolIds = new Set(normalizedTools.map((tool) => tool.toolId));
  validateGoalToolCoverage(normalizedGoals, allowedToolIds);

  const memoryConfig = normalizeMemoryConfig(input.memoryConfig);
  const planningStrategy = normalizePlanningStrategy(input.planningStrategy);
  const executionPolicy = normalizeExecutionPolicy(input.executionPolicy);
  const status = input.status ?? "ready";
  const now = (input.now ?? new Date()).toISOString();

  return Object.freeze({
    id,
    name,
    goals: normalizedGoals,
    allowedTools: normalizedTools,
    memoryConfig,
    planningStrategy,
    executionPolicy,
    status,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAgent(agent: Agent, changes: {
  readonly name?: string;
  readonly goals?: ReadonlyArray<AgentGoal>;
  readonly allowedTools?: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig?: AgentMemoryConfig;
  readonly planningStrategy?: AgentPlanningStrategyReference;
  readonly executionPolicy?: AgentExecutionPolicy;
  readonly status?: AgentLifecycleStatus;
  readonly now?: Date;
}): Agent {
  const goals = changes.goals ? Object.freeze(changes.goals.map((goal) => normalizeGoal(goal))) : agent.goals;
  const allowedTools = changes.allowedTools
    ? Object.freeze(changes.allowedTools.map((tool) => normalizeToolReference(tool)))
    : agent.allowedTools;

  validateGoalToolCoverage(goals, new Set(allowedTools.map((tool) => tool.toolId)));

  return Object.freeze({
    ...agent,
    name: changes.name !== undefined ? normalizeRequired(changes.name, "Agent name") : agent.name,
    goals,
    allowedTools,
    memoryConfig: changes.memoryConfig ? normalizeMemoryConfig(changes.memoryConfig) : agent.memoryConfig,
    planningStrategy: changes.planningStrategy
      ? normalizePlanningStrategy(changes.planningStrategy)
      : agent.planningStrategy,
    executionPolicy: changes.executionPolicy
      ? normalizeExecutionPolicy(changes.executionPolicy)
      : agent.executionPolicy,
    status: changes.status ?? agent.status,
    updatedAt: (changes.now ?? new Date()).toISOString(),
  });
}

export function toAgentReadModel(agent: Agent): AgentReadModel {
  return Object.freeze({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    goals: Object.freeze(agent.goals
      .map((goal) => Object.freeze({
        goalId: goal.goalId,
        title: goal.title,
        priority: goal.priority ?? 100,
        requiredToolIds: Object.freeze([...(goal.requiredToolIds ?? [])]),
        successCriteria: Object.freeze([...goal.successCriteria]),
      }))
      .sort((left, right) => left.priority - right.priority)),
    planningStrategy: Object.freeze({ ...agent.planningStrategy }),
    executionPolicy: Object.freeze({ ...agent.executionPolicy }),
    allowedToolIds: Object.freeze(agent.allowedTools.map((tool) => tool.toolId)),
    memory: Object.freeze({
      assetIds: Object.freeze([...agent.memoryConfig.memoryAssetIds]),
      retrievalMaxEntries: agent.memoryConfig.retrieval?.maxEntries ?? 10,
      retrievalTags: Object.freeze([...(agent.memoryConfig.retrieval?.tags ?? [])]),
    }),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
}

function normalizeGoal(goal: AgentGoal): AgentGoal {
  const goalId = normalizeRequired(goal.goalId, "Agent goal goalId");
  const title = normalizeRequired(goal.title, "Agent goal title");
  const successCriteria = Object.freeze(goal.successCriteria.map((entry) => entry.trim()).filter(Boolean));
  const requiredToolIds = Object.freeze((goal.requiredToolIds ?? []).map((entry) => entry.trim()).filter(Boolean));
  if (successCriteria.length === 0) {
    throw new Error("Agent goals require at least one success criterion.");
  }
  if (goal.priority !== undefined && (!Number.isFinite(goal.priority) || goal.priority < 0)) {
    throw new Error("Agent goals priority must be a non-negative finite number.");
  }
  return Object.freeze({ goalId, title, successCriteria, priority: goal.priority, requiredToolIds });
}

function normalizeToolReference(reference: AgentToolReference): AgentToolReference {
  const toolId = reference.toolId.trim();
  const parts = toolId.split(":");
  if (parts.length < 3 || parts[0] !== "mcp" || !parts[1] || !parts[2]) {
    throw new Error("Agent allowedTools must reference MCP tools using the mcp:<serverId>:<toolName> format.");
  }
  return Object.freeze({ toolId });
}

function normalizeMemoryConfig(config: AgentMemoryConfig): AgentMemoryConfig {
  const memoryAssetIds = Object.freeze(config.memoryAssetIds.map((entry) => entry.trim()).filter(Boolean));
  if (memoryAssetIds.length === 0) {
    throw new Error("Agent memoryConfig.memoryAssetIds must include at least one asset id.");
  }

  const maxEntries = config.retrieval?.maxEntries;
  if (maxEntries !== undefined && (!Number.isInteger(maxEntries) || maxEntries <= 0)) {
    throw new Error("Agent memory retrieval maxEntries must be a positive integer when provided.");
  }

  return Object.freeze({
    memoryAssetIds,
    retrieval: config.retrieval
      ? Object.freeze({
          maxEntries,
          tags: Object.freeze((config.retrieval.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        })
      : undefined,
  });
}

function normalizePlanningStrategy(strategy: AgentPlanningStrategyReference): AgentPlanningStrategyReference {
  return Object.freeze({
    strategyId: normalizeRequired(strategy.strategyId, "Agent planning strategy id"),
    mode: strategy.mode,
  });
}

function normalizeExecutionPolicy(policy: AgentExecutionPolicy | undefined): AgentExecutionPolicy {
  const maxExecutionSteps = policy?.maxExecutionSteps;
  if (maxExecutionSteps !== undefined && (!Number.isInteger(maxExecutionSteps) || maxExecutionSteps <= 0)) {
    throw new Error("Agent execution policy maxExecutionSteps must be a positive integer when provided.");
  }

  return Object.freeze({
    trustPolicyId: policy?.trustPolicyId?.trim() || undefined,
    requireTrustedTools: policy?.requireTrustedTools ?? true,
    maxExecutionSteps,
  });
}

function validateGoalToolCoverage(goals: ReadonlyArray<AgentGoal>, allowedToolIds: ReadonlySet<string>): void {
  if (goals.length === 0) {
    throw new Error("Agent requires at least one goal.");
  }
  if (allowedToolIds.size === 0) {
    throw new Error("Agent requires at least one allowed MCP tool.");
  }

  for (const goal of goals) {
    for (const requiredToolId of goal.requiredToolIds ?? []) {
      if (!allowedToolIds.has(requiredToolId)) {
        throw new Error(`Agent goal '${goal.goalId}' requires tool '${requiredToolId}' that is not in allowedTools.`);
      }
    }
  }
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

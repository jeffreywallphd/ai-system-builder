export interface AgentGoal {
  readonly goalId: string;
  readonly title: string;
  readonly successCriteria: ReadonlyArray<string>;
  readonly priority?: number;
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

export interface Agent {
  readonly id: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly allowedTools: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig: AgentMemoryConfig;
  readonly planningStrategy: AgentPlanningStrategyReference;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createAgent(input: {
  readonly id: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly allowedTools: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig: AgentMemoryConfig;
  readonly planningStrategy: AgentPlanningStrategyReference;
  readonly now?: Date;
}): Agent {
  const id = input.id.trim();
  if (!id) {
    throw new Error("Agent id is required.");
  }
  if (input.goals.length === 0) {
    throw new Error("Agent requires at least one goal.");
  }

  const now = (input.now ?? new Date()).toISOString();
  const normalizedGoals = Object.freeze(input.goals.map((goal) => normalizeGoal(goal)));
  const normalizedTools = Object.freeze(input.allowedTools.map((tool) => normalizeToolReference(tool)));
  const memoryConfig = normalizeMemoryConfig(input.memoryConfig);

  return Object.freeze({
    id,
    goals: normalizedGoals,
    allowedTools: normalizedTools,
    memoryConfig,
    planningStrategy: Object.freeze({ ...input.planningStrategy, strategyId: input.planningStrategy.strategyId.trim() }),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateAgent(agent: Agent, changes: {
  readonly goals?: ReadonlyArray<AgentGoal>;
  readonly allowedTools?: ReadonlyArray<AgentToolReference>;
  readonly memoryConfig?: AgentMemoryConfig;
  readonly planningStrategy?: AgentPlanningStrategyReference;
  readonly now?: Date;
}): Agent {
  return Object.freeze({
    ...agent,
    goals: changes.goals ? Object.freeze(changes.goals.map((goal) => normalizeGoal(goal))) : agent.goals,
    allowedTools: changes.allowedTools ? Object.freeze(changes.allowedTools.map((tool) => normalizeToolReference(tool))) : agent.allowedTools,
    memoryConfig: changes.memoryConfig ? normalizeMemoryConfig(changes.memoryConfig) : agent.memoryConfig,
    planningStrategy: changes.planningStrategy
      ? Object.freeze({ ...changes.planningStrategy, strategyId: changes.planningStrategy.strategyId.trim() })
      : agent.planningStrategy,
    updatedAt: (changes.now ?? new Date()).toISOString(),
  });
}

function normalizeGoal(goal: AgentGoal): AgentGoal {
  const goalId = goal.goalId.trim();
  const title = goal.title.trim();
  const successCriteria = Object.freeze(goal.successCriteria.map((entry) => entry.trim()).filter(Boolean));
  if (!goalId || !title || successCriteria.length === 0) {
    throw new Error("Agent goals require goalId, title, and success criteria.");
  }
  return Object.freeze({ goalId, title, successCriteria, priority: goal.priority });
}

function normalizeToolReference(reference: AgentToolReference): AgentToolReference {
  const toolId = reference.toolId.trim();
  if (!toolId.startsWith("mcp:")) {
    throw new Error("Agent allowedTools must reference MCP tools using the mcp:<serverId>:<toolName> format.");
  }
  return Object.freeze({ toolId });
}

function normalizeMemoryConfig(config: AgentMemoryConfig): AgentMemoryConfig {
  return Object.freeze({
    memoryAssetIds: Object.freeze(config.memoryAssetIds.map((entry) => entry.trim()).filter(Boolean)),
    retrieval: config.retrieval
      ? Object.freeze({
          maxEntries: config.retrieval.maxEntries,
          tags: Object.freeze((config.retrieval.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        })
      : undefined,
  });
}

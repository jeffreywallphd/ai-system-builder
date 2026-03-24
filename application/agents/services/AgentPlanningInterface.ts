import type { Agent } from "../../../domain/agents/Agent";
import type { AgentMemoryEntryReference, AgentMemoryStore } from "../../../domain/agents/AgentMemory";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";

export interface AgentPlanningStep {
  readonly stepId: string;
  readonly goalId: string;
  readonly toolId: string;
  readonly action: string;
  readonly memoryContext: ReadonlyArray<AgentMemoryEntryReference>;
}

export interface AgentExecutionPlan {
  readonly planId: string;
  readonly agentId: string;
  readonly strategyId: string;
  readonly steps: ReadonlyArray<AgentPlanningStep>;
}

export interface AgentPlanningInterface {
  plan(agent: Agent): Promise<AgentExecutionPlan>;
}

export class DeterministicAgentPlanningService implements AgentPlanningInterface {
  constructor(
    private readonly catalog: IToolCapabilityCatalog,
    private readonly memoryStore: AgentMemoryStore,
  ) {}

  public async plan(agent: Agent): Promise<AgentExecutionPlan> {
    const capabilities = await this.catalog.listCapabilities();
    const capabilityIds = new Set(capabilities.map((capability) => capability.id));
    const allowedTools = agent.toolAccess.allowedToolIds.filter((toolId) => capabilityIds.has(toolId));

    if (allowedTools.length === 0) {
      throw new Error(`Agent '${agent.id}' has no executable allowed tools in the current catalog.`);
    }

    const memoryEntries = await this.memoryStore.query(agent.id, {
      assetIds: agent.memory.assets.map((entry) => entry.assetId),
      memoryTypes: [...new Set(agent.memory.assets.map((entry) => entry.memoryType))],
      tags: agent.memory.retrieval.requiredTags,
      maxEntries: agent.memory.retrieval.maxEntries,
    });

    const maxSteps = agent.execution.maxExecutionUnits ?? agent.policy.executionLimits.maxSteps ?? agent.goals.length;
    const prioritizedGoals = [...agent.goals]
      .sort((left, right) => left.priorityOrder - right.priorityOrder)
      .slice(0, maxSteps);

    const steps = prioritizedGoals.map((goal, index) => {
      const goalTool = goal.requiredToolIds?.find((candidate) => allowedTools.includes(candidate));
      const toolId = goalTool ?? allowedTools[index % allowedTools.length];
      if (!toolId) {
        throw new Error(`Agent planning could not resolve a tool for goal '${goal.id}'.`);
      }
      return Object.freeze({
        stepId: `plan:${agent.id}:${goal.id}:${index + 1}`,
        goalId: goal.id,
        toolId,
        action: goal.objective,
        memoryContext: Object.freeze(memoryEntries),
      });
    });

    return Object.freeze({
      planId: `agent-plan:${agent.id}:${Date.now()}`,
      agentId: agent.id,
      strategyId: agent.planningStrategy.strategyId,
      steps: Object.freeze(steps),
    });
  }
}

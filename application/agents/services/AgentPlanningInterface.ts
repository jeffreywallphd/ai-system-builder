import type { Agent } from "../../../domain/agents/Agent";
import { createAgentPlan, type AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryEntryReference, AgentMemoryStore } from "../../../domain/agents/AgentMemory";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";

export interface PlanningStrategyRequest {
  readonly agent: Agent;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface PlanningStrategy {
  plan(request: PlanningStrategyRequest): Promise<AgentPlan>;
}

export type AgentPlanningInterface = PlanningStrategy;

function buildStepId(agentId: string, goalId: string, index: number): string {
  return `plan:${agentId}:${goalId}:${index + 1}`;
}

function toIntentMemoryReferences(memoryEntries: ReadonlyArray<AgentMemoryEntryReference>): ReadonlyArray<AgentMemoryEntryReference> {
  return Object.freeze(memoryEntries.map((entry) => Object.freeze({ ...entry })));
}

export class DeterministicAgentPlanningService implements PlanningStrategy {
  constructor(
    private readonly catalog: IToolCapabilityCatalog,
    private readonly memoryStore: AgentMemoryStore,
  ) {}

  public async plan(request: PlanningStrategyRequest): Promise<AgentPlan> {
    const { agent } = request;
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

    const memoryContext = toIntentMemoryReferences(memoryEntries);

    return createAgentPlan({
      planId: `agent-plan:${agent.id}:${Date.now()}`,
      agentId: agent.id,
      strategyId: agent.planningStrategy.strategyId,
      steps: prioritizedGoals.map((goal, index) => {
        const goalTool = goal.requiredToolIds?.find((candidate) => allowedTools.includes(candidate));
        const toolId = goalTool ?? allowedTools[index % allowedTools.length];
        if (!toolId) {
          throw new Error(`Agent planning could not resolve a tool for goal '${goal.id}'.`);
        }

        return Object.freeze({
          stepId: buildStepId(agent.id, goal.id, index),
          goalId: goal.id,
          toolId,
          dependsOnStepIds: Object.freeze(index === 0 ? [] : [buildStepId(agent.id, prioritizedGoals[index - 1]!.id, index - 1)]),
          intent: Object.freeze({
            action: goal.objective,
            expectedOutputKey: `goal.${goal.id}.result`,
            inputReferences: Object.freeze(
              memoryContext.map((entry) => Object.freeze({
                kind: "asset" as const,
                assetId: entry.assetId,
              })),
            ),
          }),
          metadata: Object.freeze({
            memoryContext,
          }),
        });
      }),
      metadata: request.context ? Object.freeze({ ...request.context }) : undefined,
    });
  }
}

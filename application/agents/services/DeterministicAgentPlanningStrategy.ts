import { createAgentPlan, type AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryEntryReference, AgentMemoryStore } from "../../../domain/agents/AgentMemory";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type {
  AgentPlanToolSelectionService,
  AgentPlanningStrategy,
  AgentPlanningStrategyRequest,
} from "../contracts/AgentPlanningStrategy";
import type { AgentMcpToolGovernanceService } from "./AgentMcpToolGovernanceService";
import { DefaultAgentPlanToolSelectionService } from "./AgentPlanToolSelectionService";

function buildStepId(agentId: string, goalId: string, index: number): string {
  return `plan:${agentId}:${goalId}:${index + 1}`;
}

function toIntentMemoryReferences(memoryEntries: ReadonlyArray<AgentMemoryEntryReference>): ReadonlyArray<AgentMemoryEntryReference> {
  return Object.freeze(memoryEntries.map((entry) => Object.freeze({ ...entry })));
}

export class DeterministicAgentPlanningStrategy implements AgentPlanningStrategy {
  public readonly descriptor = Object.freeze({
    id: "deterministic",
    mode: "deterministic-linear",
    label: "Deterministic Linear",
  });

  constructor(
    private readonly catalog: IToolCapabilityCatalog,
    private readonly memoryStore: AgentMemoryStore,
    private readonly governanceService?: AgentMcpToolGovernanceService,
    private readonly toolSelectionService: AgentPlanToolSelectionService = new DefaultAgentPlanToolSelectionService(
      catalog,
      governanceService,
    ),
  ) {}

  public async plan(request: AgentPlanningStrategyRequest): Promise<AgentPlan> {
    const { agent } = request;
    if (agent.planningStrategy.mode !== this.descriptor.mode || agent.planningStrategy.strategyId !== this.descriptor.id) {
      throw new Error(
        `Agent planning strategy '${agent.planningStrategy.strategyId}@${agent.planningStrategy.mode}' is not supported by deterministic planner '${this.descriptor.id}@${this.descriptor.mode}'.`,
      );
    }

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

    const steps = [];
    for (let index = 0; index < prioritizedGoals.length; index += 1) {
      const goal = prioritizedGoals[index]!;
      const outputKey = `goal.${goal.id}.result`;
      const candidates = (goal.requiredToolIds && goal.requiredToolIds.length > 0)
        ? goal.requiredToolIds
        : allowedTools;
      const selection = await this.toolSelectionService.selectToolForGoal({
        agent,
        goal,
        candidateToolIds: candidates,
        action: goal.objective,
        expectedOutputKey: outputKey,
      });
      const toolId = selection.selectedToolId;
      if (!toolId) {
        const messages = selection.issues.map((issue) => issue.message).join("; ");
        throw new Error(`Agent planning could not resolve a compatible tool for goal '${goal.id}': ${messages || "no tool selected"}`);
      }

      steps.push(Object.freeze({
        stepId: buildStepId(agent.id, goal.id, index),
        goalId: goal.id,
        toolId,
        dependsOnStepIds: Object.freeze(index === 0 ? [] : [buildStepId(agent.id, prioritizedGoals[index - 1]!.id, index - 1)]),
        intent: Object.freeze({
          action: goal.objective,
          expectedOutputKey: outputKey,
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
      }));
    }

    const plan = createAgentPlan({
      planId: `agent-plan:${agent.id}:${Date.now()}`,
      agentId: agent.id,
      strategyId: agent.planningStrategy.strategyId,
      steps,
      metadata: request.context ? Object.freeze({ ...request.context }) : undefined,
    });

    if (this.governanceService) {
      const governance = await this.governanceService.validatePlan(agent, plan);
      if (!governance.allowed) {
        const firstIssue = governance.issues[0];
        throw new Error(`Agent plan references ineligible MCP tool usage: ${firstIssue?.message ?? "validation failed"}`);
      }
    }

    return plan;
  }
}

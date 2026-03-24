import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { Agent } from "../../../domain/agents/Agent";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";

export interface AgentExecutionGraph {
  readonly agentId: string;
  readonly steps: ReadonlyArray<{
    readonly stepId: string;
    readonly goalId: string;
    readonly toolId?: string;
  }>;
}

export class AgentExecutionService {
  constructor(private readonly executeAgentToolsUseCase: ExecuteAgentToolsUseCase) {}

  public buildExecutionGraph(agent: Agent): AgentExecutionGraph {
    return Object.freeze({
      agentId: agent.id,
      steps: Object.freeze(agent.goals.map((goal, index) => Object.freeze({
        stepId: `agent-step-${index + 1}`,
        goalId: goal.goalId,
        toolId: agent.allowedTools[index]?.toolId ?? agent.allowedTools[0]?.toolId,
      }))),
    });
  }

  public async execute(agent: Agent): Promise<AgentExecutionResult> {
    const linearPrompt = agent.goals.map((goal) => goal.title).join(" and then ");
    return this.executeAgentToolsUseCase.execute({
      input: linearPrompt,
      executionId: `agent:${agent.id}`,
      maxIterations: Math.max(1, agent.goals.length),
      toolSelection: {
        mode: "capabilityIds",
        capabilityIds: agent.allowedTools.map((tool) => tool.toolId),
      },
      metadata: Object.freeze({
        origin: "agent-execution-service",
        agentId: agent.id,
        memoryAssetIds: agent.memoryConfig.memoryAssetIds,
      }),
    });
  }
}

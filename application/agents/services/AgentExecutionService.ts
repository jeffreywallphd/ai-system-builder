import type { AgentMemoryStore } from "../../../domain/agents/AgentMemory";
import type { Agent } from "../../../domain/agents/Agent";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";
import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { AgentExecutionPlan, AgentPlanningInterface } from "./AgentPlanningInterface";

export interface AgentExecutionStepOutcome {
  readonly stepId: string;
  readonly goalId: string;
  readonly toolId: string;
  readonly action: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly output?: string;
  readonly errorMessage?: string;
}

export interface AgentExecutionReadModel {
  readonly agentId: string;
  readonly executionId: string;
  readonly planId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly outcomes: ReadonlyArray<AgentExecutionStepOutcome>;
  readonly finalOutput?: string;
}

export class AgentExecutionService {
  constructor(
    private readonly planner: AgentPlanningInterface,
    private readonly executeAgentToolsUseCase: ExecuteAgentToolsUseCase,
    private readonly memoryStore: AgentMemoryStore,
  ) {}

  public async buildExecutionGraph(agent: Agent): Promise<AgentExecutionPlan> {
    return this.planner.plan(agent);
  }

  public async execute(agent: Agent): Promise<AgentExecutionReadModel> {
    const plan = await this.planner.plan(agent);
    const outcomes: AgentExecutionStepOutcome[] = [];
    let finalStatus: AgentExecutionReadModel["status"] = "completed";
    let finalOutput = "";

    for (const step of plan.steps) {
      const stepResult: AgentExecutionResult = await this.executeAgentToolsUseCase.execute({
        input: step.action,
        executionId: `agent:${agent.id}:${step.stepId}`,
        maxIterations: 1,
        toolSelection: {
          mode: "capabilityIds",
          capabilityIds: [step.toolId],
        },
        metadata: Object.freeze({
          origin: "agent-execution-service",
          agentId: agent.id,
          planId: plan.planId,
          stepId: step.stepId,
          memoryAssetIds: agent.memory.assets.map((entry) => entry.assetId.toString()),
        }),
      });

      const stepOutput = stepResult.finalOutput ?? stepResult.steps[0]?.resultText;
      outcomes.push(Object.freeze({
        stepId: step.stepId,
        goalId: step.goalId,
        toolId: step.toolId,
        action: step.action,
        status: stepResult.status,
        output: stepOutput,
        errorMessage: stepResult.errorMessage,
      }));
      finalOutput = [finalOutput, stepOutput].filter(Boolean).join("\n");

      if (stepResult.status !== "completed") {
        finalStatus = stepResult.status;
        break;
      }
    }

    await this.persistExecutionMemory(agent, plan, outcomes, finalStatus, finalOutput || undefined);

    return Object.freeze({
      agentId: agent.id,
      executionId: `agent:${agent.id}:${plan.planId}`,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes),
      finalOutput: finalOutput || undefined,
    });
  }

  private async persistExecutionMemory(
    agent: Agent,
    plan: AgentExecutionPlan,
    outcomes: ReadonlyArray<AgentExecutionStepOutcome>,
    status: AgentExecutionReadModel["status"],
    finalOutput?: string,
  ): Promise<void> {
    const memoryAssetId = agent.memory.assets[0]?.assetId.toString();
    if (!memoryAssetId) {
      return;
    }

    await this.memoryStore.add(agent.id, {
      assetId: memoryAssetId,
      tags: ["agent-execution", status],
      metadata: {
        planId: plan.planId,
        strategyId: plan.strategyId,
        status,
        outcomes,
        finalOutput,
      },
    });
  }
}

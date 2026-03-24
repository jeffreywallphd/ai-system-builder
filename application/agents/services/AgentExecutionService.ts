import type { Agent } from "../../../domain/agents/Agent";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";
import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { AgentPlanningInterface } from "../contracts/AgentPlanningStrategy";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryRetrievalService } from "../contracts/AgentMemoryRetrieval";
import { AgentWorkingMemoryService } from "./AgentWorkingMemoryService";
import { AgentMemoryWriteService, type AgentMemoryWriteResult } from "./AgentMemoryWriteService";
import type { AgentWorkingMemory } from "../../../domain/agents/AgentWorkingMemory";
import { AssetId } from "../../../domain/assets/AssetId";

export interface AgentExecutionStepOutcome {
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly action: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly output?: string;
  readonly outputAssetId?: AssetId;
  readonly errorMessage?: string;
}

export interface AgentExecutionReadModel {
  readonly agentId: string;
  readonly executionId: string;
  readonly planId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly outcomes: ReadonlyArray<AgentExecutionStepOutcome>;
  readonly finalOutput?: string;
  readonly workingMemory: AgentWorkingMemory;
  readonly memoryWrite: AgentMemoryWriteResult;
}

export class AgentExecutionService {
  constructor(
    private readonly planner: AgentPlanningInterface,
    private readonly executeAgentToolsUseCase: ExecuteAgentToolsUseCase,
    private readonly memoryRetrievalService: AgentMemoryRetrievalService,
    private readonly memoryWriteService: AgentMemoryWriteService,
    private readonly workingMemoryService: AgentWorkingMemoryService = new AgentWorkingMemoryService(),
  ) {}

  public async buildExecutionGraph(agent: Agent): Promise<AgentPlan> {
    return this.planner.plan({ agent });
  }

  public async execute(agent: Agent): Promise<AgentExecutionReadModel> {
    const plan = await this.planner.plan({ agent });
    const retrievedMemory = await this.memoryRetrievalService.retrieveMemory({ agent });
    let workingMemory = this.workingMemoryService.createFromRetrievedMemory({
      sessionId: `agent-session:${agent.id}:${plan.planId}`,
      agent,
      plan,
      retrievedMemory,
    });
    const outcomes: AgentExecutionStepOutcome[] = [];
    let finalStatus: AgentExecutionReadModel["status"] = "completed";
    let finalOutput = "";

    for (const step of plan.steps) {
      const stepResult: AgentExecutionResult = await this.executeAgentToolsUseCase.execute({
        input: step.intent.action,
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
          expectedOutputKey: step.intent.expectedOutputKey ?? null,
        }),
      });

      const stepOutput = stepResult.finalOutput ?? stepResult.steps[0]?.resultText;
      const outputAssetIdRaw = typeof stepResult.metadata?.outputAssetId === "string"
        ? stepResult.metadata.outputAssetId
        : undefined;
      const outputAssetId = outputAssetIdRaw ? AssetId.from(outputAssetIdRaw) : undefined;
      outcomes.push(Object.freeze({
        stepId: step.stepId,
        goalId: step.goalId,
        toolId: step.toolId,
        action: step.intent.action,
        status: stepResult.status,
        output: stepOutput,
        outputAssetId,
        errorMessage: stepResult.errorMessage,
      }));
      workingMemory = this.workingMemoryService.appendExecutionOutcome(workingMemory, {
        stepId: step.stepId,
        status: stepResult.status,
        output: stepOutput,
        outputAssetId,
        errorMessage: stepResult.errorMessage,
      });
      finalOutput = [finalOutput, stepOutput].filter(Boolean).join("\n");

      if (stepResult.status !== "completed") {
        finalStatus = stepResult.status;
        break;
      }
    }

    const memoryWrite = await this.memoryWriteService.writeExecutionOutcome(agent, plan, {
      agentId: agent.id,
      executionId: `agent:${agent.id}:${plan.planId}`,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes),
      finalOutput: finalOutput || undefined,
      workingMemory,
    });

    return Object.freeze({
      agentId: agent.id,
      executionId: `agent:${agent.id}:${plan.planId}`,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes),
      finalOutput: finalOutput || undefined,
      workingMemory,
      memoryWrite,
    } satisfies AgentExecutionReadModel);
  }
}

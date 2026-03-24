import type { Agent } from "../../../domain/agents/Agent";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";
import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { AgentPlanningInterface } from "../contracts/AgentPlanningStrategy";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryRetrievalService } from "../contracts/AgentMemoryRetrieval";
import { AgentWorkingMemoryService } from "./AgentWorkingMemoryService";
import { AgentMemoryWriteService } from "./AgentMemoryWriteService";

export interface AgentExecutionStepOutcome {
  readonly stepId: string;
  readonly goalId?: string;
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
      outcomes.push(Object.freeze({
        stepId: step.stepId,
        goalId: step.goalId,
        toolId: step.toolId,
        action: step.intent.action,
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

    const readModel = Object.freeze({
      agentId: agent.id,
      executionId: `agent:${agent.id}:${plan.planId}`,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes),
      finalOutput: finalOutput || undefined,
    } satisfies AgentExecutionReadModel);

    await this.memoryWriteService.writeExecutionOutcome(agent, plan, readModel);
    workingMemory = this.workingMemoryService.appendExecutionOutcome(workingMemory, readModel);
    void workingMemory;
    return readModel;
  }
}

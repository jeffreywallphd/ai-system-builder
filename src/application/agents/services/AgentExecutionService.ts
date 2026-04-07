import type { Agent } from "../../../domain/agents/Agent";
import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { AgentPlanningInterface } from "../contracts/AgentPlanningStrategy";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentMemoryRetrievalService } from "../contracts/AgentMemoryRetrieval";
import { AgentWorkingMemoryService } from "./AgentWorkingMemoryService";
import { AgentMemoryWriteService, type AgentMemoryWriteResult } from "./AgentMemoryWriteService";
import type { AgentWorkingMemory } from "../../../domain/agents/AgentWorkingMemory";
import { AssetId } from "../../../domain/assets/AssetId";
import type { AgentMcpToolGovernanceService } from "./AgentMcpToolGovernanceService";
import { AgentRunnerService } from "./AgentRunnerService";
import type { IAgentExecutionSessionRepository } from "../../ports/interfaces/IAgentExecutionSessionRepository";

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
  private readonly runner: AgentRunnerService;
  private readonly planner: AgentPlanningInterface;

  constructor(
    planner: AgentPlanningInterface,
    executeAgentToolsUseCase: ExecuteAgentToolsUseCase,
    memoryRetrievalService: AgentMemoryRetrievalService,
    memoryWriteService: AgentMemoryWriteService,
    workingMemoryService: AgentWorkingMemoryService = new AgentWorkingMemoryService(),
    governanceService?: AgentMcpToolGovernanceService,
    sessionRepository?: IAgentExecutionSessionRepository,
  ) {
    this.planner = planner;
    this.runner = new AgentRunnerService(
      planner,
      executeAgentToolsUseCase,
      memoryRetrievalService,
      memoryWriteService,
      workingMemoryService,
      governanceService,
      sessionRepository,
    );
  }

  public async buildExecutionGraph(agent: Agent): Promise<AgentPlan> {
    return this.planner.plan({ agent });
  }

  public async execute(agent: Agent): Promise<AgentExecutionReadModel> {
    const result = await this.runner.run({ agent });
    if (result.status === "blocked") {
      throw new Error(`Agent execution blocked: ${result.failure?.message ?? "governance decision denied execution."}`);
    }

    return Object.freeze({
      agentId: result.agentId,
      executionId: result.executionId,
      planId: result.planId,
      status: result.status,
      outcomes: Object.freeze(result.outcomes.map((outcome) => Object.freeze({
        stepId: outcome.stepId,
        goalId: outcome.goalId,
        toolId: outcome.toolId,
        action: outcome.action,
        status: outcome.status === "blocked" ? "failed" : outcome.status,
        output: outcome.output,
        outputAssetId: outcome.outputAssetId,
        errorMessage: outcome.errorMessage,
      }))),
      finalOutput: result.finalOutput,
      workingMemory: result.workingMemory,
      memoryWrite: result.memoryWrite,
    } satisfies AgentExecutionReadModel);
  }
}

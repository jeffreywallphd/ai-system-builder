import { createAgent, toAgentReadModel, type AgentExecutionConfiguration, type AgentPlanningStrategy, type AgentReadModel } from "@domain/agents/Agent";
import type { AgentGoal } from "@domain/agents/AgentGoal";
import type { AgentMemoryConfiguration } from "@domain/agents/AgentMemory";
import type { AgentPolicy } from "@domain/agents/AgentPolicy";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentConflictError, AgentInvalidRequestError } from "./AgentAuthoringErrors";
import { AgentConfigurationValidationService } from "./services/AgentConfigurationValidationService";

export interface CreateAgentRequest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly goals: ReadonlyArray<AgentGoal>;
  readonly policy: AgentPolicy;
  readonly memory: AgentMemoryConfiguration;
  readonly planningStrategy: AgentPlanningStrategy;
  readonly execution: AgentExecutionConfiguration;
}

export class CreateAgentUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(request: CreateAgentRequest): Promise<AgentReadModel> {
    const id = request.id.trim();
    if (!id) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const existing = await this.repository.get(id);
    if (existing) {
      throw new AgentConflictError(id);
    }
    this.validationService.assertValidForCreate({
      id,
      name: request.name,
      description: request.description,
      goals: request.goals,
      policy: request.policy,
      memory: request.memory,
      planningStrategy: request.planningStrategy,
      execution: request.execution,
    });
    const agent = createAgent(request);
    const saved = await this.repository.save(agent);
    return toAgentReadModel(saved);
  }
}


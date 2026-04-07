import { toAgentReadModel, updateAgent, type Agent, type AgentExecutionConfiguration, type AgentPlanningStrategy, type AgentReadModel } from "@domain/agents/Agent";
import type { AgentGoal } from "@domain/agents/AgentGoal";
import type { AgentMemoryConfiguration } from "@domain/agents/AgentMemory";
import type { AgentPolicy } from "@domain/agents/AgentPolicy";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError, AgentNotFoundError } from "./AgentAuthoringErrors";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export interface UpdateAgentRequest {
  readonly id: string;
  readonly changes: {
    readonly name?: string;
    readonly description?: string;
    readonly goals?: ReadonlyArray<AgentGoal>;
    readonly policy?: AgentPolicy;
    readonly memory?: AgentMemoryConfiguration;
    readonly planningStrategy?: AgentPlanningStrategy;
    readonly execution?: AgentExecutionConfiguration;
    readonly status?: Agent["status"];
  };
}

export class UpdateAgentUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(request: UpdateAgentRequest): Promise<AgentReadModel> {
    const id = request.id.trim();
    if (!id) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const current = await this.repository.get(id);
    if (!current) {
      throw new AgentNotFoundError(id);
    }
    const nextConfiguration = {
      ...toAgentConfigurationValidationInput(current),
      ...request.changes,
    };
    this.validationService.assertValidForUpdate(current.id, nextConfiguration);
    const updated = updateAgent(current, request.changes);
    const saved = await this.repository.save(updated);
    return toAgentReadModel(saved);
  }
}


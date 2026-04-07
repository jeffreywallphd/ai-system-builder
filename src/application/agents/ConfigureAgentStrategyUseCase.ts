import { toAgentReadModel, updateAgent, type AgentPlanningStrategy, type AgentReadModel } from "@domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError, AgentNotFoundError } from "./AgentAuthoringErrors";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export class ConfigureAgentStrategyUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(agentId: string, planningStrategy: AgentPlanningStrategy): Promise<AgentReadModel> {
    const normalized = agentId.trim();
    if (!normalized) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new AgentNotFoundError(normalized);
    }
    this.validationService.assertValidForUpdate(current.id, {
      ...toAgentConfigurationValidationInput(current),
      planningStrategy,
    });
    const saved = await this.repository.save(updateAgent(current, { planningStrategy }));
    return toAgentReadModel(saved);
  }
}


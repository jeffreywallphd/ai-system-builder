import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { AgentMemoryConfiguration } from "../../domain/agents/AgentMemory";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError, AgentNotFoundError } from "./AgentAuthoringErrors";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export class ConfigureAgentMemoryUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(agentId: string, memory: AgentMemoryConfiguration): Promise<AgentReadModel> {
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
      memory,
    });
    const saved = await this.repository.save(updateAgent(current, { memory }));
    return toAgentReadModel(saved);
  }
}

import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { AgentToolAccessPolicy } from "../../domain/agents/AgentPolicy";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export class ConfigureAgentToolsUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(agentId: string, toolAccess: AgentToolAccessPolicy): Promise<AgentReadModel> {
    const normalized = agentId.trim();
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new Error(`Agent '${normalized}' was not found.`);
    }
    const nextPolicy = Object.freeze({
      ...current.policy,
      toolAccess,
    });
    this.validationService.assertValid({
      ...toAgentConfigurationValidationInput(current),
      policy: nextPolicy,
    });
    const saved = await this.repository.save(updateAgent(current, { policy: nextPolicy }));
    return toAgentReadModel(saved);
  }
}

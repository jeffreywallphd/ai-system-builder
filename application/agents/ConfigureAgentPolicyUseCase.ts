import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { AgentPolicy } from "../../domain/agents/AgentPolicy";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import {
  AgentConfigurationValidationService,
  toAgentConfigurationValidationInput,
} from "./services/AgentConfigurationValidationService";

export class ConfigureAgentPolicyUseCase {
  constructor(
    private readonly repository: IAgentRepository,
    private readonly validationService: AgentConfigurationValidationService = new AgentConfigurationValidationService(),
  ) {}

  public async execute(agentId: string, policy: AgentPolicy): Promise<AgentReadModel> {
    const normalized = agentId.trim();
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new Error(`Agent '${normalized}' was not found.`);
    }
    this.validationService.assertValid({
      ...toAgentConfigurationValidationInput(current),
      policy,
    });
    const saved = await this.repository.save(updateAgent(current, { policy }));
    return toAgentReadModel(saved);
  }
}

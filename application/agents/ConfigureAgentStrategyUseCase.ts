import { toAgentReadModel, updateAgent, type AgentPlanningStrategy, type AgentReadModel } from "../../domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export class ConfigureAgentStrategyUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(agentId: string, planningStrategy: AgentPlanningStrategy): Promise<AgentReadModel> {
    const normalized = agentId.trim();
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new Error(`Agent '${normalized}' was not found.`);
    }
    const saved = await this.repository.save(updateAgent(current, { planningStrategy }));
    return toAgentReadModel(saved);
  }
}

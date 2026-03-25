import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { AgentMemoryConfiguration } from "../../domain/agents/AgentMemory";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export class ConfigureAgentMemoryUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(agentId: string, memory: AgentMemoryConfiguration): Promise<AgentReadModel> {
    const normalized = agentId.trim();
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new Error(`Agent '${normalized}' was not found.`);
    }
    const saved = await this.repository.save(updateAgent(current, { memory }));
    return toAgentReadModel(saved);
  }
}

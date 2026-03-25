import { toAgentReadModel, updateAgent, type AgentReadModel } from "../../domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export class ArchiveAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<AgentReadModel> {
    const normalized = id.trim();
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new Error(`Agent '${normalized}' was not found.`);
    }
    const archived = updateAgent(current, { status: "archived" });
    const saved = await this.repository.save(archived);
    return toAgentReadModel(saved);
  }
}

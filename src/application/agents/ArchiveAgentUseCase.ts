import { toAgentReadModel, updateAgent, type AgentReadModel } from "@domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError, AgentNotFoundError } from "./AgentAuthoringErrors";

export class ArchiveAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<AgentReadModel> {
    const normalized = id.trim();
    if (!normalized) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const current = await this.repository.get(normalized);
    if (!current) {
      throw new AgentNotFoundError(normalized);
    }
    const archived = updateAgent(current, { status: "archived" });
    const saved = await this.repository.save(archived);
    return toAgentReadModel(saved);
  }
}


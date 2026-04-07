import { toAgentReadModel, type AgentReadModel } from "../../domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError } from "./AgentAuthoringErrors";

export class GetAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<AgentReadModel | undefined> {
    const normalized = id.trim();
    if (!normalized) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    const agent = await this.repository.get(normalized);
    return agent ? toAgentReadModel(agent) : undefined;
  }
}

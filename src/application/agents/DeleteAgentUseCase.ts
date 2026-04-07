import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import { AgentInvalidRequestError } from "./AgentAuthoringErrors";

export class DeleteAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<boolean> {
    const normalized = id.trim();
    if (!normalized) {
      throw new AgentInvalidRequestError("Agent id is required.");
    }
    return this.repository.delete(normalized);
  }
}

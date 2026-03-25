import { toAgentReadModel, type AgentReadModel } from "../../domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export class GetAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<AgentReadModel | undefined> {
    const agent = await this.repository.get(id.trim());
    return agent ? toAgentReadModel(agent) : undefined;
  }
}

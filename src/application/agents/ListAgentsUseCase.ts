import { toAgentReadModel, type AgentReadModel } from "@domain/agents/Agent";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export interface ListAgentsRequest {
  readonly includeArchived?: boolean;
}

export class ListAgentsUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(request: ListAgentsRequest = {}): Promise<ReadonlyArray<AgentReadModel>> {
    const agents = await this.repository.list();
    const includeArchived = request.includeArchived ?? true;
    const filtered = includeArchived ? agents : agents.filter((agent) => agent.status !== "archived");
    return Object.freeze(filtered.map((agent) => toAgentReadModel(agent)));
  }
}


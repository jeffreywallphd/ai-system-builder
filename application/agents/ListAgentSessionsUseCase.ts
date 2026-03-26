import type { IAgentExecutionSessionRepository } from "../ports/interfaces/IAgentExecutionSessionRepository";
import type { AgentSessionSummaryReadModel } from "./contracts/AgentRunContracts";
import { toAgentSessionSummaryReadModel } from "./contracts/AgentRunContracts";
import { AgentRuntimeInvalidRequestError } from "./AgentRuntimeErrors";

export class ListAgentSessionsUseCase {
  constructor(private readonly sessionRepository: IAgentExecutionSessionRepository) {}

  public async execute(agentId: string): Promise<ReadonlyArray<AgentSessionSummaryReadModel>> {
    const normalized = agentId.trim();
    if (!normalized) {
      throw new AgentRuntimeInvalidRequestError("Agent id is required.");
    }

    const sessions = await this.sessionRepository.listByAgentId(normalized);
    return Object.freeze(sessions.map((session) => toAgentSessionSummaryReadModel(session)));
  }
}

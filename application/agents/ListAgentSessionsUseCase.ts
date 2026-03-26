import type { IAgentExecutionSessionRepository } from "../ports/interfaces/IAgentExecutionSessionRepository";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";
import type { AgentSessionSummaryReadModel } from "./contracts/AgentRunContracts";
import { toAgentSessionSummaryReadModel } from "./contracts/AgentRunContracts";
import { AgentRuntimeInvalidRequestError } from "./AgentRuntimeErrors";

export class ListAgentSessionsUseCase {
  constructor(
    private readonly sessionRepository: IAgentExecutionSessionRepository,
    private readonly taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
  ) {}

  public async execute(agentId: string): Promise<ReadonlyArray<AgentSessionSummaryReadModel>> {
    const normalized = agentId.trim();
    if (!normalized) {
      throw new AgentRuntimeInvalidRequestError("Agent id is required.");
    }

    const sessions = await this.sessionRepository.listByAgentId(normalized);
    const composition = Object.freeze({
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("execution-artifact"),
    });
    return Object.freeze(sessions.map((session) => toAgentSessionSummaryReadModel(session, composition)));
  }
}

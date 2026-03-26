import type { IAgentExecutionSessionRepository } from "../ports/interfaces/IAgentExecutionSessionRepository";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { toAgentSessionDetailReadModel, type AgentSessionDetailReadModel } from "./contracts/AgentRunContracts";
import { AgentRuntimeInvalidRequestError, AgentRuntimeNotFoundError } from "./AgentRuntimeErrors";

export class GetAgentSessionDetailUseCase {
  constructor(
    private readonly sessionRepository: IAgentExecutionSessionRepository,
    private readonly taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
    private readonly contractResolver: CompositionAssetContractResolver = new CompositionAssetContractResolver(),
  ) {}

  public async execute(sessionId: string): Promise<AgentSessionDetailReadModel> {
    const normalized = sessionId.trim();
    if (!normalized) {
      throw new AgentRuntimeInvalidRequestError("Session id is required.");
    }

    const session = await this.sessionRepository.getById(normalized);
    if (!session) {
      throw new AgentRuntimeNotFoundError("session", normalized);
    }

    const transitions = await this.sessionRepository.listTransitionHistory(normalized);
    return toAgentSessionDetailReadModel({
      session,
      transitions,
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("execution-artifact"),
      contract: await this.contractResolver.resolveAgentContractById(session.agentId),
    });
  }
}

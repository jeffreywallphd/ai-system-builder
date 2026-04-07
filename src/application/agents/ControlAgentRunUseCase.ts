import {
  AgentExecutionSessionStatuses,
  transitionAgentExecutionSession,
} from "../../domain/agents/AgentExecutionSession";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { IAgentExecutionSessionRepository } from "../ports/interfaces/IAgentExecutionSessionRepository";
import { CompositionTaxonomyClassifier } from "../taxonomy/CompositionTaxonomyClassifier";
import {
  AgentRunControlActions,
  toAgentSessionSummaryReadModel,
  type AgentRunControlRequest,
  type AgentSessionSummaryReadModel,
} from "./contracts/AgentRunContracts";
import {
  AgentRuntimeInvalidControlStateError,
  AgentRuntimeInvalidRequestError,
  AgentRuntimeNotFoundError,
  AgentRuntimeUnsupportedControlError,
} from "./AgentRuntimeErrors";

export class ControlAgentRunUseCase {
  constructor(
    private readonly sessionRepository: IAgentExecutionSessionRepository,
    private readonly taxonomyClassifier: CompositionTaxonomyClassifier = new CompositionTaxonomyClassifier(),
    private readonly contractResolver: CompositionAssetContractResolver = new CompositionAssetContractResolver(),
  ) {}

  public async execute(request: AgentRunControlRequest): Promise<AgentSessionSummaryReadModel> {
    const sessionId = request.sessionId.trim();
    if (!sessionId) {
      throw new AgentRuntimeInvalidRequestError("Session id is required.");
    }

    if (request.action !== AgentRunControlActions.cancel) {
      throw new AgentRuntimeUnsupportedControlError(request.action);
    }

    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new AgentRuntimeNotFoundError("session", sessionId);
    }
    if (
      session.status === AgentExecutionSessionStatuses.completed
      || session.status === AgentExecutionSessionStatuses.failed
      || session.status === AgentExecutionSessionStatuses.cancelled
    ) {
      throw new AgentRuntimeInvalidControlStateError(`Session '${session.id}' is already terminal (${session.status}).`);
    }

    const cancelled = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.cancelled });
    const saved = await this.sessionRepository.save(cancelled);
    return toAgentSessionSummaryReadModel(saved, Object.freeze({
      taxonomy: this.taxonomyClassifier.classifyCanonicalEntity("execution-artifact"),
      contract: await this.contractResolver.resolveAgentContractById(saved.agentId),
    }));
  }
}

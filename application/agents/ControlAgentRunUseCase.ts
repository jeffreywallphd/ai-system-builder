import {
  AgentExecutionSessionStatuses,
  transitionAgentExecutionSession,
} from "../../domain/agents/AgentExecutionSession";
import type { IAgentExecutionSessionRepository } from "../ports/interfaces/IAgentExecutionSessionRepository";
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
  constructor(private readonly sessionRepository: IAgentExecutionSessionRepository) {}

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
    if ([AgentExecutionSessionStatuses.completed, AgentExecutionSessionStatuses.failed, AgentExecutionSessionStatuses.cancelled].includes(session.status)) {
      throw new AgentRuntimeInvalidControlStateError(`Session '${session.id}' is already terminal (${session.status}).`);
    }

    const cancelled = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.cancelled });
    const saved = await this.sessionRepository.save(cancelled);
    return toAgentSessionSummaryReadModel(saved);
  }
}

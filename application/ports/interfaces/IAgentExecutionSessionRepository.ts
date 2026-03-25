import type { AgentExecutionSession } from "../../../domain/agents/AgentExecutionSession";

export interface IAgentExecutionSessionRepository {
  save(session: AgentExecutionSession): Promise<AgentExecutionSession>;
  getById(sessionId: string): Promise<AgentExecutionSession | undefined>;
  listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>>;
}

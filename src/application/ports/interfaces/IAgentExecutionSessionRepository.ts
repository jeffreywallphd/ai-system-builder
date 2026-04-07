import type { AgentExecutionSession } from "@domain/agents/AgentExecutionSession";
import type { AgentExecutionSessionStatus } from "@domain/agents/AgentExecutionSession";

export interface AgentExecutionSessionTransitionRecord {
  readonly status: AgentExecutionSessionStatus;
  readonly recordedAt: string;
}

export interface IAgentExecutionSessionRepository {
  save(session: AgentExecutionSession): Promise<AgentExecutionSession>;
  getById(sessionId: string): Promise<AgentExecutionSession | undefined>;
  listByAgentId(agentId: string): Promise<ReadonlyArray<AgentExecutionSession>>;
  listTransitionHistory(sessionId: string): Promise<ReadonlyArray<AgentExecutionSessionTransitionRecord>>;
}


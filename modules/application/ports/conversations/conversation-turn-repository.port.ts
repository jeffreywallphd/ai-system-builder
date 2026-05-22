import type { ConversationTurnId, ConversationTurnRecord, ConversationTurnStatus } from '../../../contracts/conversations';
export interface ConversationTurnRepositoryPort {
  saveConversationTurn(record: ConversationTurnRecord): Promise<ConversationTurnRecord>;
  updateConversationTurn(record: ConversationTurnRecord): Promise<ConversationTurnRecord>;
  getConversationTurnById(workspaceId: string, turnId: ConversationTurnId): Promise<ConversationTurnRecord | undefined>;
  listConversationTurnsBySession(workspaceId: string, conversationSessionId: string, status?: ConversationTurnStatus): Promise<readonly ConversationTurnRecord[]>;
  listConversationTurnsByExecutionRun(workspaceId: string, executionRunId: string): Promise<readonly ConversationTurnRecord[]>;
  getLatestConversationTurnBySession(workspaceId: string, conversationSessionId: string): Promise<ConversationTurnRecord | undefined>;
}

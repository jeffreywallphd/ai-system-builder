import type { ConversationMessageId, ConversationMessageRecord } from '../../../contracts/conversations';
export interface ConversationMessageRepositoryPort {
  saveConversationMessage(record: ConversationMessageRecord): Promise<ConversationMessageRecord>;
  getConversationMessageById(workspaceId: string, messageId: ConversationMessageId): Promise<ConversationMessageRecord | undefined>;
  listConversationMessagesBySession(workspaceId: string, conversationSessionId: string): Promise<readonly ConversationMessageRecord[]>;
  listConversationMessagesByTurn(workspaceId: string, conversationTurnId: string): Promise<readonly ConversationMessageRecord[]>;
}

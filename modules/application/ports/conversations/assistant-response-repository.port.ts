import type { AssistantResponseId, AssistantResponseRecord } from '../../../contracts/conversations';
export interface AssistantResponseRepositoryPort {
  saveAssistantResponse(record: AssistantResponseRecord): Promise<AssistantResponseRecord>;
  updateAssistantResponse(record: AssistantResponseRecord): Promise<AssistantResponseRecord>;
  getAssistantResponseById(workspaceId: string, assistantResponseId: AssistantResponseId): Promise<AssistantResponseRecord | undefined>;
  listAssistantResponsesBySession(workspaceId: string, conversationSessionId: string): Promise<readonly AssistantResponseRecord[]>;
  listAssistantResponsesByTurn(workspaceId: string, conversationTurnId: string): Promise<readonly AssistantResponseRecord[]>;
}

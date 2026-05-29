import type { ConversationalInvocationRuntimeReference, ProtectedConversationalInvocationContext } from './conversation-turn-invocation.port';

export type ConversationalInvocationContextRequest = {
  workspaceId: string;
  conversationSessionId: string;
  runtime: ConversationalInvocationRuntimeReference;
  userTurnContent: string;
};

export interface ConversationalInvocationContextPort {
  prepareProtectedInvocationContext(request: ConversationalInvocationContextRequest): Promise<ProtectedConversationalInvocationContext>;
}

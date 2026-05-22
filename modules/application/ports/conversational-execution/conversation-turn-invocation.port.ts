export type ConversationalInvocationRuntimeReference = {
  runtimeId: string;
  capabilityKind: 'text-generation';
  adapterHintId?: string;
};

export type ProtectedConversationalInvocationContext = {
  conversationSessionId: string;
  userTurnContent: string;
  systemInstruction?: string;
  history?: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  generation?: { temperature?: number; maxOutputTokens?: number };
};

export type ConversationTurnInvocationRequest = {
  workspaceId: string;
  conversationSessionId: string;
  runtime: ConversationalInvocationRuntimeReference;
  context: ProtectedConversationalInvocationContext;
  conversationTurnId?: string;
  executionRunId?: string;
  executionAttemptId?: string;
  operationId?: string;
};

export type ConversationTurnInvocationOutcome =
  | { status: 'completed'; assistantResponseText: string }
  | { status: 'failed'; code: 'internal' | 'validation' | 'runtime-error' }
  | { status: 'cancelled' }
  | { status: 'timed-out' }
  | { status: 'unavailable' }
  | { status: 'not-ready' }
  | { status: 'unsupported' }
  | { status: 'blocked' };

export interface ConversationTurnInvocationPort {
  invokeConversationTurn(request: ConversationTurnInvocationRequest): Promise<ConversationTurnInvocationOutcome>;
}

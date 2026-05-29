import type { ProtectedConversationalInvocationContext } from '../../ports/conversational-execution';

export class ConversationalInvocationContextValidationService {
  public validate(context: ProtectedConversationalInvocationContext) {
    if (!context.conversationSessionId || !context.userTurnContent?.trim()) return { valid: false as const, reason: 'missing-required-context' };
    if (context.userTurnContent.length > 8000) return { valid: false as const, reason: 'user-content-too-long' };
    if (context.history && context.history.length > 50) return { valid: false as const, reason: 'history-too-large' };
    for (const item of context.history ?? []) {
      if (!item.content?.trim()) return { valid: false as const, reason: 'history-content-invalid' };
      if (item.content.length > 8000) return { valid: false as const, reason: 'history-content-too-long' };
    }
    if (context.systemInstruction && context.systemInstruction.length > 8000) return { valid: false as const, reason: 'system-instruction-too-long' };
    if (context.generation?.temperature !== undefined && (context.generation.temperature < 0 || context.generation.temperature > 2)) return { valid: false as const, reason: 'generation-temperature-out-of-range' };
    if (context.generation?.maxOutputTokens !== undefined && (context.generation.maxOutputTokens < 1 || context.generation.maxOutputTokens > 8000)) return { valid: false as const, reason: 'generation-max-output-tokens-out-of-range' };
    return { valid: true as const };
  }
}

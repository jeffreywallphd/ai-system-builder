import type { ProtectedConversationalInvocationContext } from '../../ports/conversational-execution';

const BLOCKED_PATTERNS = [/api[_-]?key/i, /private[_-]?key/i, /bearer\s+[a-z0-9\-_\.]+/i, /-----begin/i, /signed url/i, /base64/i, /stack trace/i, /providerpayload/i, /workflow\s*\{/i, /\/home\//i, /[A-Za-z]:\\/i, /\bcurl\b/i];

export class ConversationalInvocationContextValidationService {
  public validate(context: ProtectedConversationalInvocationContext) {
    if (!context.conversationSessionId || !context.userTurnContent?.trim()) return { valid: false as const, reason: 'missing-required-context' };
    if (context.userTurnContent.length > 8000) return { valid: false as const, reason: 'user-content-too-long' };
    const corpus = [context.userTurnContent, context.systemInstruction ?? '', ...(context.history?.map((h) => h.content) ?? [])].join('\n');
    if (BLOCKED_PATTERNS.some((p) => p.test(corpus))) return { valid: false as const, reason: 'unsafe-protected-context' };
    if (context.history && context.history.length > 50) return { valid: false as const, reason: 'history-too-large' };
    return { valid: true as const };
  }
}

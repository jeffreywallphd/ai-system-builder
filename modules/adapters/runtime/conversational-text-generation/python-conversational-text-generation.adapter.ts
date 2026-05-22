import { randomUUID } from 'node:crypto';
import type { ConversationTurnInvocationOutcome, ConversationTurnInvocationPort, ConversationTurnInvocationRequest, ConversationalRuntimeAdapterCatalogPort, ConversationalRuntimeGuardPort } from '../../../application/ports/conversational-execution';
import type { PythonRuntimePort } from '../../../application/ports/runtime';
import { PYTHON_RUNTIME_CAPABILITY_CONVERSATION_TEXT_GENERATION } from '../../../contracts/runtime';

export const PYTHON_CONVERSATIONAL_ADAPTER_ID = 'python-runtime.conversation-text-generation.v1';

function toMessages(request: ConversationTurnInvocationRequest): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (request.context.systemInstruction) out.push({ role: 'system', content: request.context.systemInstruction });
  for (const h of request.context.history ?? []) out.push({ role: h.role, content: h.content });
  out.push({ role: 'user', content: request.context.userTurnContent });
  return out;
}

export function createPythonConversationalTextGenerationInvocationAdapter(runtimePort: PythonRuntimePort): ConversationTurnInvocationPort {
  return { async invokeConversationTurn(request): Promise<ConversationTurnInvocationOutcome> {
    if (request.runtime.runtimeId !== 'python-sidecar' || request.runtime.capabilityKind !== 'text-generation') return { status: 'unsupported' };
    const requestId = `conversation-text-generation-${randomUUID()}`;
    try {
      await runtimePort.startTask({ requestId, taskType: 'conversation-text-generation', payload: { messages: toMessages(request), generation: request.context.generation, selectedModelId: request.runtime.adapterHintId }, metadata: { operation: 'conversation.turn.invoke', workspaceId: request.workspaceId, conversationSessionId: request.conversationSessionId } });
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const status = await runtimePort.readTaskStatus(requestId);
        if (status.status === 'succeeded') {
          const text = typeof (status.data as any)?.assistantResponseText === 'string' ? (status.data as any).assistantResponseText.trim() : '';
          if (!text) return { status: 'failed', code: 'validation' };
          if (text.length > 8_000) return { status: 'failed', code: 'validation' };
          return { status: 'completed', assistantResponseText: text };
        }
        if (status.status === 'failed') return { status: 'failed', code: 'runtime-error' };
        if (status.status === 'cancelled') return { status: 'cancelled' };
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return { status: 'timed-out' };
    } catch { return { status: 'failed', code: 'internal' }; }
  }};
}

export function createPythonConversationalRuntimeAdapterCatalog(): ConversationalRuntimeAdapterCatalogPort {
  return { async resolveForRuntime(runtime) {
    if (runtime.runtimeId !== 'python-sidecar' || runtime.capabilityKind !== 'text-generation') return { status: 'unsupported' } as const;
    return { status: 'supported', adapterId: PYTHON_CONVERSATIONAL_ADAPTER_ID, capabilityKind: 'text-generation', capabilities: { progress: false, cancellation: false } } as const;
  }};
}

export function createPythonConversationalRuntimeGuard(runtimePort: PythonRuntimePort): ConversationalRuntimeGuardPort {
  return { async getRuntimeStatus(adapterId) {
    if (adapterId !== PYTHON_CONVERSATIONAL_ADAPTER_ID) return 'unsupported';
    try {
      const health = await runtimePort.getHealthStatus();
      const caps = await runtimePort.getCapabilities();
      if (!health.healthy) return 'unhealthy';
      if (!caps.capabilities.includes(PYTHON_RUNTIME_CAPABILITY_CONVERSATION_TEXT_GENERATION)) return 'unsupported';
      return health.status.status === 'ready' ? 'ready' : 'starting';
    } catch { return 'unavailable'; }
  }};
}

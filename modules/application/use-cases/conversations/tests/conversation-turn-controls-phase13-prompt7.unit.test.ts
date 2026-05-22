import test from 'node:test';
import assert from 'node:assert/strict';
import { CancelConversationTurnUseCase } from '../cancel-conversation-turn.use-case';
import { RetryConversationTurnUseCase } from '../retry-conversation-turn.use-case';
import { ConversationTurnFailureClassificationService } from '../conversation-turn-failure-classification.service';

test('cancel returns not-supported truthfully for existing run', async () => {
  const uc = new CancelConversationTurnUseCase({
    turnRepository: { getConversationTurnById: async () => ({ id: 't1', conversationSessionId: 's1', executionRunId: 'r1' }) } as any,
    executionRunRepository: { getExecutionRunById: async () => ({ id: 'r1', status: 'running' }) } as any,
  });
  const result = await uc.execute({ workspaceId: 'w1', conversationTurnId: 't1', conversationSessionId: 's1', operationId: 'op1' });
  assert.equal(result.kind, 'success');
  if (result.kind === 'success') assert.equal(result.value.status, 'not-supported');
});

test('retry blocks non retryable turn status', async () => {
  const uc = new RetryConversationTurnUseCase({ turnRepository: { getConversationTurnById: async () => ({ id: 't1', conversationSessionId: 's1', status: 'succeeded' }) } as any, submitUseCase: {} as any });
  const result = await uc.execute({ workspaceId: 'w1', conversationTurnId: 't1', conversationSessionId: 's1', operationId: 'op1' });
  assert.equal(result.kind, 'failure');
});

test('failure classification maps orchestration outcomes safely', () => {
  const svc = new ConversationTurnFailureClassificationService();
  assert.equal(svc.classify('timed-out'), 'invocation-timed-out');
  assert.equal(svc.classify('blocked'), 'assistant-response-too-long');
  assert.equal(svc.classify('unsupported'), 'runtime-unsupported');
});

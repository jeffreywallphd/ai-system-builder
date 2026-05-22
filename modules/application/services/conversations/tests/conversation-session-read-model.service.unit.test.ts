import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationSessionReadModelService } from '../conversation-session-read-model.service';

test('lists safe session summaries without transcript content', async () => {
  const svc = new ConversationSessionReadModelService(
    { listConversationSessions: async () => ({ sessions: [{ id: 's.1', workspaceId: 'ws.1', systemLabel: 'Basic Conversational Assistant', sourceExecutionPlanId: 'ep.1', status: 'active', turnIds: ['t.1'], createdAt: '1', updatedAt: '2', executionApprovalStatus: 'granted', provenance: [{ runtimeReferenceStatus: 'supported' }] }] }) } as never,
    { getLatestConversationTurnBySession: async () => ({ id: 't.1', updatedAt: '2' }) } as never,
    { listAssistantResponsesByTurn: async () => [{ status: 'completed' }] } as never,
    { getExecutionRunById: async () => undefined } as never,
  );

  const { items } = await svc.list({ workspaceId: 'ws.1' });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.actions.maySubmitMessage, true);
  assert.equal((items[0] as Record<string, unknown>).text, undefined);
});

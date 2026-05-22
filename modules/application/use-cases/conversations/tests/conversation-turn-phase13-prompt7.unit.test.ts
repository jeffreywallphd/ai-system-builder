import test from 'node:test';
import assert from 'node:assert/strict';
import { SubmitConversationTurnUseCase } from '../submit-conversation-turn.use-case';

function inMemory() {
  const sessions = new Map<string, any>(); const turns = new Map<string, any>(); const msgs = new Map<string, any>(); const responses = new Map<string, any>(); const runs = new Map<string, any>(); const atts = new Map<string, any>(); const events: any[] = []; const results = new Map<string, any>();
  return {
    stores: { sessions, turns, msgs, responses, runs, atts, events, results },
    ports: {
      sessionRepository: { getConversationSessionById: async (_w: string, id: string) => sessions.get(id), updateConversationSession: async (r: any) => (sessions.set(r.id, r), r) },
      turnRepository: { saveConversationTurn: async (r: any) => (turns.set(r.id, r), r), updateConversationTurn: async (r: any) => (turns.set(r.id, r), r), getConversationTurnById: async (_w: string, id: string) => turns.get(id) },
      messageRepository: { saveConversationMessage: async (r: any) => (msgs.set(r.id, r), r) },
      assistantResponseRepository: { saveAssistantResponse: async (r: any) => (responses.set(r.id, r), r) },
      executionRunRepository: { saveExecutionRun: async (r: any) => (runs.set(r.id, r), r), updateExecutionRun: async (r: any) => (runs.set(r.id, r), r), getExecutionRunById: async (_w: string, id: string) => runs.get(id) },
      executionAttemptRepository: { saveExecutionAttempt: async (r: any) => (atts.set(r.id, r), r), updateExecutionAttempt: async (r: any) => (atts.set(r.id, r), r), getExecutionAttemptById: async (_w: string, id: string) => atts.get(id) },
      executionEventRepository: { appendExecutionEvent: async (r: any) => (events.push(r), r) },
      executionResultRepository: { saveExecutionResult: async (r: any) => (results.set(r.id, r), r) },
    },
  };
}

test('submit turn persists lifecycle and response, with idempotent operation key', async () => {
  const m = inMemory();
  m.stores.sessions.set('s1', { id: 's1', workspaceId: 'w1', sourceExecutionPlanId: 'ep1', status: 'approved', turnIds: [], blockers: [], diagnostics: [], provenance: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  let n = 0;
  const uc = new SubmitConversationTurnUseCase({ ...m.ports as any, orchestrator: { invoke: async () => ({ status: 'completed', assistantResponseText: 'hello' }) } as any, nextId: () => `id-${++n}`, now: () => '2026-01-02T00:00:00.000Z' });
  const first = await uc.execute({ workspaceId: 'w1', conversationSessionId: 's1', text: 'Hi', operationId: 'op-1' });
  const second = await uc.execute({ workspaceId: 'w1', conversationSessionId: 's1', text: 'Hi', operationId: 'op-1' });
  assert.equal(first.kind, 'success'); assert.equal(second.kind, 'success');
  assert.equal(m.stores.msgs.size, 1); assert.equal(m.stores.turns.size, 1); assert.equal(m.stores.runs.size, 1); assert.equal(m.stores.responses.size, 1); assert.equal(m.stores.results.size, 1);
});

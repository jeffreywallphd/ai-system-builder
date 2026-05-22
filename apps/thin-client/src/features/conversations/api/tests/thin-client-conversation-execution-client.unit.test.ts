import { describe, expect, it, testDouble } from '../../../../../../modules/testing/node-test';
import { createThinClientConversationExecutionClient } from '../thinClientConversationExecutionClient';

describe('thinClientConversationExecutionClient', () => {
  it('encodes workspace and session route params', async () => {
    const fetchStub = testDouble.fn(async () => ({ json: async () => ({ ok: true, value: {} }) }));
    (globalThis as any).fetch = fetchStub;
    const client = createThinClientConversationExecutionClient('/api/conversations');
    await client.readConversationSession({ workspaceId: 'workspace/a', conversationSessionId: 'session/b' });
    expect(String(fetchStub.mock.calls[0]?.[0])).toContain('workspace%2Fa');
    expect(String(fetchStub.mock.calls[0]?.[0])).toContain('session%2Fb');
  });

  it('sends only safe submit-turn body fields', async () => {
    const fetchStub = testDouble.fn(async (_url: string, init?: RequestInit) => ({ json: async () => ({ ok: true, value: {} }), init }));
    (globalThis as any).fetch = fetchStub;
    const client = createThinClientConversationExecutionClient('/api/conversations');
    await client.submitConversationTurn({ workspaceId: 'w', conversationSessionId: 's', text: 'hello', operationId: 'op-1' });
    const body = JSON.parse(String(fetchStub.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ text: 'hello', operationId: 'op-1' });
  });
});

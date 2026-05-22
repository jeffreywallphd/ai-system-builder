import { describe, expect, it, testDouble } from '../../../../../../../modules/testing/node-test';
import { createDesktopConversationExecutionClient } from '../desktopConversationExecutionClient';

describe('desktopConversationExecutionClient', () => {
  it('calls matching preload methods', async () => {
    const create = testDouble.fn(async () => ({ ok: true, value: { conversationSessionId: 's1' } }));
    (globalThis as any).window = { desktopApi: { createConversationExecutionSessionFromPlan: create } };
    const client = createDesktopConversationExecutionClient();
    await client.createConversationSessionFromPlan({ workspaceId: 'w', sourceExecutionPlanId: 'plan' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual({ workspaceId: 'w', sourceExecutionPlanId: 'plan' });
  });

  it('fails safely when preload method is unavailable', async () => {
    (globalThis as any).window = { desktopApi: {} };
    const client = createDesktopConversationExecutionClient();
    const result = await client.submitConversationTurn({ workspaceId: 'w', conversationSessionId: 's', text: 'hi', operationId: 'op' });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});

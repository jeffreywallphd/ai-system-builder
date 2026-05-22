import { describe, expect, it, testDouble } from '../../../../../../../../modules/testing/node-test';
import { createDesktopConversationExecutionClient } from '../desktopConversationExecutionClient';

describe('desktopConversationExecutionClient', () => {
  it('calls matching preload methods', async () => {
    const create = testDouble.fn<(input: { workspaceId: string; sourceExecutionPlanId: string }) => Promise<{ ok: true; value: { conversationSessionId: string } }>>(async () => ({ ok: true, value: { conversationSessionId: 's1' } }));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { desktopApi: { createConversationExecutionSessionFromPlan: create } } });
    const client = createDesktopConversationExecutionClient();
    await client.createConversationSessionFromPlan({ workspaceId: 'w', sourceExecutionPlanId: 'plan' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toEqual({ workspaceId: 'w', sourceExecutionPlanId: 'plan' });
  });

  it('fails safely when preload method is unavailable', async () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { desktopApi: {} } });
    const client = createDesktopConversationExecutionClient();
    const result = await client.submitConversationTurn({ workspaceId: 'w', conversationSessionId: 's', text: 'hi', operationId: 'op' });
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('exposes safe host capabilities without streaming cancel or retry claims', () => {
    const capabilities = createDesktopConversationExecutionClient().readCapabilities();
    expect(capabilities.submitTurn).toEqual({ transport: true, hostSupport: 'supported', streaming: false });
    expect(capabilities.cancellation).toEqual({ supported: false, deferred: true });
    expect(capabilities.retry).toEqual({ supported: false, deferred: true });
  });
});

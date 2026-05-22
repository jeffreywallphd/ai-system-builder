import { describe, expect, it } from '../../testing/node-test';
import { createDesktopConversationExecutionClient } from '../../../apps/desktop/src/renderer/features/conversations/api/desktopConversationExecutionClient';
import { createThinClientConversationExecutionClient } from '../../../apps/thin-client/src/features/conversations/api/thinClientConversationExecutionClient';

describe('conversation client operation parity', () => {
  it('keeps desktop and thin-client operation surface aligned', () => {
    const desktop = Object.keys(createDesktopConversationExecutionClient()).sort();
    const thin = Object.keys(createThinClientConversationExecutionClient()).sort();
    expect(desktop).toEqual(thin);
    expect(desktop).not.toContain('streamConversationTurn');
    expect(desktop).not.toContain('invokeRawRuntime');
  });
});

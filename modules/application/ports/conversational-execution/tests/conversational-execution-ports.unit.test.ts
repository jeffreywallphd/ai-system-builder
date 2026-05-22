import test from 'node:test';
import assert from 'node:assert/strict';
import * as ports from '../index';

test('exports conversational execution port family', () => {
  assert.ok(ports);
});

test('invocation outcome remains safe and provider-neutral', () => {
  const outcome: ports.ConversationTurnInvocationOutcome = { status: 'unsupported' };
  assert.equal(outcome.status, 'unsupported');
});

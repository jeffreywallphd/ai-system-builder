import test from 'node:test';
import assert from 'node:assert/strict';
import { PYTHON_CONVERSATIONAL_ADAPTER_ID, createPythonConversationalRuntimeAdapterCatalog, createPythonConversationalRuntimeGuard, createPythonConversationalTextGenerationInvocationAdapter } from '../python-conversational-text-generation.adapter';

test('catalog resolves only python-sidecar text-generation runtime', async () => {
  const catalog = createPythonConversationalRuntimeAdapterCatalog();
  assert.equal((await catalog.resolveForRuntime({ runtimeId: 'other-runtime', capabilityKind: 'text-generation' })).status, 'unsupported');
  const supported = await catalog.resolveForRuntime({ runtimeId: 'python-sidecar', capabilityKind: 'text-generation' });
  assert.equal(supported.status, 'supported');
  if (supported.status === 'supported') assert.equal(supported.adapterId, PYTHON_CONVERSATIONAL_ADAPTER_ID);
});

test('runtime guard maps unsupported adapter id', async () => {
  const guard = createPythonConversationalRuntimeGuard({ getHealthStatus: async () => ({ healthy: true, status: { runtimeId: 'python-sidecar', status: 'ready' } as never }), getCapabilities: async () => ({ runtimeId: 'python-sidecar', capabilities: ['conversation-text-generation'] }) } as never);
  assert.equal(await guard.getRuntimeStatus('other-adapter-id'), 'unsupported');
});

test('invocation adapter maps successful runtime response', async () => {
  let statusReads = 0;
  const invocation = createPythonConversationalTextGenerationInvocationAdapter({
    startTask: async () => ({ requestId: 'req-1' }),
    readTaskStatus: async () => statusReads++ === 0 ? ({ requestId: 'req-1', status: 'running' }) : ({ requestId: 'req-1', status: 'succeeded', data: { assistantResponseText: 'hello world' } }),
  } as never);
  const outcome = await invocation.invokeConversationTurn({ workspaceId: 'ws-1', conversationSessionId: 'cs-1', runtime: { runtimeId: 'python-sidecar', capabilityKind: 'text-generation' }, context: { conversationSessionId: 'cs-1', userTurnContent: 'hello' } });
  assert.equal(outcome.status, 'completed');
});

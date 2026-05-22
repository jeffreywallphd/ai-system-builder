import { describe, expect, it, testDouble } from '../../../../testing/node-test';
import { registerConversationExecutionApiRoutes, type ExpressRoutePort } from '../conversations/registerConversationExecutionApiRoutes';

function response() { const json = testDouble.fn(); const status = testDouble.fn(); const res: any = { status: status.mockImplementation(() => res), json }; return { res, json, status }; }

const svc = () => ({
  create: { execute: testDouble.fn(async () => ({ kind: 'success', value: { id: 's.1' } })) } as any,
  approve: { execute: testDouble.fn(async () => ({ kind: 'success', value: { id: 's.1', status: 'approved' } })) } as any,
  submitTurn: { execute: testDouble.fn(async () => ({ kind: 'success', value: { status: 'succeeded', assistantResponseText: 'ok' } })) } as any,
  cancelTurn: { execute: testDouble.fn(async () => ({ kind: 'success', value: { status: 'not-supported' } })) } as any,
  retryTurn: { execute: testDouble.fn(async () => ({ kind: 'success', value: { status: 'not-supported', conversationTurnId: 't.1' } })) } as any,
  readSessions: { listSummaries: testDouble.fn(async () => []), readDetail: testDouble.fn(async () => ({ conversationSessionId: 's.1' })) } as any,
  readTranscript: { readTranscript: testDouble.fn(async () => ({ ok: true, turns: [{ userMessage: { text: 'user' }, assistantResponse: { text: 'assistant' } }] })) } as any,
  readActivity: { readActivity: testDouble.fn(async () => ({ ok: true, turnId: 't.1', events: [] })) } as any,
});

describe('registerConversationExecutionApiRoutes', () => {
  it('registers full route family', () => {
    const gets = new Map<string, any>(); const posts = new Map<string, any>();
    const app: ExpressRoutePort = { get: testDouble.fn((p, h) => gets.set(p, h)), post: testDouble.fn((p, h) => posts.set(p, h)) };
    registerConversationExecutionApiRoutes({ app, conversations: svc() as any });
    expect(posts.has('/api/conversations/workspaces/:workspaceId/sessions')).toBe(true);
    expect(posts.has('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/turns/:conversationTurnId/retry')).toBe(true);
    expect(gets.has('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/transcript')).toBe(true);
  });

  it('submit turn delegates with explicit workspace/session scope', async () => {
    const gets = new Map<string, any>(); const posts = new Map<string, any>(); const services = svc();
    const app: ExpressRoutePort = { get: testDouble.fn((p, h) => gets.set(p, h)), post: testDouble.fn((p, h) => posts.set(p, h)) };
    registerConversationExecutionApiRoutes({ app, conversations: services as any });
    const r = response();
    await posts.get('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/turns')({ params: { workspaceId: 'ws.1', conversationSessionId: 's.1' }, body: { text: 'hello', operationId: 'op.1' } }, r.res);
    expect(services.submitTurn.execute).toHaveBeenCalledWith({ workspaceId: 'ws.1', conversationSessionId: 's.1', text: 'hello', operationId: 'op.1' });
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('rejects unsupported request fields', async () => {
    const posts = new Map<string, any>(); const app: ExpressRoutePort = { get: testDouble.fn(), post: testDouble.fn((p, h) => posts.set(p, h)) };
    registerConversationExecutionApiRoutes({ app, conversations: svc() as any });
    const r = response();
    await posts.get('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/turns')({ params: { workspaceId: 'ws.1', conversationSessionId: 's.1' }, body: { text: 'hello', operationId: 'op.1', runtime: 'bad' } }, r.res);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('maps list validation for invalid status filter', async () => {
    const gets = new Map<string, any>(); const app: ExpressRoutePort = { get: testDouble.fn((p, h) => gets.set(p, h)), post: testDouble.fn() };
    registerConversationExecutionApiRoutes({ app, conversations: svc() as any });
    const r = response();
    await gets.get('/api/conversations/workspaces/:workspaceId/sessions')({ params: { workspaceId: 'ws.1' }, query: { status: 'bogus' } }, r.res);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('maps failure kinds to safe HTTP status', async () => {
    const posts = new Map<string, any>(); const services = svc();
    services.submitTurn.execute = testDouble.fn(async () => ({ kind: 'failure', failureKind: 'runtime-not-ready', diagnostics: [{ message: 'Not ready' }] }));
    const app: ExpressRoutePort = { get: testDouble.fn(), post: testDouble.fn((p, h) => posts.set(p, h)) };
    registerConversationExecutionApiRoutes({ app, conversations: services as any });
    const r = response();
    await posts.get('/api/conversations/workspaces/:workspaceId/sessions/:conversationSessionId/turns')({ params: { workspaceId: 'ws.1', conversationSessionId: 's.1' }, body: { text: 'hello', operationId: 'op.1' } }, r.res);
    expect(r.status).toHaveBeenCalledWith(409);
  });
});

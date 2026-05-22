import type { IpcMainHandlePort } from '../ipcMainHandlePort';
import { DESKTOP_CONVERSATION_EXECUTION_V2_APPROVE_SESSION_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_CANCEL_TURN_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_CREATE_SESSION_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_LIST_SESSIONS_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_READ_SESSION_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_READ_TRANSCRIPT_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_READ_TURN_ACTIVITY_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_RETRY_TURN_REQUEST_CHANNEL, DESKTOP_CONVERSATION_EXECUTION_V2_SUBMIT_TURN_REQUEST_CHANNEL } from '../../../../contracts/ipc';

export interface RegisterConversationExecutionIpcDependencies { ipcMain: IpcMainHandlePort; conversations: any; }
type IpcRequest<T> = { requestId?: string; correlationId?: string; payload?: T };
const asText = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const ok = <T>(r: IpcRequest<T>, value: unknown) => ({ ok: true, requestId: r.requestId, correlationId: r.correlationId, value });
const fail = <T>(r: IpcRequest<T>, code: string, message: string) => ({ ok: false, requestId: r.requestId, correlationId: r.correlationId, error: { code, message } });

export function registerConversationExecutionIpc({ ipcMain, conversations }: RegisterConversationExecutionIpcDependencies): void {
  const req = <T>(fn: (p: T) => Promise<unknown>, validate: (p: T | undefined) => string | undefined) => async (_e: unknown, r: IpcRequest<T>) => {
    const m = validate(r?.payload); if (m) return fail(r, 'validation', m);
    try { return ok(r, await fn(r.payload as T)); } catch { return fail(r, 'internal', 'Unable to complete request.'); }
  };
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_CREATE_SESSION_REQUEST_CHANNEL.value, req((p: any) => conversations.create.execute(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.sourceExecutionPlanId) ? 'Workspace id and source execution plan id are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_APPROVE_SESSION_REQUEST_CHANNEL.value, req((p: any) => conversations.approve.execute(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) || !asText(p?.executionApprovalId) ? 'Workspace, session, and approval ids are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_LIST_SESSIONS_REQUEST_CHANNEL.value, req((p: any) => conversations.readSessions.listSummaries(p), (p: any) => !asText(p?.workspaceId) ? 'Workspace id is required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_READ_SESSION_REQUEST_CHANNEL.value, req((p: any) => conversations.readSessions.readDetail(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) ? 'Workspace and session ids are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_READ_TRANSCRIPT_REQUEST_CHANNEL.value, req((p: any) => conversations.readTranscript.readTranscript(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) ? 'Workspace and session ids are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_READ_TURN_ACTIVITY_REQUEST_CHANNEL.value, req((p: any) => conversations.readActivity.readActivity(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) || !asText(p?.conversationTurnId) ? 'Workspace, session, and turn ids are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_SUBMIT_TURN_REQUEST_CHANNEL.value, req((p: any) => conversations.submitTurn.execute(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) || !asText(p?.text) || !asText(p?.operationId) ? 'Workspace, session, text, and operation id are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_CANCEL_TURN_REQUEST_CHANNEL.value, req((p: any) => conversations.cancelTurn.execute(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) || !asText(p?.conversationTurnId) || !asText(p?.operationId) ? 'Workspace, session, turn, and operation id are required.' : undefined));
  ipcMain.handle(DESKTOP_CONVERSATION_EXECUTION_V2_RETRY_TURN_REQUEST_CHANNEL.value, req((p: any) => conversations.retryTurn.execute(p), (p: any) => !asText(p?.workspaceId) || !asText(p?.conversationSessionId) || !asText(p?.conversationTurnId) || !asText(p?.operationId) ? 'Workspace, session, turn, and operation id are required.' : undefined));
}

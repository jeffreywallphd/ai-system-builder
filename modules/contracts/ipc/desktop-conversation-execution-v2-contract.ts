import { createIpcChannel } from './ipc-channel';

export const DESKTOP_CONVERSATION_EXECUTION_V2_CREATE_SESSION_REQUEST_CHANNEL = createIpcChannel('conversations:v2:create-session');
export const DESKTOP_CONVERSATION_EXECUTION_V2_APPROVE_SESSION_REQUEST_CHANNEL = createIpcChannel('conversations:v2:approve-session');
export const DESKTOP_CONVERSATION_EXECUTION_V2_LIST_SESSIONS_REQUEST_CHANNEL = createIpcChannel('conversations:v2:list-sessions');
export const DESKTOP_CONVERSATION_EXECUTION_V2_READ_SESSION_REQUEST_CHANNEL = createIpcChannel('conversations:v2:read-session');
export const DESKTOP_CONVERSATION_EXECUTION_V2_READ_TRANSCRIPT_REQUEST_CHANNEL = createIpcChannel('conversations:v2:read-transcript');
export const DESKTOP_CONVERSATION_EXECUTION_V2_READ_TURN_ACTIVITY_REQUEST_CHANNEL = createIpcChannel('conversations:v2:read-turn-activity');
export const DESKTOP_CONVERSATION_EXECUTION_V2_SUBMIT_TURN_REQUEST_CHANNEL = createIpcChannel('conversations:v2:submit-turn');
export const DESKTOP_CONVERSATION_EXECUTION_V2_CANCEL_TURN_REQUEST_CHANNEL = createIpcChannel('conversations:v2:cancel-turn');
export const DESKTOP_CONVERSATION_EXECUTION_V2_RETRY_TURN_REQUEST_CHANNEL = createIpcChannel('conversations:v2:retry-turn');

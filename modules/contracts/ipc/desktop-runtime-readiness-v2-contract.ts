import { createTransportOperation } from '../transport';
import { createIpcChannel } from './ipc-channel';
import { createIpcRequest, type IpcRequest } from './ipc-request';
import { type IpcResponse } from './ipc-response';

export const DESKTOP_RUNTIME_READINESS_REFRESH_INVENTORY_OPERATION = createTransportOperation('runtime-readiness', 'refresh-inventory');
export const DESKTOP_RUNTIME_READINESS_LIST_INVENTORY_OPERATION = createTransportOperation('runtime-readiness', 'list-inventory');
export const DESKTOP_RUNTIME_READINESS_READ_INVENTORY_OPERATION = createTransportOperation('runtime-readiness', 'read-inventory');
export const DESKTOP_RUNTIME_READINESS_READ_LATEST_INVENTORY_OPERATION = createTransportOperation('runtime-readiness', 'read-latest-inventory');
export const DESKTOP_RUNTIME_READINESS_SUMMARIZE_INVENTORY_OPERATION = createTransportOperation('runtime-readiness', 'summarize-inventory');
export const DESKTOP_RUNTIME_READINESS_CREATE_BINDING_OPERATION = createTransportOperation('runtime-readiness', 'create-binding');
export const DESKTOP_RUNTIME_READINESS_VALIDATE_BINDING_OPERATION = createTransportOperation('runtime-readiness', 'validate-binding');

export const DESKTOP_RUNTIME_READINESS_REFRESH_INVENTORY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_REFRESH_INVENTORY_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_LIST_INVENTORY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_LIST_INVENTORY_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_READ_INVENTORY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_READ_INVENTORY_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_READ_LATEST_INVENTORY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_READ_LATEST_INVENTORY_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_SUMMARIZE_INVENTORY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_SUMMARIZE_INVENTORY_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_CREATE_BINDING_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_CREATE_BINDING_OPERATION, 'request');
export const DESKTOP_RUNTIME_READINESS_VALIDATE_BINDING_REQUEST_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_VALIDATE_BINDING_OPERATION, 'request');

export const DESKTOP_RUNTIME_READINESS_REFRESH_INVENTORY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_REFRESH_INVENTORY_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_LIST_INVENTORY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_LIST_INVENTORY_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_READ_INVENTORY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_READ_INVENTORY_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_READ_LATEST_INVENTORY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_READ_LATEST_INVENTORY_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_SUMMARIZE_INVENTORY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_SUMMARIZE_INVENTORY_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_CREATE_BINDING_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_CREATE_BINDING_OPERATION, 'response');
export const DESKTOP_RUNTIME_READINESS_VALIDATE_BINDING_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_RUNTIME_READINESS_VALIDATE_BINDING_OPERATION, 'response');

export type RuntimeReadinessV2RequestPayload = { targetWorkspaceId: string; [k: string]: unknown };
export type RuntimeReadinessV2Request = IpcRequest<RuntimeReadinessV2RequestPayload>;
export type RuntimeReadinessV2Response = IpcResponse<unknown, Record<string, unknown>>;

export const createRuntimeReadinessV2Request = (channel: Parameters<typeof createIpcRequest>[0], payload: RuntimeReadinessV2RequestPayload, options?: {requestId?: string; correlationId?: string}) => createIpcRequest(channel as never, payload, options);

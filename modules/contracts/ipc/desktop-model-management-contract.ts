import type {
  BrowseModelsRequest,
  BrowseModelsResult,
  DeleteModelRecordRequest,
  DeleteModelRecordResult,
  GetModelDetailsRequest,
  GetModelDetailsResult,
  ListModelsRequest,
  ListModelsResult,
  SaveModelReferenceRequest,
  SaveModelReferenceResult,
  UpdateModelRecordRequest,
  UpdateModelRecordResult,
} from "../model";
import { createTransportOperation } from "../transport";
import { createIpcChannel } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import { createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_MODEL_BROWSE_OPERATION = createTransportOperation("model", "browse");
export const DESKTOP_MODEL_DETAILS_READ_OPERATION = createTransportOperation("model", "details-read");
export const DESKTOP_MODEL_LIST_OPERATION = createTransportOperation("model", "list");
export const DESKTOP_MODEL_REFERENCE_SAVE_OPERATION = createTransportOperation("model", "reference-save");
export const DESKTOP_MODEL_RECORD_UPDATE_OPERATION = createTransportOperation("model", "record-update");
export const DESKTOP_MODEL_RECORD_DELETE_OPERATION = createTransportOperation("model", "record-delete");

export const DESKTOP_MODEL_BROWSE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_BROWSE_OPERATION, "request");
export const DESKTOP_MODEL_BROWSE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_BROWSE_OPERATION, "response");
export const DESKTOP_MODEL_DETAILS_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_DETAILS_READ_OPERATION, "request");
export const DESKTOP_MODEL_DETAILS_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_DETAILS_READ_OPERATION, "response");
export const DESKTOP_MODEL_LIST_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_LIST_OPERATION, "request");
export const DESKTOP_MODEL_LIST_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_LIST_OPERATION, "response");
export const DESKTOP_MODEL_REFERENCE_SAVE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_REFERENCE_SAVE_OPERATION, "request");
export const DESKTOP_MODEL_REFERENCE_SAVE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_REFERENCE_SAVE_OPERATION, "response");
export const DESKTOP_MODEL_RECORD_UPDATE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_RECORD_UPDATE_OPERATION, "request");
export const DESKTOP_MODEL_RECORD_UPDATE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_RECORD_UPDATE_OPERATION, "response");
export const DESKTOP_MODEL_RECORD_DELETE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_MODEL_RECORD_DELETE_OPERATION, "request");
export const DESKTOP_MODEL_RECORD_DELETE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_MODEL_RECORD_DELETE_OPERATION, "response");

export type DesktopModelBrowseRequest = IpcRequest<
  BrowseModelsRequest,
  typeof DESKTOP_MODEL_BROWSE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_BROWSE_REQUEST_CHANNEL.value
>;
export type DesktopModelBrowseResponse = IpcResponse<
  BrowseModelsResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_BROWSE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_BROWSE_RESPONSE_CHANNEL.value
>;
export type DesktopModelDetailsReadRequest = IpcRequest<
  GetModelDetailsRequest,
  typeof DESKTOP_MODEL_DETAILS_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_DETAILS_READ_REQUEST_CHANNEL.value
>;
export type DesktopModelDetailsReadResponse = IpcResponse<
  GetModelDetailsResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_DETAILS_READ_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_DETAILS_READ_RESPONSE_CHANNEL.value
>;
export type DesktopModelListRequest = IpcRequest<
  ListModelsRequest,
  typeof DESKTOP_MODEL_LIST_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_LIST_REQUEST_CHANNEL.value
>;
export type DesktopModelListResponse = IpcResponse<
  ListModelsResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_LIST_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_LIST_RESPONSE_CHANNEL.value
>;
export type DesktopModelReferenceSaveRequest = IpcRequest<
  SaveModelReferenceRequest,
  typeof DESKTOP_MODEL_REFERENCE_SAVE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_REFERENCE_SAVE_REQUEST_CHANNEL.value
>;
export type DesktopModelReferenceSaveResponse = IpcResponse<
  SaveModelReferenceResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_REFERENCE_SAVE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_REFERENCE_SAVE_RESPONSE_CHANNEL.value
>;
export type DesktopModelRecordUpdateRequest = IpcRequest<
  UpdateModelRecordRequest,
  typeof DESKTOP_MODEL_RECORD_UPDATE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_RECORD_UPDATE_REQUEST_CHANNEL.value
>;
export type DesktopModelRecordUpdateResponse = IpcResponse<
  UpdateModelRecordResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_RECORD_UPDATE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_RECORD_UPDATE_RESPONSE_CHANNEL.value
>;
export type DesktopModelRecordDeleteRequest = IpcRequest<
  DeleteModelRecordRequest,
  typeof DESKTOP_MODEL_RECORD_DELETE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_RECORD_DELETE_REQUEST_CHANNEL.value
>;
export type DesktopModelRecordDeleteResponse = IpcResponse<
  DeleteModelRecordResult,
  Record<string, unknown>,
  typeof DESKTOP_MODEL_RECORD_DELETE_OPERATION,
  Record<string, never>,
  typeof DESKTOP_MODEL_RECORD_DELETE_RESPONSE_CHANNEL.value
>;

export function createDesktopModelBrowseRequest(payload: BrowseModelsRequest, options?: { requestId?: string; correlationId?: string }): DesktopModelBrowseRequest {
  return createIpcRequest(DESKTOP_MODEL_BROWSE_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelBrowseSuccessResponse(result: BrowseModelsResult, options?: { requestId?: string; correlationId?: string }): DesktopModelBrowseResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_BROWSE_RESPONSE_CHANNEL, result, options) as DesktopModelBrowseResponse;
}
export function createDesktopModelDetailsReadRequest(payload: GetModelDetailsRequest, options?: { requestId?: string; correlationId?: string }): DesktopModelDetailsReadRequest {
  return createIpcRequest(DESKTOP_MODEL_DETAILS_READ_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelDetailsReadSuccessResponse(result: GetModelDetailsResult, options?: { requestId?: string; correlationId?: string }): DesktopModelDetailsReadResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_DETAILS_READ_RESPONSE_CHANNEL, result, options) as DesktopModelDetailsReadResponse;
}
export function createDesktopModelListRequest(payload: ListModelsRequest = {}, options?: { requestId?: string; correlationId?: string }): DesktopModelListRequest {
  return createIpcRequest(DESKTOP_MODEL_LIST_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelListSuccessResponse(result: ListModelsResult, options?: { requestId?: string; correlationId?: string }): DesktopModelListResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_LIST_RESPONSE_CHANNEL, result, options) as DesktopModelListResponse;
}
export function createDesktopModelReferenceSaveRequest(payload: SaveModelReferenceRequest, options?: { requestId?: string; correlationId?: string }): DesktopModelReferenceSaveRequest {
  return createIpcRequest(DESKTOP_MODEL_REFERENCE_SAVE_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelReferenceSaveSuccessResponse(result: SaveModelReferenceResult, options?: { requestId?: string; correlationId?: string }): DesktopModelReferenceSaveResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_REFERENCE_SAVE_RESPONSE_CHANNEL, result, options) as DesktopModelReferenceSaveResponse;
}
export function createDesktopModelRecordUpdateRequest(payload: UpdateModelRecordRequest, options?: { requestId?: string; correlationId?: string }): DesktopModelRecordUpdateRequest {
  return createIpcRequest(DESKTOP_MODEL_RECORD_UPDATE_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelRecordUpdateSuccessResponse(result: UpdateModelRecordResult, options?: { requestId?: string; correlationId?: string }): DesktopModelRecordUpdateResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_RECORD_UPDATE_RESPONSE_CHANNEL, result, options) as DesktopModelRecordUpdateResponse;
}
export function createDesktopModelRecordDeleteRequest(payload: DeleteModelRecordRequest, options?: { requestId?: string; correlationId?: string }): DesktopModelRecordDeleteRequest {
  return createIpcRequest(DESKTOP_MODEL_RECORD_DELETE_REQUEST_CHANNEL, payload, options);
}
export function createDesktopModelRecordDeleteSuccessResponse(result: DeleteModelRecordResult, options?: { requestId?: string; correlationId?: string }): DesktopModelRecordDeleteResponse {
  return createIpcSuccessResponse(DESKTOP_MODEL_RECORD_DELETE_RESPONSE_CHANNEL, result, options) as DesktopModelRecordDeleteResponse;
}

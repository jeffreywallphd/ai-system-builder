import type { AssetReference } from "../asset";
import { createWorkspaceId, type WorkspaceId } from "../workspace";
import type {
  CopyUserLibraryAssetToWorkspaceCommand, CopyUserLibraryAssetToWorkspaceResult,
  ImportWorkspaceAssetToWorkspaceCommand, ImportWorkspaceAssetToWorkspaceResult,
  LinkUserLibraryAssetToWorkspaceCommand, LinkUserLibraryAssetToWorkspaceResult,
  PromoteWorkspaceAssetToUserLibraryCommand, PromoteWorkspaceAssetToUserLibraryResult,
  UserLibraryAssetId, UserLibraryAssetRecord, UserLibraryAssetRecordStatus, UserLibraryAssetVersion,
  UserLibraryEffectiveSourceSummary, UserLibraryLinkId, UserLibraryPropagationPolicy, UserLibrarySourceKind,
  WorkspaceUserLibraryLinkRecord, WorkspaceUserLibraryLinkStatus,
} from "../user-library";
import { createTransportOperation } from "../transport";
import { createIpcChannel } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import { createIpcError } from "./ipc-error";
import { createIpcFailureResponse, createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_USER_LIBRARY_PROMOTE_OPERATION = createTransportOperation("user-library", "promote-workspace-asset");
export const DESKTOP_USER_LIBRARY_LINK_OPERATION = createTransportOperation("user-library", "link-asset-to-workspace");
export const DESKTOP_USER_LIBRARY_COPY_OPERATION = createTransportOperation("user-library", "copy-asset-to-workspace");
export const DESKTOP_USER_LIBRARY_IMPORT_OPERATION = createTransportOperation("user-library", "import-workspace-asset");
export const DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION = createTransportOperation("user-library", "list-assets");
export const DESKTOP_USER_LIBRARY_ASSET_READ_OPERATION = createTransportOperation("user-library", "read-asset");
export const DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION = createTransportOperation("user-library", "list-workspace-links");
export const DESKTOP_USER_LIBRARY_LINK_READ_OPERATION = createTransportOperation("user-library", "read-workspace-link");
export const DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION = createTransportOperation("user-library", "list-workspace-effective-sources");

export const DESKTOP_USER_LIBRARY_PROMOTE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_PROMOTE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_LINK_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_LINK_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_COPY_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_COPY_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_COPY_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_COPY_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_IMPORT_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_IMPORT_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_IMPORT_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_IMPORT_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_ASSET_LIST_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_ASSET_LIST_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_ASSET_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_ASSET_READ_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_ASSET_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_ASSET_READ_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_LINK_LIST_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_LINK_LIST_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION, "response");
export const DESKTOP_USER_LIBRARY_LINK_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_READ_OPERATION, "request"); export const DESKTOP_USER_LIBRARY_LINK_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_LINK_READ_OPERATION, "response");
export const DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_REQUEST_CHANNEL = createIpcChannel(DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION, "request"); export const DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION, "response");

export interface DesktopUserLibraryAssetListRequestPayload { readonly text?: string; readonly status?: UserLibraryAssetRecordStatus; readonly sourceWorkspaceId?: WorkspaceId; readonly sourceAssetReference?: AssetReference; readonly sourceKind?: UserLibrarySourceKind; readonly limit?: number; readonly cursor?: string; }
export interface DesktopUserLibraryAssetReadRequestPayload { readonly userLibraryAssetId: UserLibraryAssetId; readonly version?: UserLibraryAssetVersion; }
export interface DesktopWorkspaceUserLibraryLinkListRequestPayload { readonly workspaceId: WorkspaceId; readonly status?: WorkspaceUserLibraryLinkStatus; readonly propagationPolicy?: UserLibraryPropagationPolicy; readonly userLibraryAssetReference?: { readonly assetId: UserLibraryAssetId; readonly version: UserLibraryAssetVersion; readonly label?: string; }; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface DesktopWorkspaceUserLibraryLinkReadRequestPayload { readonly workspaceId: WorkspaceId; readonly linkId: UserLibraryLinkId; }
export interface DesktopWorkspaceEffectiveAssetSourceListRequestPayload { readonly workspaceId: WorkspaceId; readonly assetReference?: AssetReference; readonly limit?: number; readonly cursor?: string; }

export const createDesktopUserLibraryPromoteRequest = (payload: PromoteWorkspaceAssetToUserLibraryCommand, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_PROMOTE_REQUEST_CHANNEL, { ...payload, sourceWorkspaceId: createWorkspaceId(payload.sourceWorkspaceId) }, options);
export const createDesktopUserLibraryLinkRequest = (payload: LinkUserLibraryAssetToWorkspaceCommand, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_LINK_REQUEST_CHANNEL, { ...payload, targetWorkspaceId: createWorkspaceId(payload.targetWorkspaceId) }, options);
export const createDesktopUserLibraryCopyRequest = (payload: CopyUserLibraryAssetToWorkspaceCommand, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_COPY_REQUEST_CHANNEL, { ...payload, targetWorkspaceId: createWorkspaceId(payload.targetWorkspaceId) }, options);
export const createDesktopUserLibraryImportRequest = (payload: ImportWorkspaceAssetToWorkspaceCommand, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_IMPORT_REQUEST_CHANNEL, { ...payload, sourceWorkspaceId: createWorkspaceId(payload.sourceWorkspaceId), targetWorkspaceId: createWorkspaceId(payload.targetWorkspaceId) }, options);
export const createDesktopUserLibraryAssetListRequest = (payload: DesktopUserLibraryAssetListRequestPayload = {}, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_ASSET_LIST_REQUEST_CHANNEL, payload, options);
export const createDesktopUserLibraryAssetReadRequest = (payload: DesktopUserLibraryAssetReadRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_ASSET_READ_REQUEST_CHANNEL, payload, options);
export const createDesktopWorkspaceUserLibraryLinkListRequest = (payload: DesktopWorkspaceUserLibraryLinkListRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_LINK_LIST_REQUEST_CHANNEL, { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);
export const createDesktopWorkspaceUserLibraryLinkReadRequest = (payload: DesktopWorkspaceUserLibraryLinkReadRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_LINK_READ_REQUEST_CHANNEL, { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);
export const createDesktopWorkspaceEffectiveAssetSourceListRequest = (payload: DesktopWorkspaceEffectiveAssetSourceListRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_REQUEST_CHANNEL, { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);

type DesktopUserLibraryResponseChannel =
  | typeof DESKTOP_USER_LIBRARY_PROMOTE_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_LINK_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_COPY_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_IMPORT_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_ASSET_LIST_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_ASSET_READ_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_LINK_LIST_RESPONSE_CHANNEL
  | typeof DESKTOP_USER_LIBRARY_LINK_READ_RESPONSE_CHANNEL
  | typeof DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_RESPONSE_CHANNEL;

export const createDesktopUserLibraryOperationSuccessResponse = <TValue>(responseChannel: DesktopUserLibraryResponseChannel, value: TValue, options?: { requestId?: string; correlationId?: string }) => createIpcSuccessResponse(responseChannel as never, value, options);
export const createDesktopUserLibraryFailureResponse = (responseChannel: DesktopUserLibraryResponseChannel, operation: string, code: "validation"|"internal"|"not-found"|"unavailable", message: string, options?: { requestId?: string; correlationId?: string }) => createIpcFailureResponse(createIpcError(responseChannel as never, code, message, { operation: operation as never }));

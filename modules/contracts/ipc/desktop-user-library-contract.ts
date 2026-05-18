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
import { createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_USER_LIBRARY_PROMOTE_OPERATION = createTransportOperation("user-library", "promote-workspace-asset");
export const DESKTOP_USER_LIBRARY_LINK_OPERATION = createTransportOperation("user-library", "link-asset-to-workspace");
export const DESKTOP_USER_LIBRARY_COPY_OPERATION = createTransportOperation("user-library", "copy-asset-to-workspace");
export const DESKTOP_USER_LIBRARY_IMPORT_OPERATION = createTransportOperation("user-library", "import-workspace-asset");
export const DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION = createTransportOperation("user-library", "list-assets");
export const DESKTOP_USER_LIBRARY_ASSET_READ_OPERATION = createTransportOperation("user-library", "read-asset");
export const DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION = createTransportOperation("user-library", "list-workspace-links");
export const DESKTOP_USER_LIBRARY_LINK_READ_OPERATION = createTransportOperation("user-library", "read-workspace-link");
export const DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION = createTransportOperation("user-library", "list-workspace-effective-sources");

export const DESKTOP_USER_LIBRARY_PROMOTE_REQUEST_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, "request");
export const DESKTOP_USER_LIBRARY_PROMOTE_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, "response");

export interface DesktopUserLibraryAssetListRequestPayload { readonly text?: string; readonly status?: UserLibraryAssetRecordStatus; readonly sourceWorkspaceId?: WorkspaceId; readonly sourceAssetReference?: AssetReference; readonly sourceKind?: UserLibrarySourceKind; readonly limit?: number; readonly cursor?: string; }
export interface DesktopUserLibraryAssetReadRequestPayload { readonly userLibraryAssetId: UserLibraryAssetId; readonly version?: UserLibraryAssetVersion; }
export interface DesktopWorkspaceUserLibraryLinkListRequestPayload { readonly workspaceId: WorkspaceId; readonly status?: WorkspaceUserLibraryLinkStatus; readonly propagationPolicy?: UserLibraryPropagationPolicy; readonly userLibraryAssetReference?: { readonly assetId: UserLibraryAssetId; readonly version: UserLibraryAssetVersion; readonly label?: string; }; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface DesktopWorkspaceUserLibraryLinkReadRequestPayload { readonly workspaceId: WorkspaceId; readonly linkId: UserLibraryLinkId; }
export interface DesktopWorkspaceEffectiveAssetSourceListRequestPayload { readonly workspaceId: WorkspaceId; readonly assetReference?: AssetReference; readonly limit?: number; readonly cursor?: string; }

export type DesktopUserLibraryPromoteRequest = IpcRequest<PromoteWorkspaceAssetToUserLibraryCommand, typeof DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, Record<string, never>, typeof DESKTOP_USER_LIBRARY_PROMOTE_REQUEST_CHANNEL.value>;
export type DesktopUserLibraryPromoteResponse = IpcResponse<PromoteWorkspaceAssetToUserLibraryResult, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_PROMOTE_OPERATION, Record<string, never>, typeof DESKTOP_USER_LIBRARY_PROMOTE_RESPONSE_CHANNEL.value>;

export const createDesktopWorkspaceUserLibraryLinkListRequest = (payload: DesktopWorkspaceUserLibraryLinkListRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(createIpcChannel(DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION, "request"), { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);
export const createDesktopWorkspaceUserLibraryLinkReadRequest = (payload: DesktopWorkspaceUserLibraryLinkReadRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(createIpcChannel(DESKTOP_USER_LIBRARY_LINK_READ_OPERATION, "request"), { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);
export const createDesktopWorkspaceEffectiveAssetSourceListRequest = (payload: DesktopWorkspaceEffectiveAssetSourceListRequestPayload, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(createIpcChannel(DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION, "request"), { ...payload, workspaceId: createWorkspaceId(payload.workspaceId) }, options);
export const createDesktopUserLibraryPromoteRequest = (payload: PromoteWorkspaceAssetToUserLibraryCommand, options?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_USER_LIBRARY_PROMOTE_REQUEST_CHANNEL, { ...payload, sourceWorkspaceId: createWorkspaceId(payload.sourceWorkspaceId) }, options);
export const createDesktopUserLibraryPromoteSuccessResponse = (value: PromoteWorkspaceAssetToUserLibraryResult, options?: { requestId?: string; correlationId?: string }) => createIpcSuccessResponse(DESKTOP_USER_LIBRARY_PROMOTE_RESPONSE_CHANNEL, value, options);

export type DesktopUserLibraryAssetListResponse = IpcResponse<{ readonly assets: readonly UserLibraryAssetRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_USER_LIBRARY_ASSET_LIST_OPERATION}.response`>;
export type DesktopWorkspaceUserLibraryLinkListResponse = IpcResponse<{ readonly links: readonly WorkspaceUserLibraryLinkRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_USER_LIBRARY_LINK_LIST_OPERATION}.response`>;
export type DesktopWorkspaceEffectiveAssetSourceListResponse = IpcResponse<{ readonly items: readonly UserLibraryEffectiveSourceSummary[]; readonly nextCursor?: string }, Record<string, unknown>, typeof DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_WORKSPACE_EFFECTIVE_ASSET_SOURCE_LIST_OPERATION}.response`>;
export type DesktopUserLibraryLinkResponse = IpcResponse<LinkUserLibraryAssetToWorkspaceResult, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_LINK_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_USER_LIBRARY_LINK_OPERATION}.response`>;
export type DesktopUserLibraryCopyResponse = IpcResponse<CopyUserLibraryAssetToWorkspaceResult, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_COPY_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_USER_LIBRARY_COPY_OPERATION}.response`>;
export type DesktopUserLibraryImportResponse = IpcResponse<ImportWorkspaceAssetToWorkspaceResult, Record<string, unknown>, typeof DESKTOP_USER_LIBRARY_IMPORT_OPERATION, Record<string, never>, `ipc.${typeof DESKTOP_USER_LIBRARY_IMPORT_OPERATION}.response`>;

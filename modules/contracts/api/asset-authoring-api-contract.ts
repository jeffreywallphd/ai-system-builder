import type {
  AssetAuthoringConflictStatus,
  AssetAuthoringEffectiveSourceSummary,
  AssetCustomizationTargetSourceKind,
  AssetOverrideRecord,
  AssetOverrideStatus,
  AuthoredAssetDraftRecord,
  AuthoredAssetRecord,
  AuthoredAssetRevisionRecord,
  AuthoredAssetId,
  AssetDraftId,
  AssetOverrideId,
  AssetRevisionId,
  CreateAssetDraftCommand,
  CreateAssetOverrideCommand,
  CreateWorkspaceAuthoredAssetCommand,
  DisableAssetOverrideCommand,
  PublishAssetDraftCommand,
  UpdateAssetDraftCommand,
  UpdateAssetOverrideCommand,
} from "../asset-authoring";
import type { WorkspaceId } from "../workspace";
import { createTransportOperation } from "../transport";
import { createApiError } from "./api-error";
import { createApiRequest, type ApiRequest } from "./api-request";
import { createApiFailureResponse, createApiSuccessResponse, type ApiResponse } from "./api-response";

export const API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION = createTransportOperation("asset-authoring", "create-workspace-authored-asset");
export const API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION = createTransportOperation("asset-authoring", "create-draft");
export const API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION = createTransportOperation("asset-authoring", "update-draft");
export const API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION = createTransportOperation("asset-authoring", "publish-draft");
export const API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION = createTransportOperation("asset-authoring", "create-override");
export const API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION = createTransportOperation("asset-authoring", "update-override");
export const API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION = createTransportOperation("asset-authoring", "disable-override");
export const API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION = createTransportOperation("asset-authoring", "list-authored-assets");
export const API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION = createTransportOperation("asset-authoring", "read-authored-asset");
export const API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION = createTransportOperation("asset-authoring", "list-drafts");
export const API_ASSET_AUTHORING_READ_DRAFT_OPERATION = createTransportOperation("asset-authoring", "read-draft");
export const API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION = createTransportOperation("asset-authoring", "list-revisions");
export const API_ASSET_AUTHORING_READ_REVISION_OPERATION = createTransportOperation("asset-authoring", "read-revision");
export const API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION = createTransportOperation("asset-authoring", "list-overrides");
export const API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION = createTransportOperation("asset-authoring", "read-override");
export const API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION = createTransportOperation("asset-authoring", "list-effective-summaries");

export interface ApiAssetAuthoringListAuthoredAssetsRequestPayload { readonly workspaceId: WorkspaceId; readonly status?: AuthoredAssetRecord["status"]; readonly assetKind?: string; readonly authoredAssetId?: AuthoredAssetId; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface ApiAssetAuthoringReadAuthoredAssetRequestPayload { readonly workspaceId: WorkspaceId; readonly authoredAssetId: AuthoredAssetId; }
export interface ApiAssetAuthoringListDraftsRequestPayload { readonly targetWorkspaceId: WorkspaceId; readonly status?: AuthoredAssetDraftRecord["status"]; readonly assetKind?: string; readonly authoredAssetId?: AuthoredAssetId; readonly draftId?: AssetDraftId; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface ApiAssetAuthoringReadDraftRequestPayload { readonly targetWorkspaceId: WorkspaceId; readonly draftId: AssetDraftId; }
export interface ApiAssetAuthoringListRevisionsRequestPayload { readonly workspaceId: WorkspaceId; readonly status?: AuthoredAssetRevisionRecord["status"]; readonly assetKind?: string; readonly authoredAssetId?: AuthoredAssetId; readonly revisionId?: AssetRevisionId; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface ApiAssetAuthoringReadRevisionRequestPayload { readonly workspaceId: WorkspaceId; readonly revisionId: AssetRevisionId; }
export interface ApiAssetAuthoringListOverridesRequestPayload { readonly targetWorkspaceId: WorkspaceId; readonly status?: AssetOverrideStatus; readonly conflictStatus?: AssetAuthoringConflictStatus; readonly assetKind?: string; readonly authoredAssetId?: AuthoredAssetId; readonly draftId?: AssetDraftId; readonly overrideId?: AssetOverrideId; readonly sourceKind?: AssetCustomizationTargetSourceKind; readonly text?: string; readonly limit?: number; readonly cursor?: string; }
export interface ApiAssetAuthoringReadOverrideRequestPayload { readonly targetWorkspaceId: WorkspaceId; readonly overrideId: AssetOverrideId; }
export interface ApiAssetAuthoringListEffectiveSummariesRequestPayload { readonly targetWorkspaceId: WorkspaceId; readonly sourceKind?: AssetAuthoringEffectiveSourceSummary["effectiveSourceKind"]; readonly conflictStatus?: AssetAuthoringConflictStatus; readonly assetKind?: string; readonly authoredAssetId?: AuthoredAssetId; readonly draftId?: AssetDraftId; readonly overrideId?: AssetOverrideId; readonly text?: string; readonly limit?: number; readonly cursor?: string; }

export type ApiAssetAuthoringCreateWorkspaceAuthoredAssetRequest = ApiRequest<CreateWorkspaceAuthoredAssetCommand, typeof API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringCreateDraftRequest = ApiRequest<CreateAssetDraftCommand, typeof API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringUpdateDraftRequest = ApiRequest<UpdateAssetDraftCommand, typeof API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringPublishDraftRequest = ApiRequest<PublishAssetDraftCommand, typeof API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringCreateOverrideRequest = ApiRequest<CreateAssetOverrideCommand, typeof API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringUpdateOverrideRequest = ApiRequest<UpdateAssetOverrideCommand, typeof API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringDisableOverrideRequest = ApiRequest<DisableAssetOverrideCommand, typeof API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListAuthoredAssetsRequest = ApiRequest<ApiAssetAuthoringListAuthoredAssetsRequestPayload, typeof API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadAuthoredAssetRequest = ApiRequest<ApiAssetAuthoringReadAuthoredAssetRequestPayload, typeof API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListDraftsRequest = ApiRequest<ApiAssetAuthoringListDraftsRequestPayload, typeof API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadDraftRequest = ApiRequest<ApiAssetAuthoringReadDraftRequestPayload, typeof API_ASSET_AUTHORING_READ_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListRevisionsRequest = ApiRequest<ApiAssetAuthoringListRevisionsRequestPayload, typeof API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadRevisionRequest = ApiRequest<ApiAssetAuthoringReadRevisionRequestPayload, typeof API_ASSET_AUTHORING_READ_REVISION_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListOverridesRequest = ApiRequest<ApiAssetAuthoringListOverridesRequestPayload, typeof API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadOverrideRequest = ApiRequest<ApiAssetAuthoringReadOverrideRequestPayload, typeof API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListEffectiveSummariesRequest = ApiRequest<ApiAssetAuthoringListEffectiveSummariesRequestPayload, typeof API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION, Record<string, never>>;

export type ApiAssetAuthoringCreateWorkspaceAuthoredAssetResponse = ApiResponse<AuthoredAssetRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringCreateDraftResponse = ApiResponse<AuthoredAssetDraftRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringUpdateDraftResponse = ApiResponse<AuthoredAssetDraftRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringPublishDraftResponse = ApiResponse<AuthoredAssetRevisionRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringCreateOverrideResponse = ApiResponse<AssetOverrideRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringUpdateOverrideResponse = ApiResponse<AssetOverrideRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringDisableOverrideResponse = ApiResponse<AssetOverrideRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListAuthoredAssetsResponse = ApiResponse<{ readonly assets: readonly AuthoredAssetRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadAuthoredAssetResponse = ApiResponse<AuthoredAssetRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListDraftsResponse = ApiResponse<{ readonly drafts: readonly AuthoredAssetDraftRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadDraftResponse = ApiResponse<AuthoredAssetDraftRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_READ_DRAFT_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListRevisionsResponse = ApiResponse<{ readonly revisions: readonly AuthoredAssetRevisionRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadRevisionResponse = ApiResponse<AuthoredAssetRevisionRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_READ_REVISION_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListOverridesResponse = ApiResponse<{ readonly overrides: readonly AssetOverrideRecord[]; readonly nextCursor?: string }, Record<string, unknown>, typeof API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringReadOverrideResponse = ApiResponse<AssetOverrideRecord, Record<string, unknown>, typeof API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION, Record<string, never>>;
export type ApiAssetAuthoringListEffectiveSummariesResponse = ApiResponse<{ readonly items: readonly AssetAuthoringEffectiveSourceSummary[]; readonly nextCursor?: string }, Record<string, unknown>, typeof API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION, Record<string, never>>;

export const createApiAssetAuthoringOperationSuccessResponse = <TOperation extends string, TValue>(operation: TOperation, value: TValue, options?: { requestId?: string; correlationId?: string }) => createApiSuccessResponse(operation as never, value, options);
export const createApiAssetAuthoringFailureResponse = (operation: string, code: "validation"|"internal"|"not-found"|"unavailable", message: string, options?: { requestId?: string; correlationId?: string; details?: Record<string, unknown> }) => createApiFailureResponse(createApiError(operation as never, code, message, options), options);

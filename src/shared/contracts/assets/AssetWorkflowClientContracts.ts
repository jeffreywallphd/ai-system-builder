import type {
  AssetDetailDto,
  AssetDownloadAuthorizationDto,
  AssetPreviewResolutionDto,
  AssetSummaryDto,
} from "./AssetTransportContracts";

export class AssetWorkflowClientContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetWorkflowClientContractError";
  }
}

export const AssetWorkflowClientContractVersions = Object.freeze({
  v1: "asset-workflow-client/v1",
});

export type AssetWorkflowClientContractVersion =
  typeof AssetWorkflowClientContractVersions[keyof typeof AssetWorkflowClientContractVersions];

export const AssetWorkflowTransportRoutes = Object.freeze({
  listAssets: "/api/v1/assets",
  getAssetDetail: "/api/v1/assets/:assetId",
  initiateUpload: "/api/v1/assets/:assetId/uploads/initiate",
  uploadSessionContent: "/api/v1/assets/upload-sessions/:uploadSessionId/content",
  authorizeDownload: "/api/v1/assets/:assetId/downloads/authorize",
  downloadContent: "/api/v1/assets/:assetId/downloads/content",
  resolvePreview: "/api/v1/assets/:assetId/preview",
} as const);

export interface AssetWorkflowUploadInitiationRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly storageInstanceId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly area?: "input" | "output" | "reference";
  readonly expiresInSeconds?: number;
}

export interface AssetWorkflowUploadInitiationResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly asset: AssetDetailDto;
  readonly upload: {
    readonly uploadSessionId: string;
    readonly assetId: string;
    readonly workspaceId: string;
    readonly area: "input" | "output" | "reference";
    readonly uploadEndpoint: string;
    readonly uploadMethod: "POST";
    readonly expected: {
      readonly fileName: string;
      readonly mimeType: string;
      readonly sizeBytes: number;
    };
    readonly expiresAt: string;
  };
}

export interface AssetWorkflowListRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly scope?: "private" | "workspace" | "all";
  readonly ownerUserId?: string;
  readonly createdByUserId?: string;
  readonly storageInstanceId?: string;
  readonly assetKinds?: ReadonlyArray<"uploaded-file" | "generated-output" | "preview" | "derived">;
  readonly visibilities?: ReadonlyArray<"private" | "workspace" | "shared" | "published">;
  readonly lifecycleStates?: ReadonlyArray<"active" | "archived" | "deleted">;
  readonly sourceAssetId?: string;
  readonly sourceAssetVersionId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AssetWorkflowListResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly items: ReadonlyArray<AssetSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface AssetWorkflowDetailRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly includeDeleted?: boolean;
}

export interface AssetWorkflowDetailResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly asset: AssetDetailDto;
}

export interface AssetWorkflowDownloadActionRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly purpose: "download" | "inline-preview" | "worker-process";
  readonly fileNameHint?: string;
  readonly expiresInSeconds?: number;
}

export interface AssetWorkflowDownloadActionResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly authorization: AssetDownloadAuthorizationDto;
  readonly downloadPath: string;
}

export interface AssetWorkflowPreviewRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly preferredMimeTypes?: ReadonlyArray<string>;
}

export interface AssetWorkflowPreviewResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly preview: AssetPreviewResolutionDto;
}

export interface AssetWorkflowUploadContentRequest {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly workspaceId: string;
  readonly uploadSessionId: string;
  readonly contentType?: string;
}

export interface AssetWorkflowUploadContentResponse {
  readonly contractVersion: AssetWorkflowClientContractVersion;
  readonly asset: AssetDetailDto;
  readonly uploadSessionId: string;
  readonly finalizedVersionId: string;
  readonly content: {
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly checksum: {
      readonly algorithm: "sha256";
      readonly digest: string;
    };
    readonly originalFileName?: string;
  };
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetWorkflowClientContractError(`${field} is required.`);
  }
  return normalized;
}

function appendOptional(query: URLSearchParams, key: string, value?: string): void {
  const normalized = value?.trim();
  if (normalized) {
    query.set(key, normalized);
  }
}

function appendOptionalList(query: URLSearchParams, key: string, values?: ReadonlyArray<string>): void {
  for (const entry of values ?? []) {
    const normalized = entry.trim();
    if (normalized) {
      query.append(key, normalized);
    }
  }
}

export function toAssetWorkflowListQueryParams(request: AssetWorkflowListRequest): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  appendOptional(query, "scope", request.scope);
  appendOptional(query, "ownerUserId", request.ownerUserId);
  appendOptional(query, "createdByUserId", request.createdByUserId);
  appendOptional(query, "storageInstanceId", request.storageInstanceId);
  appendOptionalList(query, "assetKind", request.assetKinds);
  appendOptionalList(query, "visibility", request.visibilities);
  appendOptionalList(query, "lifecycleState", request.lifecycleStates);
  appendOptional(query, "sourceAssetId", request.sourceAssetId);
  appendOptional(query, "sourceAssetVersionId", request.sourceAssetVersionId);
  if (typeof request.limit === "number") {
    query.set("limit", String(request.limit));
  }
  if (typeof request.offset === "number") {
    query.set("offset", String(request.offset));
  }
  return query;
}

export function toAssetWorkflowDetailQueryParams(request: AssetWorkflowDetailRequest): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  if (typeof request.includeDeleted === "boolean") {
    query.set("includeDeleted", request.includeDeleted ? "true" : "false");
  }
  return query;
}

export function toAssetWorkflowPreviewQueryParams(request: AssetWorkflowPreviewRequest): URLSearchParams {
  const query = new URLSearchParams();
  query.set("workspaceId", normalizeRequired(request.workspaceId, "workspaceId"));
  appendOptional(query, "versionId", request.versionId);
  appendOptionalList(query, "preferredMimeType", request.preferredMimeTypes);
  return query;
}

export function buildAuthorizedAssetDownloadPath(params: {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly contentToken: string;
}): string {
  const workspaceId = encodeURIComponent(normalizeRequired(params.workspaceId, "workspaceId"));
  const assetId = encodeURIComponent(normalizeRequired(params.assetId, "assetId"));
  const contentToken = encodeURIComponent(normalizeRequired(params.contentToken, "contentToken"));
  return `${AssetWorkflowTransportRoutes.downloadContent.replace(":assetId", assetId)}?workspaceId=${workspaceId}&contentToken=${contentToken}`;
}

export function buildAssetUploadSessionContentPath(params: {
  readonly workspaceId: string;
  readonly uploadSessionId: string;
}): string {
  const workspaceId = encodeURIComponent(normalizeRequired(params.workspaceId, "workspaceId"));
  const uploadSessionId = encodeURIComponent(normalizeRequired(params.uploadSessionId, "uploadSessionId"));
  return `${AssetWorkflowTransportRoutes.uploadSessionContent.replace(":uploadSessionId", uploadSessionId)}?workspaceId=${workspaceId}`;
}

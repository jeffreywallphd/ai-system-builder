import type {
  AssetManagementApiResponse,
  AssetManagementApiError,
} from "@infrastructure/api/assets/sdk/PublicAssetManagementApiContract";
import {
  AssetWorkflowClientContractVersions,
  AssetWorkflowTransportRoutes,
  buildAssetUploadSessionContentPath,
  buildAuthorizedAssetDownloadPath,
  toAssetWorkflowDetailQueryParams,
  toAssetWorkflowListQueryParams,
  toAssetWorkflowPreviewQueryParams,
  type AssetWorkflowDetailRequest,
  type AssetWorkflowDetailResponse,
  type AssetWorkflowDownloadActionRequest,
  type AssetWorkflowDownloadActionResponse,
  type AssetWorkflowListRequest,
  type AssetWorkflowListResponse,
  type AssetWorkflowPreviewRequest,
  type AssetWorkflowPreviewResponse,
  type AssetWorkflowUploadContentRequest,
  type AssetWorkflowUploadContentResponse,
  type AssetWorkflowUploadInitiationRequest,
  type AssetWorkflowUploadInitiationResponse,
} from "@shared/contracts/assets/AssetWorkflowClientContracts";

export interface AssetWorkflowClient {
  initiateUpload(
    request: Omit<AssetWorkflowUploadInitiationRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowUploadInitiationResponse>>;
  uploadContent(
    request: Omit<AssetWorkflowUploadContentRequest, "contractVersion">,
    content: Uint8Array,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowUploadContentResponse>>;
  listAssets(
    request: Omit<AssetWorkflowListRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowListResponse>>;
  getAssetDetail(
    request: Omit<AssetWorkflowDetailRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowDetailResponse>>;
  authorizeDownload(
    request: Omit<AssetWorkflowDownloadActionRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowDownloadActionResponse>>;
  resolvePreview(
    request: Omit<AssetWorkflowPreviewRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowPreviewResponse>>;
}

export class HttpAssetWorkflowClient implements AssetWorkflowClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async initiateUpload(
    request: Omit<AssetWorkflowUploadInitiationRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowUploadInitiationResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);

    const response = await this.post<AssetManagementApiResponse<{
      readonly asset: AssetWorkflowUploadInitiationResponse["asset"];
      readonly upload: AssetWorkflowUploadInitiationResponse["upload"];
    }>>(
      `${AssetWorkflowTransportRoutes.initiateUpload.replace(":assetId", encodeURIComponent(request.assetId))}${toQuerySuffix(query)}`,
      {
        storageInstanceId: request.storageInstanceId,
        fileName: request.fileName,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        area: request.area,
        expiresInSeconds: request.expiresInSeconds,
      },
      sessionToken,
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowUploadInitiationResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        asset: response.data.asset,
        upload: response.data.upload,
      }),
    });
  }

  public async uploadContent(
    request: Omit<AssetWorkflowUploadContentRequest, "contractVersion">,
    content: Uint8Array,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowUploadContentResponse>> {
    const path = buildAssetUploadSessionContentPath({
      workspaceId: request.workspaceId,
      uploadSessionId: request.uploadSessionId,
    });
    const response = await this.request<AssetManagementApiResponse<Omit<AssetWorkflowUploadContentResponse, "contractVersion">>>(
      "POST",
      path,
      sessionToken,
      content,
      request.contentType ?? "application/octet-stream",
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowUploadContentResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        asset: response.data.asset,
        uploadSessionId: response.data.uploadSessionId,
        finalizedVersionId: response.data.finalizedVersionId,
        content: response.data.content,
      }),
    });
  }

  public async listAssets(
    request: Omit<AssetWorkflowListRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowListResponse>> {
    const response = await this.get<AssetManagementApiResponse<{
      readonly items: AssetWorkflowListResponse["items"];
      readonly pagination: AssetWorkflowListResponse["pagination"];
    }>>(
      `${AssetWorkflowTransportRoutes.listAssets}${toQuerySuffix(toAssetWorkflowListQueryParams({
        ...request,
        contractVersion: AssetWorkflowClientContractVersions.v1,
      }))}`,
      sessionToken,
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowListResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        items: response.data.items,
        pagination: response.data.pagination,
      }),
    });
  }

  public async getAssetDetail(
    request: Omit<AssetWorkflowDetailRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowDetailResponse>> {
    const response = await this.get<AssetManagementApiResponse<{ readonly asset: AssetWorkflowDetailResponse["asset"] }>>(
      `${AssetWorkflowTransportRoutes.getAssetDetail.replace(":assetId", encodeURIComponent(request.assetId))}${toQuerySuffix(toAssetWorkflowDetailQueryParams({
        ...request,
        contractVersion: AssetWorkflowClientContractVersions.v1,
      }))}`,
      sessionToken,
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowDetailResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        asset: response.data.asset,
      }),
    });
  }

  public async authorizeDownload(
    request: Omit<AssetWorkflowDownloadActionRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowDownloadActionResponse>> {
    const query = new URLSearchParams();
    query.set("workspaceId", request.workspaceId);

    const response = await this.post<AssetManagementApiResponse<{
      readonly authorization: AssetWorkflowDownloadActionResponse["authorization"];
    }>>(
      `${AssetWorkflowTransportRoutes.authorizeDownload.replace(":assetId", encodeURIComponent(request.assetId))}${toQuerySuffix(query)}`,
      {
        versionId: request.versionId,
        purpose: request.purpose,
        fileNameHint: request.fileNameHint,
        expiresInSeconds: request.expiresInSeconds,
      },
      sessionToken,
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowDownloadActionResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        authorization: response.data.authorization,
        downloadPath: buildAuthorizedAssetDownloadPath({
          workspaceId: request.workspaceId,
          assetId: request.assetId,
          contentToken: response.data.authorization.contentToken,
        }),
      }),
    });
  }

  public async resolvePreview(
    request: Omit<AssetWorkflowPreviewRequest, "contractVersion">,
    sessionToken: string,
  ): Promise<AssetManagementApiResponse<AssetWorkflowPreviewResponse>> {
    const response = await this.get<AssetManagementApiResponse<{ readonly preview: AssetWorkflowPreviewResponse["preview"] }>>(
      `${AssetWorkflowTransportRoutes.resolvePreview.replace(":assetId", encodeURIComponent(request.assetId))}${toQuerySuffix(toAssetWorkflowPreviewQueryParams({
        ...request,
        contractVersion: AssetWorkflowClientContractVersions.v1,
      }))}`,
      sessionToken,
    );

    if (!response.ok || !response.data) {
      return response as AssetManagementApiResponse<AssetWorkflowPreviewResponse>;
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        contractVersion: AssetWorkflowClientContractVersions.v1,
        preview: response.data.preview,
      }),
    });
  }

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>> | Uint8Array,
    sessionToken: string,
    contentType = "application/json",
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", path, sessionToken, body, contentType);
  }

  private async request<TResponse>(
    method: "GET" | "POST",
    path: string,
    sessionToken: string,
    body?: Readonly<Record<string, unknown>> | Uint8Array,
    contentType = "application/json",
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": contentType,
        authorization: `Bearer ${sessionToken}`,
      },
      body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
    });
    return await response.json() as TResponse;
  }
}

function toQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function toUserFacingAssetWorkflowError(
  error: AssetManagementApiError | undefined,
  fallback: string,
): string {
  return error?.message?.trim() || fallback;
}


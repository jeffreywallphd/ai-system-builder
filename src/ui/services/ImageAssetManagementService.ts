import {
  ImageAssetTransportRoutes,
} from "@shared/contracts/assets/ImageAssetTransportContracts";
import type {
  CreateImageAssetApiRequest,
  CreateImageAssetApiResponse,
  GetImageAssetMetadataApiResponse,
  ImageAssetManagementApiError,
  ImageAssetManagementApiResponse,
  ListImageAssetMetadataApiResponse,
} from "@infrastructure/api/image-assets/sdk/PublicImageAssetManagementApiContract";
import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export interface UploadStudioImageAssetRequest {
  readonly file: File;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly sessionToken: string;
}

export interface RecentStudioImageAsset {
  readonly assetId: string;
  readonly originalFilename: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly lifecycleStatus: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class ImageAssetManagementService {
  private readonly baseUrl: string;

  public constructor(baseUrl: string = resolveImageAssetApiBaseUrl()) {
    this.baseUrl = baseUrl;
  }

  public async uploadStudioSourceImage(request: UploadStudioImageAssetRequest): Promise<ImageAssetManagementApiResponse<{ readonly assetId: string }>> {
    const mimeType = this.normalizeMediaType(request.file.type);
    if (!mimeType) {
      return this.failed("invalid-request", "This image type is not supported.");
    }

    const fingerprint = await this.computeSha256Digest(request.file);
    const createRequest: CreateImageAssetApiRequest = Object.freeze({
      actorUserIdentityId: request.actorUserIdentityId,
      workspaceId: request.workspaceId,
      ownerUserIdentityId: request.actorUserIdentityId,
      originKind: "uploaded-source",
      visibility: "workspace",
      mediaType: mimeType,
      originalFilename: request.file.name,
      normalizedFilename: request.file.name,
      sizeBytes: request.file.size,
      fingerprint: Object.freeze({
        algorithm: "sha256",
        digest: fingerprint,
      }),
    });

    const created = await this.requestJson<CreateImageAssetApiResponse>("POST", ImageAssetTransportRoutes.createImageAsset, {
      sessionToken: request.sessionToken,
      body: createRequest,
    });
    if (!created.ok || !created.data) {
      return created as ImageAssetManagementApiResponse<{ readonly assetId: string }>;
    }

    const uploadContentResponse = await fetch(`${this.baseUrl}${created.data.upload.uploadEndpoint}`, {
      method: created.data.upload.uploadMethod,
      headers: {
        authorization: `Bearer ${request.sessionToken}`,
        "content-type": mimeType,
      },
      body: await request.file.arrayBuffer(),
    });
    const uploaded = await uploadContentResponse.json() as ImageAssetManagementApiResponse<unknown>;
    if (!uploaded.ok) {
      return uploaded as ImageAssetManagementApiResponse<{ readonly assetId: string }>;
    }

    const completePath = `/api/v1/image-assets/${encodeURIComponent(created.data.asset.assetId)}/uploads/${encodeURIComponent(created.data.upload.uploadSessionId)}/complete`;
    const completed = await this.requestJson<unknown>("POST", completePath, {
      sessionToken: request.sessionToken,
      body: Object.freeze({
        actorUserIdentityId: request.actorUserIdentityId,
        workspaceId: request.workspaceId,
        assetId: created.data.asset.assetId,
        uploadSessionId: created.data.upload.uploadSessionId,
        finalizedMediaType: mimeType,
        expectedSizeBytes: request.file.size,
        expectedChecksumSha256: fingerprint,
        expectedFingerprint: Object.freeze({
          algorithm: "sha256",
          digest: fingerprint,
        }),
      }),
    });
    if (!completed.ok) {
      return completed as ImageAssetManagementApiResponse<{ readonly assetId: string }>;
    }

    return {
      ok: true,
      data: Object.freeze({
        assetId: created.data.asset.assetId,
      }),
    };
  }

  public async listRecentImageAssets(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly sessionToken: string;
    readonly limit?: number;
  }): Promise<ImageAssetManagementApiResponse<ReadonlyArray<RecentStudioImageAsset>>> {
    const query = new URLSearchParams();
    query.set("workspaceId", input.workspaceId);
    query.set("ownerUserIdentityId", input.actorUserIdentityId);
    query.set("status", "available");
    query.set("originKind", "uploaded-source");
    query.set("limit", String(input.limit ?? 8));
    query.set("offset", "0");

    const listed = await this.requestJson<ListImageAssetMetadataApiResponse>(
      "GET",
      `${ImageAssetTransportRoutes.listImageAssets}?${query.toString()}`,
      { sessionToken: input.sessionToken },
    );
    if (!listed.ok || !listed.data) {
      return listed as ImageAssetManagementApiResponse<ReadonlyArray<RecentStudioImageAsset>>;
    }

    return {
      ok: true,
      data: Object.freeze(listed.data.items.map((item) => Object.freeze({
        assetId: item.assetId,
        originalFilename: item.normalizedFilename,
        mediaType: item.mediaType,
        sizeBytes: item.sizeBytes,
        lifecycleStatus: item.lifecycle.status,
        createdAt: item.ownership.createdAt,
        updatedAt: item.ownership.updatedAt,
      }))),
    };
  }

  public async getImageAsset(input: {
    readonly assetId: string;
    readonly workspaceId: string;
    readonly sessionToken: string;
  }): Promise<ImageAssetManagementApiResponse<GetImageAssetMetadataApiResponse>> {
    const path = `${ImageAssetTransportRoutes.getImageAsset.replace(":assetId", encodeURIComponent(input.assetId))}?workspaceId=${encodeURIComponent(input.workspaceId)}`;
    return this.requestJson<GetImageAssetMetadataApiResponse>("GET", path, {
      sessionToken: input.sessionToken,
    });
  }

  private normalizeMediaType(value: string): CreateImageAssetApiRequest["mediaType"] | undefined {
    if (value === "image/png" || value === "image/jpeg" || value === "image/webp") {
      return value;
    }
    return undefined;
  }

  private async computeSha256Digest(file: File): Promise<string> {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("");
  }

  private async requestJson<TData>(
    method: "GET" | "POST",
    path: string,
    options: {
      readonly sessionToken: string;
      readonly body?: unknown;
    },
  ): Promise<ImageAssetManagementApiResponse<TData>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.sessionToken}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return await response.json() as ImageAssetManagementApiResponse<TData>;
  }

  private failed(code: ImageAssetManagementApiError["code"], message: string): ImageAssetManagementApiResponse<never> {
    return {
      ok: false,
      error: {
        code,
        message,
      },
    };
  }
}

function resolveImageAssetApiBaseUrl(): string {
  return resolveDesktopIdentityApiBaseUrl() ?? resolveWebIdentityApiBaseUrl();
}

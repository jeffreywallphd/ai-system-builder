import {
  ImageAssetTransportRoutes,
  toImageAssetListQueryParams,
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

export interface ImageLibraryStudioImageAsset extends RecentStudioImageAsset {
  readonly visibility: string;
  readonly previewAvailable: boolean;
}

export interface ImageLibraryStudioImageAssetPage {
  readonly items: ReadonlyArray<ImageLibraryStudioImageAsset>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface ImageAssetOriginalContent {
  readonly assetId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly payloadBase64: string;
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

    console.log("------------------------------------------------------");
    console.log(" ");
    console.log("Incoming Request:");
    console.log(request);
    console.log(" ");
    console.log("------------------------------------------------------");

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

    console.log("------------------------------------------------------");
    console.log(" ");
    console.log("Configured Request:");
    console.log(createRequest);
    console.log(" ");
    console.log("------------------------------------------------------");

    const created = await this.requestJson<CreateImageAssetApiResponse>("POST", ImageAssetTransportRoutes.createImageAsset, {
      sessionToken: request.sessionToken,
      body: createRequest,
    });

    console.log("------------------------------------------------------");
    console.log(" ");
    console.log("Response:");
    console.log(created);
    console.log(" ");
    console.log("------------------------------------------------------");

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
    const listed = await this.listImageLibraryImageAssets({
      actorUserIdentityId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      sessionToken: input.sessionToken,
      limit: input.limit ?? 8,
      offset: 0,
    });
    if (!listed.ok || !listed.data) {
      return listed as ImageAssetManagementApiResponse<ReadonlyArray<RecentStudioImageAsset>>;
    }
    return {
      ok: true,
      data: listed.data.items,
    };
  }

  public async listImageLibraryImageAssets(input: {
    readonly actorUserIdentityId: string;
    readonly workspaceId: string;
    readonly sessionToken: string;
    readonly search?: string;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ImageAssetManagementApiResponse<ImageLibraryStudioImageAssetPage>> {
    const query = toImageAssetListQueryParams({
      workspaceId: input.workspaceId,
      filters: {
        ownerUserIds: [input.actorUserIdentityId],
        statuses: ["available"],
        originKinds: ["uploaded-source"],
        search: input.search,
        limit: input.limit ?? 24,
        offset: input.offset ?? 0,
      },
    });

    const listed = await this.requestJson<ListImageAssetMetadataApiResponse>(
      "GET",
      `${ImageAssetTransportRoutes.listImageAssets}?${query.toString()}`,
      { sessionToken: input.sessionToken },
    );
    if (!listed.ok || !listed.data) {
      return listed as ImageAssetManagementApiResponse<ImageLibraryStudioImageAssetPage>;
    }

    return {
      ok: true,
      data: Object.freeze({
        items: Object.freeze(listed.data.items.map((item) => Object.freeze({
          assetId: item.assetId,
          originalFilename: item.normalizedFilename,
          mediaType: item.mediaType,
          sizeBytes: item.sizeBytes,
          lifecycleStatus: item.lifecycle.status,
          createdAt: item.ownership.createdAt,
          updatedAt: item.ownership.updatedAt,
          visibility: item.visibility,
          previewAvailable: item.preview.available,
        }))),
        pagination: Object.freeze({
          limit: listed.data.pagination.limit,
          offset: listed.data.pagination.offset,
          returned: listed.data.pagination.returned,
          hasMore: listed.data.pagination.hasMore,
        }),
      }),
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

  public async getImageAssetOriginalContent(input: {
    readonly assetId: string;
    readonly workspaceId: string;
    readonly sessionToken: string;
  }): Promise<ImageAssetManagementApiResponse<ImageAssetOriginalContent>> {
    const route = ImageAssetTransportRoutes.getOriginalContent.replace(":assetId", encodeURIComponent(input.assetId));
    const response = await fetch(`${this.baseUrl}${route}?workspaceId=${encodeURIComponent(input.workspaceId)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.sessionToken}`,
      },
    });
    if (!response.ok) {
      try {
        return await response.json() as ImageAssetManagementApiResponse<ImageAssetOriginalContent>;
      } catch {
        return this.failed("internal", "Image content could not be loaded.");
      }
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = this.normalizeResponseMediaType(response.headers.get("content-type")) ?? "image/png";
    const fileName = this.parseContentDispositionFileName(response.headers.get("content-disposition"))
      ?? `image-${input.assetId}.png`;
    return {
      ok: true,
      data: Object.freeze({
        assetId: input.assetId,
        fileName,
        mimeType,
        sizeBytes: bytes.byteLength,
        payloadBase64: this.encodeBytesToBase64(bytes),
      }),
    };
  }

  private normalizeMediaType(value: string): CreateImageAssetApiRequest["mediaType"] | undefined {
    if (value === "image/png" || value === "image/jpeg" || value === "image/gif" || value === "image/webp") {
      return value;
    }
    return undefined;
  }

  private normalizeResponseMediaType(value: string | null): CreateImageAssetApiRequest["mediaType"] | undefined {
    const normalized = value?.split(";")[0]?.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    return this.normalizeMediaType(normalized);
  }

  private parseContentDispositionFileName(value: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    const quoted = /filename="([^"]+)"/i.exec(value);
    if (quoted?.[1]) {
      return quoted[1];
    }
    const unquoted = /filename=([^;]+)/i.exec(value);
    return unquoted?.[1]?.trim();
  }

  private encodeBytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
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

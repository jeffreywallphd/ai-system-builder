import type {
  ImageAssetDetailDto,
  ImageAssetSummaryDto,
} from "@shared/contracts/assets/ImageAssetTransportContracts";
import type { ImageAssetFingerprint } from "@domain/image-assets/ImageAssetDomain";
import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";

export const ImageAssetManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  invalidState: "invalid-state",
  internal: "internal",
} as const);

export type ImageAssetManagementApiErrorCode =
  typeof ImageAssetManagementApiErrorCodes[keyof typeof ImageAssetManagementApiErrorCodes];

export interface ImageAssetManagementApiError {
  readonly code: ImageAssetManagementApiErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageAssetManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: ImageAssetManagementApiError;
}

export interface CreateImageAssetApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly assetId?: string;
  readonly ownerUserIdentityId?: string;
  readonly storageInstanceId?: string;
  readonly visibility?: ResourceVisibility;
  readonly sharingPolicy?: ImageAssetDetailDto["sharingPolicy"];
  readonly originKind?: ImageAssetDetailDto["originKind"];
  readonly mediaType: ImageAssetDetailDto["mediaType"];
  readonly originalFilename: string;
  readonly normalizedFilename?: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetFingerprint;
  readonly lineage?: ImageAssetDetailDto["lineage"];
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface CreateImageAssetApiResponse {
  readonly asset: ImageAssetDetailDto;
  readonly upload: {
    readonly uploadSessionId: string;
    readonly uploadEndpoint: string;
    readonly uploadMethod: "POST";
    readonly expected: {
      readonly fileName: string;
      readonly mediaType: ImageAssetDetailDto["mediaType"];
      readonly sizeBytes: number;
    };
    readonly expiresAt?: string;
  };
}

export interface IngestImageAssetUploadContentApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly contentType?: string;
  readonly content: AsyncIterable<Uint8Array>;
  readonly expectedSizeBytes?: number;
  readonly expectedChecksumSha256?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface IngestImageAssetUploadContentApiResponse {
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
  readonly writtenAt: string;
}

export interface CompleteImageAssetUploadApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly operationKey?: string;
  readonly finalizedMediaType?: ImageAssetDetailDto["mediaType"];
  readonly expectedSizeBytes?: number;
  readonly expectedChecksumSha256?: string;
  readonly expectedFingerprint?: ImageAssetFingerprint;
  readonly cleanupOnFailure?: boolean;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface CompleteImageAssetUploadApiResponse {
  readonly asset: ImageAssetDetailDto;
  readonly uploadSessionId: string;
  readonly finalizedAt: string;
}

export interface GetImageAssetMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly includeDeleted?: boolean;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface GetImageAssetMetadataApiResponse {
  readonly asset: ImageAssetDetailDto;
}

export interface ListImageAssetMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly ownerUserIdentityIds?: ReadonlyArray<string>;
  readonly originKinds?: ReadonlyArray<ImageAssetSummaryDto["originKind"]>;
  readonly lifecycleStatuses?: ReadonlyArray<ImageAssetSummaryDto["lifecycle"]["status"]>;
  readonly visibilities?: ReadonlyArray<ImageAssetSummaryDto["visibility"]>;
  readonly mediaTypes?: ReadonlyArray<ImageAssetSummaryDto["mediaType"]>;
  readonly storageInstanceIds?: ReadonlyArray<string>;
  readonly sourceRunIds?: ReadonlyArray<string>;
  readonly generationOperationIds?: ReadonlyArray<string>;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly includeDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ListImageAssetMetadataApiResponse {
  readonly items: ReadonlyArray<ImageAssetSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface OpenImageAssetOriginalContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenImageAssetOriginalContentStreamApiResponse {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly mimeType: ImageAssetDetailDto["mediaType"];
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface RequestImageAssetPreviewApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly representation?: "original" | "gallery" | "thumbnail";
  readonly preferredMediaTypes?: ReadonlyArray<ImageAssetDetailDto["mediaType"]>;
  readonly expiresInSeconds?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface RequestImageAssetPreviewApiResponse {
  readonly preview: {
    readonly assetId: string;
    readonly workspaceId: string;
    readonly representation: "original" | "gallery" | "thumbnail";
    readonly status: "available" | "pending-generation" | "unavailable";
    readonly mediaType?: ImageAssetDetailDto["mediaType"];
    readonly resolvedFrom: "original-fallback" | "derived-preview";
    readonly access?: {
      readonly previewToken: string;
      readonly expiresAt: string;
      readonly contentEndpoint: string;
    };
  };
}

export interface OpenImageAssetPreviewContentStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly previewToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenImageAssetPreviewContentStreamApiResponse {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly mimeType: ImageAssetDetailDto["mediaType"];
  readonly sizeBytes: number;
  readonly contentDisposition: "inline";
  readonly contentDispositionFileName: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

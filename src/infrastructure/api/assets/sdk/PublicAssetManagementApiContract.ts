import type { AssetStorageArea } from "../../../../domain/assets/AssetDomain";
import type {
  AssetDetailDto,
  AssetDownloadAuthorizationDto,
  AssetPreviewResolutionDto,
  AssetSummaryDto,
} from "../../../../shared/contracts/assets/AssetTransportContracts";

export const AssetManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  invalidState: "invalid-state",
  internal: "internal",
} as const);

export type AssetManagementApiErrorCode =
  typeof AssetManagementApiErrorCodes[keyof typeof AssetManagementApiErrorCodes];

export interface AssetManagementApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface AssetManagementApiError {
  readonly code: AssetManagementApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<AssetManagementApiValidationError>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AssetManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: AssetManagementApiError;
}

export interface RegisterAssetApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly assetId: string;
  readonly kind: "uploaded-file" | "generated-output" | "preview" | "derived";
  readonly ownerUserId?: string;
  readonly visibility?: "private" | "workspace" | "shared" | "published";
  readonly sharingPolicyRef?: {
    readonly policyId: string;
    readonly policyVersion?: string;
  };
  readonly storageInstanceId: string;
  readonly initialVersion: {
    readonly versionId: string;
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly objectVersionId?: string;
    readonly area: AssetStorageArea;
    readonly content: {
      readonly mimeType: string;
      readonly sizeBytes: number;
      readonly checksum: {
        readonly algorithm: "sha256" | "sha512" | "md5";
        readonly digest: string;
      };
      readonly originalFileName?: string;
    };
  };
}

export interface RegisterAssetApiResponse {
  readonly asset: AssetDetailDto;
}

export interface RegisterGeneratedOutputApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly assetId: string;
  readonly ownerUserId?: string;
  readonly visibility?: "private" | "workspace" | "shared" | "published";
  readonly sharingPolicyRef?: {
    readonly policyId: string;
    readonly policyVersion?: string;
  };
  readonly storageInstanceId: string;
  readonly outputVersion: {
    readonly versionId: string;
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly objectVersionId?: string;
    readonly area: AssetStorageArea;
    readonly content: {
      readonly mimeType: string;
      readonly sizeBytes: number;
      readonly checksum: {
        readonly algorithm: "sha256" | "sha512" | "md5";
        readonly digest: string;
      };
      readonly originalFileName?: string;
    };
  };
  readonly source: {
    readonly producerType: "run" | "system";
    readonly runId?: string;
    readonly systemId?: string;
  };
  readonly lineage: ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation?: string;
  }>;
}

export interface RegisterGeneratedOutputApiResponse {
  readonly asset: AssetDetailDto;
}

export interface InitiateAssetUploadApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly assetId: string;
  readonly storageInstanceId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly area?: AssetStorageArea;
  readonly expiresInSeconds?: number;
}

export interface InitiateAssetUploadApiResponse {
  readonly asset: AssetDetailDto;
  readonly upload: {
    readonly uploadSessionId: string;
    readonly assetId: string;
    readonly workspaceId: string;
    readonly storageInstanceId: string;
    readonly objectKey: string;
    readonly area: AssetStorageArea;
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

export interface IngestAssetUploadContentApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly uploadSessionId: string;
  readonly contentType?: string;
  readonly content: AsyncIterable<Uint8Array>;
}

export interface IngestAssetUploadContentApiResponse {
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

export interface ListAssetsApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
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

export interface ListAssetsApiResponse {
  readonly items: ReadonlyArray<AssetSummaryDto>;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
}

export interface GetAssetDetailApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly includeDeleted?: boolean;
}

export interface GetAssetDetailApiResponse {
  readonly asset: AssetDetailDto;
}

export interface AuthorizeAssetDownloadApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly purpose: "download" | "inline-preview" | "worker-process";
  readonly fileNameHint?: string;
  readonly expiresInSeconds?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface AuthorizeAssetDownloadApiResponse {
  readonly authorization: AssetDownloadAuthorizationDto;
}

export interface OpenAuthorizedAssetDownloadStreamApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly contentToken: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface OpenAuthorizedAssetDownloadStreamApiResponse {
  readonly assetId: string;
  readonly versionId: string;
  readonly stream: AsyncIterable<Uint8Array>;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDisposition: "attachment" | "inline";
  readonly contentDispositionFileName?: string;
}

export interface ResolveAssetPreviewApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly preferredMimeTypes?: ReadonlyArray<string>;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ResolveAssetPreviewApiResponse {
  readonly preview: AssetPreviewResolutionDto;
}

export interface ArchiveAssetApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ArchiveAssetApiResponse {
  readonly asset: AssetDetailDto;
}

export interface DeleteAssetApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface DeleteAssetApiResponse {
  readonly asset: AssetDetailDto;
}

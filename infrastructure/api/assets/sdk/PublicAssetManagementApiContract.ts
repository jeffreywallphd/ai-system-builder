import type { AssetStorageArea } from "../../../../src/domain/assets/AssetDomain";
import type { AssetDetailDto } from "../../../../src/shared/contracts/assets/AssetTransportContracts";

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

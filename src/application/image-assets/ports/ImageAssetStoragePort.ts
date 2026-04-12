export type ImageAssetStorageContentSource = Uint8Array | AsyncIterable<Uint8Array>;

export const ImageAssetStorageObjectAreas = Object.freeze({
  original: "original",
  preview: "preview",
  derivative: "derivative",
  intermediate: "intermediate",
} as const);

export type ImageAssetStorageObjectArea =
  typeof ImageAssetStorageObjectAreas[keyof typeof ImageAssetStorageObjectAreas];

export const ImageAssetStorageAccessPurposes = Object.freeze({
  downloadOriginal: "download-original",
  inlinePreview: "inline-preview",
  export: "export",
  workerProcess: "worker-process",
} as const);

export type ImageAssetStorageAccessPurpose =
  typeof ImageAssetStorageAccessPurposes[keyof typeof ImageAssetStorageAccessPurposes];

export const ImageAssetStorageLifecycleDeleteReasons = Object.freeze({
  assetArchived: "asset-archived",
  assetDeleted: "asset-deleted",
  ingestFailure: "ingest-failure",
  orphanCleanup: "orphan-cleanup",
} as const);

export type ImageAssetStorageLifecycleDeleteReason =
  typeof ImageAssetStorageLifecycleDeleteReasons[keyof typeof ImageAssetStorageLifecycleDeleteReasons];

export const ImageAssetStorageErrorCodes = Object.freeze({
  invalidRequest: "image-asset-storage-invalid-request",
  backendUnsupported: "image-asset-storage-backend-unsupported",
  reservationDenied: "image-asset-storage-reservation-denied",
  notFound: "image-asset-storage-not-found",
  accessDenied: "image-asset-storage-access-denied",
  conflict: "image-asset-storage-conflict",
  sizeLimitExceeded: "image-asset-storage-size-limit-exceeded",
  ioFailure: "image-asset-storage-io-failure",
} as const);

export type ImageAssetStorageErrorCode =
  typeof ImageAssetStorageErrorCodes[keyof typeof ImageAssetStorageErrorCodes];

export class ImageAssetStorageError extends Error {
  public readonly code: ImageAssetStorageErrorCode;

  public readonly retryable: boolean;

  public readonly context?: Readonly<Record<string, string>>;

  public constructor(
    code: ImageAssetStorageErrorCode,
    message: string,
    options?: {
      readonly retryable?: boolean;
      readonly context?: Readonly<Record<string, string>>;
      readonly cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ImageAssetStorageError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.context = options?.context;
    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

export function isImageAssetStorageError(error: unknown): error is ImageAssetStorageError {
  return error instanceof ImageAssetStorageError;
}

export interface ImageAssetStorageObjectReference {
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: ImageAssetStorageObjectArea;
}

export interface ReserveImageAssetStorageLocationRequest {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly storageInstanceId: string;
  readonly area: ImageAssetStorageObjectArea;
  readonly normalizedFileName?: string;
  readonly mediaType?: string;
  readonly contentDigest?: string;
  readonly occurredAt?: string;
}

export interface ReserveImageAssetStorageLocationResult {
  readonly reservationId: string;
  readonly reference: ImageAssetStorageObjectReference;
  readonly expiresAt?: string;
}

export interface WriteImageAssetStorageObjectRequest {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly reservationId?: string;
  readonly reference: ImageAssetStorageObjectReference;
  readonly content: ImageAssetStorageContentSource;
  readonly expectedSizeBytes?: number;
  readonly expectedChecksum?: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
  readonly overwriteExisting?: boolean;
}

export interface WriteImageAssetStorageObjectResult {
  readonly reference: ImageAssetStorageObjectReference;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
  readonly writtenAt: string;
}

export interface OpenImageAssetStorageObjectReadRequest {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly purpose: ImageAssetStorageAccessPurpose;
  readonly reference: ImageAssetStorageObjectReference;
}

export interface OpenImageAssetStorageObjectReadResult {
  readonly reference: ImageAssetStorageObjectReference;
  readonly sizeBytes: number;
  readonly mediaType?: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export interface CreateImageAssetStorageAccessHandleRequest {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly purpose: ImageAssetStorageAccessPurpose;
  readonly reference: ImageAssetStorageObjectReference;
  readonly expiresInSeconds: number;
  readonly occurredAt?: string;
}

export interface CreateImageAssetStorageAccessHandleResult {
  readonly handleToken: string;
  readonly expiresAt: string;
}

export interface ResolveImageAssetStorageAccessHandleRequest {
  readonly handleToken: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly occurredAt?: string;
}

export interface ImageAssetStorageAccessHandleClaims {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly purpose: ImageAssetStorageAccessPurpose;
  readonly reference: ImageAssetStorageObjectReference;
  readonly expiresAt: string;
}

export interface DeleteImageAssetStorageObjectRequest {
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly reason: ImageAssetStorageLifecycleDeleteReason;
  readonly reference: ImageAssetStorageObjectReference;
}

export interface DeleteImageAssetStorageObjectResult {
  readonly reference: ImageAssetStorageObjectReference;
  readonly deleted: boolean;
  readonly deletedAt: string;
}

export interface IImageAssetStoragePort {
  reserveStorageLocation(
    request: ReserveImageAssetStorageLocationRequest,
  ): Promise<ReserveImageAssetStorageLocationResult>;
  writeObject(request: WriteImageAssetStorageObjectRequest): Promise<WriteImageAssetStorageObjectResult>;
  openReadStream(
    request: OpenImageAssetStorageObjectReadRequest,
  ): Promise<OpenImageAssetStorageObjectReadResult>;
  createAccessHandle(
    request: CreateImageAssetStorageAccessHandleRequest,
  ): Promise<CreateImageAssetStorageAccessHandleResult>;
  resolveAccessHandle(
    request: ResolveImageAssetStorageAccessHandleRequest,
  ): Promise<ImageAssetStorageAccessHandleClaims | undefined>;
  deleteObject(request: DeleteImageAssetStorageObjectRequest): Promise<DeleteImageAssetStorageObjectResult>;
}

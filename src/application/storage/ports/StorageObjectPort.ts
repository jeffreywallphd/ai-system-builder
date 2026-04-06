import type { StorageInstance } from "../../../domain/storage/StorageDomain";

export type StorageObjectStreamSource = Uint8Array | AsyncIterable<Uint8Array>;

export const StorageObjectErrorCodes = Object.freeze({
  invalidRequest: "storage-object-invalid-request",
  backendUnsupported: "storage-object-backend-unsupported",
  notFound: "storage-object-not-found",
  conflict: "storage-object-conflict",
  sizeLimitExceeded: "storage-object-size-limit-exceeded",
  ioFailure: "storage-object-io-failure",
});

export type StorageObjectErrorCode =
  typeof StorageObjectErrorCodes[keyof typeof StorageObjectErrorCodes];

export class StorageObjectAccessError extends Error {
  public readonly code: StorageObjectErrorCode;

  public readonly retryable: boolean;

  public readonly context?: Readonly<Record<string, string>>;

  public constructor(
    code: StorageObjectErrorCode,
    message: string,
    options?: {
      readonly retryable?: boolean;
      readonly context?: Readonly<Record<string, string>>;
      readonly cause?: unknown;
    },
  ) {
    super(message);
    this.name = "StorageObjectAccessError";
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

export function isStorageObjectAccessError(error: unknown): error is StorageObjectAccessError {
  return error instanceof StorageObjectAccessError;
}

export interface StorageObjectReference {
  readonly storageInstance: StorageInstance;
  readonly objectKey: string;
}

export interface StorageObjectMetadata {
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly createdAt?: string;
  readonly lastModifiedAt: string;
  readonly checksum?: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
}

export interface CreateStorageObjectKeyRequest {
  readonly storageInstance: StorageInstance;
  readonly namespace: string;
  readonly logicalPathSegments: ReadonlyArray<string>;
  readonly originalFileName?: string;
  readonly contentDigest?: string;
  readonly occurredAt?: string;
}

export interface CreateStorageObjectKeyResult {
  readonly objectKey: string;
  readonly normalizedFileName: string;
  readonly partition: ReadonlyArray<string>;
}

export interface StorageObjectWriteRequest {
  readonly reference: StorageObjectReference;
  readonly content: StorageObjectStreamSource;
  readonly overwriteExisting?: boolean;
}

export interface StorageObjectWriteResult {
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
  readonly writtenAt: string;
}

export interface StorageObjectDeleteRequest {
  readonly reference: StorageObjectReference;
}

export interface StorageObjectDeleteResult {
  readonly objectKey: string;
  readonly deleted: boolean;
  readonly deletedAt: string;
}

export interface IStorageObjectPort {
  createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult;
  writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult>;
  objectExists(reference: StorageObjectReference): Promise<boolean>;
  readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata>;
  openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>>;
  deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult>;
}

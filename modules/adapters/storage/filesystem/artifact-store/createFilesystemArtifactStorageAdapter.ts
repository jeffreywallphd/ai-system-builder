import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { ArtifactCatalogAppendPort } from "../../../../application/ports/artifact-catalog";
import type { ArtifactObjectStoragePort } from "../../../../application/ports/storage";
import type { ContractErrorCode } from "../../../../contracts/shared";
import { createContractError } from "../../../../contracts/shared";
import {
  createDeleteArtifactFailureResult,
  createDeleteArtifactSuccessResult,
  createHasArtifactFailureResult,
  createHasArtifactSuccessResult,
  createRetrieveArtifactFailureResult,
  createRetrieveArtifactSuccessResult,
  createStoreArtifactFailureResult,
  createStoreArtifactSuccessResult,
  normalizeStorageArtifactKey,
  type StorageObjectChecksum,
  type DeleteArtifactRequest,
  type DeleteArtifactResult,
  type HasArtifactRequest,
  type HasArtifactResult,
  type RetrieveArtifactRequest,
  type RetrieveArtifactResult,
  type StoreArtifactRequest,
  type StoreArtifactResult,
} from "../../../../contracts/storage";

const STORAGE_COMPONENT = "adapters.storage.filesystem";
const DEFAULT_STORAGE_HOST = "desktop";
const STORAGE_CHECKSUM_ALGORITHM = "sha256";

class StorageAdapterValidationError extends Error {}
class StorageAdapterVerificationError extends Error {}

export interface CreateFilesystemArtifactStorageAdapterOptions {
  rootDirectory: string;
  host?: "desktop" | "server";
  logging?: LoggingPort;
  now?: () => string;
  randomSuffix?: () => string;
  statPath?: typeof stat;
  artifactCatalogAppend?: ArtifactCatalogAppendPort;
}

function isFsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function toErrorCode(
  error: unknown,
  fallback: ContractErrorCode = "internal",
): ContractErrorCode {
  if (error instanceof StorageAdapterValidationError) {
    return "validation";
  }

  if (error instanceof StorageAdapterVerificationError) {
    return "unavailable";
  }

  if (!isFsError(error)) {
    return fallback;
  }

  switch (error.code) {
    case "ENOENT":
      return "not-found";
    case "EEXIST":
      return "conflict";
    case "EACCES":
    case "EPERM":
    case "EROFS":
    case "ENOSPC":
    case "EMFILE":
    case "ENFILE":
    case "EBUSY":
    case "ENOTDIR":
      return "unavailable";
    default:
      return fallback;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function resolvePathInsideRoot(rootDirectory: string, key: string): string {
  const segments = key
    .split(/[\\/]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new StorageAdapterValidationError("Storage key must include at least one segment.");
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new StorageAdapterValidationError(
        "Storage key segments must not contain path traversal tokens.",
      );
    }
  }

  const absolutePath = path.resolve(rootDirectory, ...segments);
  const relativePath = path.relative(rootDirectory, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new StorageAdapterValidationError(
      "Storage key must resolve to a path inside the configured storage root.",
    );
  }

  return absolutePath;
}

function toBytes(content: unknown): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }

  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }

  throw new StorageAdapterValidationError("Storage content must be binary bytes.");
}

function extensionForMediaType(mediaType: string | undefined): string {
  switch (mediaType?.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

function isImageMediaType(mediaType: string | undefined): boolean {
  return typeof mediaType === "string" && mediaType.toLowerCase().startsWith("image/");
}

function createContentChecksum(bytes: Uint8Array): StorageObjectChecksum {
  const digest = createHash(STORAGE_CHECKSUM_ALGORITHM).update(bytes).digest("hex");

  return {
    algorithm: STORAGE_CHECKSUM_ALGORITHM,
    value: digest,
  };
}

export function createFilesystemArtifactObjectStorageAdapter(
  options: CreateFilesystemArtifactStorageAdapterOptions,
): ArtifactObjectStoragePort {
  if (options.rootDirectory.trim().length === 0) {
    throw new Error("rootDirectory must be a non-empty path.");
  }

  const rootDirectory = path.resolve(options.rootDirectory);
  const logging = options.logging;
  const now = options.now ?? (() => new Date().toISOString());
  const randomSuffix = options.randomSuffix ?? (() => randomUUID().replaceAll("-", ""));
  const statPath = options.statPath ?? stat;

  async function logBoundaryEvent(event: {
    level: "debug" | "info" | "warn" | "error";
    name: string;
    message: string;
    operation: string;
    requestId?: string;
    correlationId?: string;
    durationMs?: number;
    outcome?: "success" | "failure";
    data?: Readonly<Record<string, unknown>>;
    error?: {
      errorType: string;
      errorCode?: string;
      errorMessage: string;
      details?: Readonly<Record<string, unknown>>;
    };
  }): Promise<void> {
    if (!logging) {
      return;
    }

    try {
      await logging.log({
        timestamp: now(),
        level: event.level,
        verbosity: "normal",
        event: event.name,
        message: event.message,
        component: STORAGE_COMPONENT,
        operation: event.operation,
        host: options.host ?? DEFAULT_STORAGE_HOST,
        requestId: event.requestId,
        correlationId: event.correlationId,
        durationMs: event.durationMs,
        outcome: event.outcome,
        data: event.data,
        error: event.error,
      });
    } catch {
      // Logging must never break storage operations.
    }
  }

  function createGeneratedKey(mediaType: string | undefined): string {
    const compactTimestamp = now().replace(/[-:.TZ]/g, "");
    return normalizeStorageArtifactKey(
      `uploads/${compactTimestamp}-${randomSuffix()}.${extensionForMediaType(mediaType)}`,
    );
  }

  return {
    async storeArtifact<TContent = Uint8Array>(
      request: StoreArtifactRequest<TContent>,
    ): Promise<StoreArtifactResult> {
      const startedAt = Date.now();
      const requestContext = {
        requestId: request.requestId,
        correlationId: request.correlationId,
      };
      let attemptedKey: string | undefined;
      let attemptedAbsolutePath: string | undefined;

      await logBoundaryEvent({
        level: "debug",
        name: "storage.filesystem.store.started",
        message: "Starting artifact write to local filesystem storage.",
        operation: "storage.artifact.store",
        requestId: request.requestId,
        correlationId: request.correlationId,
        data: {
          keyProvided: typeof request.descriptor.key === "string",
          overwrite: request.overwrite === true,
        },
      });

      try {
        const key = request.descriptor.key
          ? normalizeStorageArtifactKey(request.descriptor.key)
          : createGeneratedKey(request.descriptor.mediaType);
        attemptedKey = key;
        const bytes = toBytes(request.content);
        const checksum = createContentChecksum(bytes);
        const absolutePath = resolvePathInsideRoot(rootDirectory, key);
        attemptedAbsolutePath = absolutePath;
        const writeFlag = request.overwrite === true ? "w" : "wx";

        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, bytes, { flag: writeFlag });
        const writtenStats = await statPath(absolutePath);

        if (!writtenStats.isFile()) {
          throw new StorageAdapterVerificationError(
            "Post-write verification failed: resolved artifact path is not a file.",
          );
        }

        if (writtenStats.size !== bytes.byteLength) {
          throw new StorageAdapterVerificationError(
            `Post-write verification failed: expected ${bytes.byteLength} bytes but found ${writtenStats.size}.`,
          );
        }

        if (isImageMediaType(request.descriptor.mediaType) && options.artifactCatalogAppend) {
          const appendResult = await options.artifactCatalogAppend.appendArtifactCatalogRecord({
            record: {
              storageKey: key,
              artifactKind: "image",
              mediaType: request.descriptor.mediaType,
              sizeBytes: bytes.byteLength,
              sourceKind: "upload",
              originalName:
                typeof (request.descriptor.metadata as { originalFileName?: unknown } | undefined)?.originalFileName
                  === "string"
                  ? (request.descriptor.metadata as { originalFileName?: string }).originalFileName
                  : undefined,
              createdAt: now(),
              checksum,
            },
          }, {
            requestId: request.requestId,
            correlationId: request.correlationId,
          });

          if (!appendResult.ok) {
            throw new StorageAdapterVerificationError(appendResult.error.message);
          }
        }

        await logBoundaryEvent({
          level: "info",
          name: "storage.filesystem.store.succeeded",
          message: "Stored artifact in desktop filesystem storage.",
          operation: "storage.artifact.store",
          requestId: request.requestId,
          correlationId: request.correlationId,
          durationMs: Date.now() - startedAt,
          outcome: "success",
          data: {
            key,
            absolutePath,
            sizeBytes: bytes.byteLength,
            mediaType: request.descriptor.mediaType,
            checksumAlgorithm: checksum.algorithm,
            checksumValue: checksum.value,
          },
        });

        return createStoreArtifactSuccessResult(
          {
            key,
            mediaType: request.descriptor.mediaType,
            sizeBytes: bytes.byteLength,
            checksum,
            metadata: request.descriptor.metadata,
          },
          requestContext,
        );
      } catch (error) {
        const code = toErrorCode(error);
        const message = code === "conflict"
          ? "Storage artifact already exists and overwrite is disabled."
          : `Failed to store artifact bytes: ${toErrorMessage(error)}`;

        await logBoundaryEvent({
          level: "error",
          name: "storage.filesystem.store.failed",
          message: "Failed to store artifact in desktop filesystem storage.",
          operation: "storage.artifact.store",
          requestId: request.requestId,
          correlationId: request.correlationId,
          durationMs: Date.now() - startedAt,
          outcome: "failure",
          error: {
            errorType: "storage",
            errorCode: code,
            errorMessage: message,
            details: {
              key: attemptedKey,
              absolutePath: attemptedAbsolutePath,
              filesystemCode: isFsError(error) ? (error.code ?? "unknown") : "unknown",
            },
          },
        });

        return createStoreArtifactFailureResult(
          createContractError(code, message, {
            ...requestContext,
            details: {
              operation: "storeArtifact",
              key: attemptedKey,
              absolutePath: attemptedAbsolutePath,
              filesystemCode: isFsError(error) ? error.code : undefined,
            },
          }),
          requestContext,
        );
      }
    },

    async retrieveArtifact<TContent = Uint8Array>(
      request: RetrieveArtifactRequest,
    ): Promise<RetrieveArtifactResult<TContent>> {
      try {
        const key = normalizeStorageArtifactKey(request.key);
        const absolutePath = resolvePathInsideRoot(rootDirectory, key);
        const [fileContent, fileStats] = await Promise.all([
          readFile(absolutePath),
          stat(absolutePath),
        ]);

        return createRetrieveArtifactSuccessResult(
          {
            key,
            sizeBytes: fileStats.size,
          },
          new Uint8Array(fileContent) as TContent,
          {
            requestId: request.requestId,
            correlationId: request.correlationId,
          },
        );
      } catch (error) {
        const code = toErrorCode(error, "not-found");
        return createRetrieveArtifactFailureResult<TContent>(
          createContractError(code, `Failed to retrieve artifact bytes: ${toErrorMessage(error)}`, {
            requestId: request.requestId,
            correlationId: request.correlationId,
            details: {
              operation: "retrieveArtifact",
              filesystemCode: isFsError(error) ? error.code : undefined,
            },
          }),
          request,
        );
      }
    },

    async hasArtifact(request: HasArtifactRequest): Promise<HasArtifactResult> {
      try {
        const key = normalizeStorageArtifactKey(request.key);
        const absolutePath = resolvePathInsideRoot(rootDirectory, key);
        const fileStats = await stat(absolutePath);

        return createHasArtifactSuccessResult(true, {
          descriptor: {
            key,
            sizeBytes: fileStats.size,
          },
          requestId: request.requestId,
          correlationId: request.correlationId,
        });
      } catch (error) {
        if (isFsError(error) && error.code === "ENOENT") {
          return createHasArtifactSuccessResult(false, {
            requestId: request.requestId,
            correlationId: request.correlationId,
          });
        }

        const code = toErrorCode(error, "internal");
        return createHasArtifactFailureResult(
          createContractError(code, `Failed to check artifact existence: ${toErrorMessage(error)}`, {
            requestId: request.requestId,
            correlationId: request.correlationId,
            details: {
              operation: "hasArtifact",
              filesystemCode: isFsError(error) ? error.code : undefined,
            },
          }),
          request,
        );
      }
    },

    async deleteArtifact(request: DeleteArtifactRequest): Promise<DeleteArtifactResult> {
      try {
        const key = normalizeStorageArtifactKey(request.key);
        const absolutePath = resolvePathInsideRoot(rootDirectory, key);
        await unlink(absolutePath);

        // Best-effort cleanup of empty parent directories under the root.
        const parentDirectory = path.dirname(absolutePath);
        if (path.relative(rootDirectory, parentDirectory) !== "") {
          await rm(parentDirectory, { recursive: false, force: false }).catch(() => {});
        }

        return createDeleteArtifactSuccessResult(true, request);
      } catch (error) {
        if (isFsError(error) && error.code === "ENOENT") {
          return createDeleteArtifactSuccessResult(false, request);
        }

        const code = toErrorCode(error, "internal");
        return createDeleteArtifactFailureResult(
          createContractError(code, `Failed to delete artifact: ${toErrorMessage(error)}`, {
            requestId: request.requestId,
            correlationId: request.correlationId,
            details: {
              operation: "deleteArtifact",
              filesystemCode: isFsError(error) ? error.code : undefined,
            },
          }),
          request,
        );
      }
    },
  };
}


/**
 * Backward-compatible alias for artifact-object storage adapter naming.
 */
export function createFilesystemArtifactStorageAdapter(
  options: CreateFilesystemArtifactStorageAdapterOptions,
): ArtifactObjectStoragePort {
  return createFilesystemArtifactObjectStorageAdapter(options);
}

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import type {
  CreateStorageObjectKeyRequest,
  CreateStorageObjectKeyResult,
  IStorageObjectPort,
  StorageObjectDeleteRequest,
  StorageObjectDeleteResult,
  StorageObjectMetadata,
  StorageObjectReference,
  StorageObjectWriteRequest,
  StorageObjectWriteResult,
} from "@application/storage/ports/StorageObjectPort";
import {
  StorageObjectAccessError,
  StorageObjectErrorCodes,
} from "@application/storage/ports/StorageObjectPort";
import { StorageBackendTypes } from "@domain/storage/StorageDomain";

export interface LocalStorageObjectAdapterConfiguration {
  readonly managedStorageRootPath: string;
  readonly objectsDirectoryName?: string;
  readonly diagnosticsLogger?: LocalStorageObjectDiagnosticsLogger;
}

const DefaultObjectsDirectoryName = "objects";

export interface LocalStorageObjectDiagnosticsEvent {
  readonly event: "storage.local.write.succeeded" | "storage.local.write.failed";
  readonly occurredAt: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly absolutePath: string;
  readonly operation: "writeObject";
  readonly sizeBytes?: number;
  readonly checksumSha256?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface LocalStorageObjectDiagnosticsLogger {
  info(event: LocalStorageObjectDiagnosticsEvent): void;
  error(event: LocalStorageObjectDiagnosticsEvent): void;
}

export class ServerManagedLocalStorageObjectAdapter implements IStorageObjectPort {
  private readonly managedStorageRootPath: string;

  private readonly objectsDirectoryName: string;
  private readonly diagnosticsLogger?: LocalStorageObjectDiagnosticsLogger;

  public constructor(configuration: LocalStorageObjectAdapterConfiguration) {
    const normalizedRoot = configuration.managedStorageRootPath.trim();
    if (!normalizedRoot) {
      throw new Error("Local storage object adapter configuration requires managedStorageRootPath.");
    }

    const normalizedObjectsDirectoryName = (configuration.objectsDirectoryName ?? DefaultObjectsDirectoryName)
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(normalizedObjectsDirectoryName)) {
      throw new Error("Local storage object adapter requires a safe objectsDirectoryName.");
    }

    this.managedStorageRootPath = path.resolve(normalizedRoot);
    this.objectsDirectoryName = normalizedObjectsDirectoryName;
    this.diagnosticsLogger = configuration.diagnosticsLogger;
  }

  public createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult {
    this.assertBackendSupported(input.storageInstance.backendType);
    const namespace = this.normalizeKeySegment(input.namespace, "namespace");
    const logicalSegments = input.logicalPathSegments.map((segment, index) =>
      this.normalizeKeySegment(segment, `logicalPathSegments[${index}]`));
    if (logicalSegments.length < 1) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key creation requires at least one logicalPathSegments entry.",
      );
    }

    const normalizedFileName = this.normalizeFileName(input.originalFileName);
    const partition = this.resolvePartition(input.contentDigest, input.occurredAt);

    const objectKey = [
      namespace,
      ...logicalSegments,
      ...partition,
      normalizedFileName,
    ].join("/");

    return Object.freeze({
      objectKey,
      normalizedFileName,
      partition: Object.freeze(partition),
    });
  }

  public async writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult> {
    const occurredAt = new Date().toISOString();
    let targetPath: string | undefined;
    let tempPath: string | undefined;
    const objectLimit = input.reference.storageInstance.policy.maxObjectBytes;

    try {
      targetPath = this.resolveObjectPath(input.reference);
      tempPath = `${targetPath}.tmp-${createHash("sha256").update(`${targetPath}:${occurredAt}`).digest("hex").slice(0, 12)}`;
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (!input.overwriteExisting) {
        await this.assertObjectAbsent(targetPath, input.reference.objectKey);
      }

      const sink = createWriteStream(tempPath, { flags: "w" });
      const hasher = createHash("sha256");
      let sizeBytes = 0;

      try {
        for await (const chunk of this.toAsyncIterable(input.content)) {
          if (chunk.byteLength < 1) {
            continue;
          }

          sizeBytes += chunk.byteLength;
          if (objectLimit !== undefined && sizeBytes > objectLimit) {
            throw new StorageObjectAccessError(
              StorageObjectErrorCodes.sizeLimitExceeded,
              `Storage object exceeds maxObjectBytes policy limit (${objectLimit}).`,
              {
                context: Object.freeze({
                  objectKey: input.reference.objectKey,
                  storageInstanceId: input.reference.storageInstance.id,
                }),
              },
            );
          }

          const encoded = Buffer.from(chunk);
          hasher.update(encoded);
          if (!sink.write(encoded)) {
            await once(sink, "drain");
          }
        }
      } catch (error) {
        sink.destroy(error instanceof Error ? error : undefined);
        throw error;
      }

      sink.end();
      await once(sink, "finish");

      await fs.rename(tempPath, targetPath);

      this.diagnosticsLogger?.info(Object.freeze({
        event: "storage.local.write.succeeded",
        occurredAt,
        storageInstanceId: input.reference.storageInstance.id,
        objectKey: input.reference.objectKey,
        absolutePath: targetPath,
        operation: "writeObject",
        sizeBytes,
        checksumSha256: hasher.copy().digest("hex"),
      }));

      return Object.freeze({
        objectKey: input.reference.objectKey,
        sizeBytes,
        checksum: Object.freeze({
          algorithm: "sha256" as const,
          digest: hasher.digest("hex"),
        }),
        writtenAt: occurredAt,
      });
    } catch (error) {
      if (tempPath) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);
      }
      const mapped = this.mapError(error, input.reference, "writeObject");
      this.diagnosticsLogger?.error(Object.freeze({
        event: "storage.local.write.failed",
        occurredAt,
        storageInstanceId: input.reference.storageInstance.id,
        objectKey: input.reference.objectKey,
        absolutePath: targetPath ?? "<unresolved>",
        operation: "writeObject",
        errorCode: mapped.code,
        errorMessage: mapped.message,
      }));
      throw mapped;
    }
  }

  public async objectExists(reference: StorageObjectReference): Promise<boolean> {
    const targetPath = this.resolveObjectPath(reference);
    try {
      const stat = await fs.stat(targetPath);
      return stat.isFile();
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw this.mapError(error, reference, "objectExists");
    }
  }

  public async readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata> {
    const targetPath = this.resolveObjectPath(reference);
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isFile()) {
        throw new StorageObjectAccessError(
          StorageObjectErrorCodes.notFound,
          "Storage object does not resolve to a file.",
          {
            context: Object.freeze({
              objectKey: reference.objectKey,
              storageInstanceId: reference.storageInstance.id,
            }),
          },
        );
      }

      return Object.freeze({
        objectKey: reference.objectKey,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        lastModifiedAt: stat.mtime.toISOString(),
      });
    } catch (error) {
      throw this.mapError(error, reference, "readObjectMetadata");
    }
  }

  public async openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>> {
    const targetPath = this.resolveObjectPath(reference);
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isFile()) {
        throw new StorageObjectAccessError(
          StorageObjectErrorCodes.notFound,
          "Storage object does not resolve to a file.",
          {
            context: Object.freeze({
              objectKey: reference.objectKey,
              storageInstanceId: reference.storageInstance.id,
            }),
          },
        );
      }

      return createReadStream(targetPath);
    } catch (error) {
      throw this.mapError(error, reference, "openObjectReadStream");
    }
  }

  public async deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult> {
    const occurredAt = new Date().toISOString();
    const targetPath = this.resolveObjectPath(input.reference);
    try {
      await fs.unlink(targetPath);
      return Object.freeze({
        objectKey: input.reference.objectKey,
        deleted: true,
        deletedAt: occurredAt,
      });
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return Object.freeze({
          objectKey: input.reference.objectKey,
          deleted: false,
          deletedAt: occurredAt,
        });
      }

      throw this.mapError(error, input.reference, "deleteObject");
    }
  }

  private resolveObjectPath(reference: StorageObjectReference): string {
    this.assertBackendSupported(reference.storageInstance.backendType);
    const normalizedObjectKey = this.normalizeObjectKey(reference.objectKey);
    const storageRoot = this.resolveStorageBindingRoot(reference.storageInstance.ownership.workspaceId, reference.storageInstance.id);
    const objectsRoot = path.join(storageRoot, this.objectsDirectoryName);
    const absolute = path.join(objectsRoot, ...normalizedObjectKey.split("/"));

    const relative = path.relative(objectsRoot, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key resolves outside server-managed object root.",
        {
          context: Object.freeze({
            objectKey: reference.objectKey,
            storageInstanceId: reference.storageInstance.id,
          }),
        },
      );
    }

    return absolute;
  }

  private resolveStorageBindingRoot(workspaceId: string, storageInstanceId: string): string {
    const workspaceSegment = this.toSafePathSegment(workspaceId);
    const storageSegment = this.toSafePathSegment(storageInstanceId);
    return path.join(this.managedStorageRootPath, "workspaces", workspaceSegment, "storage", storageSegment);
  }

  private normalizeObjectKey(objectKey: string): string {
    const normalized = objectKey.trim();
    if (!normalized) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key is required.",
      );
    }
    if (normalized.startsWith("/")) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key cannot be an absolute path.",
      );
    }
    if (normalized.includes("\\")) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key cannot include Windows path separators.",
      );
    }
    if (/^[a-zA-Z]:\//.test(normalized)) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key cannot include drive-letter prefixes.",
      );
    }

    const segments = normalized.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        "Storage object key contains invalid traversal segments.",
      );
    }

    return segments.map((segment, index) => this.normalizeKeySegment(segment, `objectKey[${index}]`)).join("/");
  }

  private normalizeFileName(fileName?: string): string {
    const raw = (fileName ?? "content.bin").trim();
    const fallback = "content.bin";
    if (!raw) {
      return fallback;
    }

    const safe = raw
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return safe || fallback;
  }

  private normalizeKeySegment(value: string, field: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!normalized) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        `Storage object key segment '${field}' is required.`,
      );
    }
    if (normalized === "." || normalized === "..") {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.invalidRequest,
        `Storage object key segment '${field}' is invalid.`,
      );
    }
    return normalized;
  }

  private resolvePartition(contentDigest: string | undefined, occurredAt: string | undefined): [string, string] {
    const source = (contentDigest?.trim().toLowerCase() || createHash("sha256").update(occurredAt ?? new Date().toISOString()).digest("hex"))
      .replace(/[^a-f0-9]/g, "");
    const digest = source.padEnd(4, "0");
    return [digest.slice(0, 2), digest.slice(2, 4)];
  }

  private toSafePathSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 12);
    return `${normalized || "id"}-${hash}`;
  }

  private assertBackendSupported(backendType: string): void {
    if (backendType !== StorageBackendTypes.managedFilesystem) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.backendUnsupported,
        `Storage backend '${backendType}' is not supported by the local object adapter.`,
      );
    }
  }

  private async assertObjectAbsent(targetPath: string, objectKey: string): Promise<void> {
    try {
      await fs.access(targetPath);
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.conflict,
        "Storage object already exists and overwriteExisting is disabled.",
        {
          context: Object.freeze({ objectKey }),
        },
      );
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return;
      }
      throw error;
    }
  }

  private async *toAsyncIterable(content: StorageObjectWriteRequest["content"]): AsyncIterable<Uint8Array> {
    if (content instanceof Uint8Array) {
      yield content;
      return;
    }

    for await (const chunk of content) {
      yield chunk;
    }
  }

  private mapError(error: unknown, reference: StorageObjectReference, operation: string): StorageObjectAccessError {
    if (error instanceof StorageObjectAccessError) {
      return error;
    }

    if (this.isNotFoundError(error)) {
      return new StorageObjectAccessError(
        StorageObjectErrorCodes.notFound,
        `Storage object '${reference.objectKey}' was not found.`,
        {
          context: Object.freeze({
            storageInstanceId: reference.storageInstance.id,
            objectKey: reference.objectKey,
            operation,
          }),
          cause: error,
        },
      );
    }

    if (this.isAlreadyExistsError(error)) {
      return new StorageObjectAccessError(
        StorageObjectErrorCodes.conflict,
        `Storage object '${reference.objectKey}' already exists.`,
        {
          context: Object.freeze({
            storageInstanceId: reference.storageInstance.id,
            objectKey: reference.objectKey,
            operation,
          }),
          cause: error,
        },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown I/O failure.";
    return new StorageObjectAccessError(
      StorageObjectErrorCodes.ioFailure,
      `Local storage object operation '${operation}' failed: ${message}`,
      {
        retryable: true,
        context: Object.freeze({
          storageInstanceId: reference.storageInstance.id,
          objectKey: reference.objectKey,
          operation,
        }),
        cause: error,
      },
    );
  }

  private isNotFoundError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
  }

  private isAlreadyExistsError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST";
  }
}

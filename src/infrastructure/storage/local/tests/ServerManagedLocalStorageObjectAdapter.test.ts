import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import {
  StorageObjectAccessError,
  StorageObjectErrorCodes,
} from "@application/storage/ports/StorageObjectPort";
import {
  ServerManagedLocalStorageObjectAdapter,
  type LocalStorageObjectDiagnosticsEvent,
  type LocalStorageObjectDiagnosticsLogger,
} from "../ServerManagedLocalStorageObjectAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createManagedFilesystemStorage(
  storageInstanceId: string,
  backendType: StorageInstance["backendType"] = StorageBackendTypes.managedFilesystem,
): StorageInstance {
  return createStorageInstance({
    id: storageInstanceId,
    displayName: "Workspace storage",
    backendType,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-storage",
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
      maxObjectBytes: 1024 * 1024,
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-local-objects",
  });
}

async function streamToText(stream: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("ServerManagedLocalStorageObjectAdapter", () => {
  it("emits diagnostics with the resolved absolute file path for successful writes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-logging-success-"));
    createdRoots.push(root);
    const infoEvents: LocalStorageObjectDiagnosticsEvent[] = [];
    const logger: LocalStorageObjectDiagnosticsLogger = {
      info: (event) => infoEvents.push(event),
      error: () => undefined,
    };
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
      diagnosticsLogger: logger,
    });
    const storageInstance = createManagedFilesystemStorage("storage-assets");
    const objectKey = adapter.createObjectKey({
      storageInstance,
      namespace: "assets",
      logicalPathSegments: ["input", "asset-upload-001", "v1"],
      originalFileName: "sample.png",
    }).objectKey;

    await adapter.writeObject({
      reference: {
        storageInstance,
        objectKey,
      },
      content: Buffer.from("hello logical storage", "utf8"),
    });

    expect(infoEvents).toHaveLength(1);
    expect(infoEvents[0]?.event).toBe("storage.local.write.succeeded");
    expect(infoEvents[0]?.absolutePath).toContain(path.join("objects", "assets", "input", "asset-upload-001", "v1"));
    expect(infoEvents[0]?.objectKey).toBe(objectKey);
    expect(infoEvents[0]?.storageInstanceId).toBe(storageInstance.id);
  });

  it("emits diagnostics with the resolved absolute file path when writes fail", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-logging-failure-"));
    createdRoots.push(root);
    const errorEvents: LocalStorageObjectDiagnosticsEvent[] = [];
    const logger: LocalStorageObjectDiagnosticsLogger = {
      info: () => undefined,
      error: (event) => errorEvents.push(event),
    };
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
      diagnosticsLogger: logger,
    });
    const storageInstance = createManagedFilesystemStorage("storage-assets");

    await expect(adapter.writeObject({
      reference: {
        storageInstance,
        objectKey: "../outside.txt",
      },
      content: Buffer.from("x", "utf8"),
    })).rejects.toBeDefined();

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]?.event).toBe("storage.local.write.failed");
    expect(errorEvents[0]?.absolutePath).toBe("<unresolved>");
    expect(errorEvents[0]?.errorCode).toBe(StorageObjectErrorCodes.invalidRequest);
  });

  it("writes and reads storage objects using logical keys only", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-success-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
    });
    const storageInstance = createManagedFilesystemStorage("storage-assets");

    const key = adapter.createObjectKey({
      storageInstance,
      namespace: "assets",
      logicalPathSegments: ["input", "asset-upload-001", "v1"],
      originalFileName: "My Upload Image.PNG",
      contentDigest: "9f0cab12ddee9977",
    });
    expect(key.normalizedFileName).toBe("my-upload-image.png");
    expect(key.partition).toEqual(["9f", "0c"]);
    expect(key.objectKey).toContain("/9f/0c/");

    const write = await adapter.writeObject({
      reference: {
        storageInstance,
        objectKey: key.objectKey,
      },
      content: Buffer.from("hello logical storage", "utf8"),
    });

    expect(write.objectKey).toBe(key.objectKey);
    expect(write.sizeBytes).toBe(21);
    expect(write.checksum.algorithm).toBe("sha256");

    const exists = await adapter.objectExists({
      storageInstance,
      objectKey: key.objectKey,
    });
    expect(exists).toBeTrue();

    const metadata = await adapter.readObjectMetadata({
      storageInstance,
      objectKey: key.objectKey,
    });
    expect(metadata.objectKey).toBe(key.objectKey);
    expect(metadata.sizeBytes).toBe(21);

    const stream = await adapter.openObjectReadStream({
      storageInstance,
      objectKey: key.objectKey,
    });
    const content = await streamToText(stream);
    expect(content).toBe("hello logical storage");
  });

  it("supports async-iterable stream writes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-stream-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
    });
    const storageInstance = createManagedFilesystemStorage("storage-stream");

    const objectKey = adapter.createObjectKey({
      storageInstance,
      namespace: "assets",
      logicalPathSegments: ["output", "asset-generated-001", "v2"],
      originalFileName: "output.json",
    }).objectKey;

    async function* chunks() {
      yield Buffer.from("{\"result\":", "utf8");
      yield Buffer.from("\"ok\"}", "utf8");
    }

    await adapter.writeObject({
      reference: {
        storageInstance,
        objectKey,
      },
      content: chunks(),
    });

    const stream = await adapter.openObjectReadStream({
      storageInstance,
      objectKey,
    });
    expect(await streamToText(stream)).toBe("{\"result\":\"ok\"}");
  });

  it("maps invalid keys and backend mismatches to application-safe errors", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-errors-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
    });

    const storageInstance = createManagedFilesystemStorage("storage-errors");

    await expect(adapter.writeObject({
      reference: {
        storageInstance,
        objectKey: "../outside.txt",
      },
      content: Buffer.from("x", "utf8"),
    })).rejects.toMatchObject({
      name: "StorageObjectAccessError",
      code: StorageObjectErrorCodes.invalidRequest,
    } satisfies Partial<StorageObjectAccessError>);

    const unsupportedStorage = createManagedFilesystemStorage("storage-unsupported", StorageBackendTypes.objectStorage);

    await expect(adapter.writeObject({
      reference: {
        storageInstance: unsupportedStorage,
        objectKey: "assets/input/file.txt",
      },
      content: Buffer.from("x", "utf8"),
    })).rejects.toMatchObject({
      name: "StorageObjectAccessError",
      code: StorageObjectErrorCodes.backendUnsupported,
    } satisfies Partial<StorageObjectAccessError>);
  });

  it("provides safe delete semantics and not-found mapping", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-object-delete-"));
    createdRoots.push(root);
    const adapter = new ServerManagedLocalStorageObjectAdapter({
      managedStorageRootPath: root,
    });
    const storageInstance = createManagedFilesystemStorage("storage-delete");

    const objectKey = adapter.createObjectKey({
      storageInstance,
      namespace: "assets",
      logicalPathSegments: ["preview", "asset-1"],
      originalFileName: "preview.jpg",
    }).objectKey;

    const firstDelete = await adapter.deleteObject({
      reference: {
        storageInstance,
        objectKey,
      },
    });
    expect(firstDelete.deleted).toBeFalse();

    await adapter.writeObject({
      reference: {
        storageInstance,
        objectKey,
      },
      content: Buffer.from("preview", "utf8"),
    });

    const deleted = await adapter.deleteObject({
      reference: {
        storageInstance,
        objectKey,
      },
    });
    expect(deleted.deleted).toBeTrue();

    await expect(adapter.readObjectMetadata({
      storageInstance,
      objectKey,
    })).rejects.toMatchObject({
      name: "StorageObjectAccessError",
      code: StorageObjectErrorCodes.notFound,
    } satisfies Partial<StorageObjectAccessError>);
  });
});

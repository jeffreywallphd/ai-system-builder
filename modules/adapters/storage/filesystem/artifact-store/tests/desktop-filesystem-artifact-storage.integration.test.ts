import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi, afterEach } from "vitest";

import { createStoreArtifactRequest } from "../../../../../contracts/storage";
import type { LoggingPort } from "../../../../../application/ports/logging";
import { createDesktopFilesystemArtifactStorageAdapter } from "../createDesktopFilesystemArtifactStorageAdapter";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map(async (root) => {
      await rm(root, { recursive: true, force: true });
    }),
  );
  tempRoots = [];
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "desktop-storage-adapter-"));
  tempRoots.push(root);
  return root;
}

function createLoggingPortMock(log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined)) {
  return {
    log,
  } satisfies LoggingPort;
}

describe("desktop filesystem artifact storage adapter integration", () => {
  it("writes artifact bytes to disk under the configured root and returns a contract descriptor", async () => {
    const rootDirectory = await createTempRoot();
    const log = vi.fn<LoggingPort["log"]>().mockResolvedValue(undefined);
    const adapter = createDesktopFilesystemArtifactStorageAdapter({
      rootDirectory,
      logging: createLoggingPortMock(log),
      now: () => "2026-04-14T12:00:00.000Z",
    });
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const request = createStoreArtifactRequest(bytes, {
      descriptor: {
        key: "uploads/session-1/kitten.png",
        mediaType: "image/png",
        metadata: {
          originalFileName: "kitten.png",
        },
      },
      requestId: "req-store-1",
      correlationId: "corr-store-1",
    });

    const result = await adapter.storeArtifact(request);

    expect(result).toEqual({
      ok: true,
      value: {
        key: "uploads/session-1/kitten.png",
        mediaType: "image/png",
        sizeBytes: bytes.byteLength,
        checksum: undefined,
        metadata: {
          originalFileName: "kitten.png",
        },
      },
      requestId: "req-store-1",
      correlationId: "corr-store-1",
    });

    const writtenBytes = await readFile(
      path.join(rootDirectory, "uploads", "session-1", "kitten.png"),
    );
    expect(new Uint8Array(writtenBytes)).toEqual(bytes);

    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      event: "storage.filesystem.store.started",
      operation: "storage.artifact.store",
      component: "adapters.storage.filesystem",
      host: "desktop",
    });
    expect(log.mock.calls[1]?.[0]).toMatchObject({
      event: "storage.filesystem.store.succeeded",
      operation: "storage.artifact.store",
      outcome: "success",
    });
  });

  it("generates a logical upload key when none is supplied and stores bytes on disk", async () => {
    const rootDirectory = await createTempRoot();
    const adapter = createDesktopFilesystemArtifactStorageAdapter({
      rootDirectory,
      now: () => "2026-04-14T12:00:00.000Z",
      randomSuffix: () => "abc123",
    });

    const result = await adapter.storeArtifact(
      createStoreArtifactRequest(new Uint8Array([255, 216, 255]), {
        descriptor: {
          mediaType: "image/jpeg",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected generated-key store success.");
    }

    expect(result.value.key).toBe("uploads/20260414120000000-abc123.jpg");
    expect(path.isAbsolute(result.value.key)).toBe(false);
    expect(result.value.key.includes(rootDirectory)).toBe(false);

    const writtenBytes = await readFile(
      path.join(rootDirectory, "uploads", "20260414120000000-abc123.jpg"),
    );
    expect(new Uint8Array(writtenBytes)).toEqual(new Uint8Array([255, 216, 255]));
  });

  it("returns a structured conflict failure when overwrite is disabled and key already exists", async () => {
    const rootDirectory = await createTempRoot();
    const adapter = createDesktopFilesystemArtifactStorageAdapter({
      rootDirectory,
    });
    const request = createStoreArtifactRequest(new Uint8Array([1, 2, 3]), {
      descriptor: {
        key: "uploads/conflict/same-key.png",
        mediaType: "image/png",
      },
      overwrite: false,
      requestId: "req-store-conflict",
      correlationId: "corr-store-conflict",
    });

    const firstWrite = await adapter.storeArtifact(request);
    const secondWrite = await adapter.storeArtifact(request);

    expect(firstWrite.ok).toBe(true);
    expect(secondWrite.ok).toBe(false);
    if (secondWrite.ok) {
      throw new Error("Expected second write to fail with a conflict.");
    }

    expect(secondWrite.error.code).toBe("conflict");
    expect(secondWrite.error.message).toContain("already exists");
    expect(secondWrite.error.details).toMatchObject({
      operation: "storeArtifact",
    });
    expect(secondWrite.requestId).toBe("req-store-conflict");
    expect(secondWrite.correlationId).toBe("corr-store-conflict");
  });

  it("returns a structured validation failure when storage key contains traversal segments", async () => {
    const rootDirectory = await createTempRoot();
    const adapter = createDesktopFilesystemArtifactStorageAdapter({
      rootDirectory,
    });

    const result = await adapter.storeArtifact(
      createStoreArtifactRequest(new Uint8Array([1]), {
        descriptor: {
          key: "../outside.png",
          mediaType: "image/png",
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected traversal-key validation failure.");
    }
    expect(result.error.code).toBe("validation");
    expect(result.error.details).toMatchObject({
      operation: "storeArtifact",
    });
  });
});

import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
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
import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
  type IStorageLogicalAccessResolutionService,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import {
  ImageAssetStorageAccessPurposes,
  ImageAssetStorageError,
  ImageAssetStorageErrorCodes,
  ImageAssetStorageLifecycleDeleteReasons,
  ImageAssetStorageObjectAreas,
} from "@application/image-assets/ports/ImageAssetStoragePort";
import { ManagedImageAssetStorageAdapter } from "../ManagedImageAssetStorageAdapter";

class InMemoryStorageObjectPort implements IStorageObjectPort {
  private readonly objects = new Map<string, {
    readonly bytes: Uint8Array;
    readonly writtenAt: string;
  }>();

  public failWriteWith?: StorageObjectAccessError;

  public createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult {
    const fileName = (input.originalFileName ?? "image.bin").trim().replace(/[^a-zA-Z0-9._-]/g, "-");
    return Object.freeze({
      objectKey: [
        input.namespace,
        ...input.logicalPathSegments,
        fileName,
      ].join("/"),
      normalizedFileName: fileName,
      partition: Object.freeze([]),
    });
  }

  public async writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult> {
    if (this.failWriteWith) {
      throw this.failWriteWith;
    }

    const chunks: Uint8Array[] = [];
    if (input.content instanceof Uint8Array) {
      chunks.push(input.content);
    } else {
      for await (const chunk of input.content) {
        chunks.push(chunk);
      }
    }

    const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const writtenAt = "2026-04-08T12:00:01.000Z";
    this.objects.set(this.key(input.reference), {
      bytes,
      writtenAt,
    });

    return Object.freeze({
      objectKey: input.reference.objectKey,
      sizeBytes: size,
      checksum: Object.freeze({
        algorithm: "sha256",
        digest: createHash("sha256").update(bytes).digest("hex"),
      }),
      writtenAt,
    });
  }

  public async objectExists(reference: StorageObjectReference): Promise<boolean> {
    return this.objects.has(this.key(reference));
  }

  public async readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata> {
    const stored = this.objects.get(this.key(reference));
    if (!stored) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.notFound,
        "not found",
      );
    }

    return Object.freeze({
      objectKey: reference.objectKey,
      sizeBytes: stored.bytes.byteLength,
      lastModifiedAt: stored.writtenAt,
      checksum: Object.freeze({
        algorithm: "sha256",
        digest: createHash("sha256").update(stored.bytes).digest("hex"),
      }),
    });
  }

  public async openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>> {
    const stored = this.objects.get(this.key(reference));
    if (!stored) {
      throw new StorageObjectAccessError(
        StorageObjectErrorCodes.notFound,
        "not found",
      );
    }

    return (async function* toStream() {
      yield stored.bytes;
    }());
  }

  public async deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult> {
    const deletedAt = "2026-04-08T12:00:02.000Z";
    const deleted = this.objects.delete(this.key(input.reference));
    return Object.freeze({
      objectKey: input.reference.objectKey,
      deleted,
      deletedAt,
    });
  }

  private key(reference: StorageObjectReference): string {
    return `${reference.storageInstance.id}:${reference.objectKey}`;
  }
}

class StubStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public readonly commands: Array<{
    readonly intent: string;
    readonly storageInstanceId?: string;
  }> = [];

  public nextError?: {
    readonly code: string;
    readonly message: string;
  };

  public constructor(
    private readonly storageInstance: StorageInstance,
    private readonly objectPort: IStorageObjectPort,
  ) {}

  public async resolveLogicalAccessPlan(
    command: Parameters<IStorageLogicalAccessResolutionService["resolveLogicalAccessPlan"]>[0],
  ): Promise<Awaited<ReturnType<IStorageLogicalAccessResolutionService["resolveLogicalAccessPlan"]>>> {
    this.commands.push({
      intent: command.intent,
      storageInstanceId: command.storageInstanceId,
    });

    if (this.nextError) {
      return {
        ok: false,
        error: {
          code: this.nextError.code as any,
          message: this.nextError.message,
        },
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        intent: command.intent,
        storageInstance: this.storageInstance,
        objectPort: this.objectPort,
        occurredAt: command.occurredAt ?? "2026-04-08T12:00:00.000Z",
      }),
    };
  }
}

function createStorageInstanceFixture(): StorageInstance {
  return createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    lifecycleState: StorageLifecycleStates.active,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-storage-alpha",
      maxObjectBytes: 1024 * 1024,
      encryption: {
        profileId: "enc-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-08T11:59:00.000Z",
    lastCorrelationId: "corr-storage-alpha",
  });
}

function createFixture() {
  const objectPort = new InMemoryStorageObjectPort();
  const storageInstance = createStorageInstanceFixture();
  const logicalService = new StubStorageLogicalAccessResolutionService(storageInstance, objectPort);
  const adapter = new ManagedImageAssetStorageAdapter({
    storageLogicalAccessResolutionService: logicalService,
    tokenSecret: "image-asset-storage-secret",
    clock: {
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    },
  });

  return {
    adapter,
    logicalService,
    objectPort,
  };
}

describe("ManagedImageAssetStorageAdapter", () => {
  it("reserves managed keys and performs write/read/delete flows through logical storage access", async () => {
    const fixture = createFixture();
    const reservation = await fixture.adapter.reserveStorageLocation({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      storageInstanceId: "storage-alpha",
      area: ImageAssetStorageObjectAreas.original,
      normalizedFileName: "photo.png",
      mediaType: "image/png",
    });

    expect(reservation.reservationId.startsWith("imgastokv1.")).toBeTrue();
    expect(reservation.reference.storageInstanceId).toBe("storage-alpha");
    expect(reservation.reference.objectKey.startsWith("workspaces/workspace-alpha/image-assets/image-asset:001/original/"))
      .toBeTrue();

    const written = await fixture.adapter.writeObject({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      reservationId: reservation.reservationId,
      reference: reservation.reference,
      content: new Uint8Array([1, 2, 3, 4]),
      expectedSizeBytes: 4,
    });

    expect(written.sizeBytes).toBe(4);

    const opened = await fixture.adapter.openReadStream({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      purpose: ImageAssetStorageAccessPurposes.downloadOriginal,
      reference: written.reference,
    });

    let observedSize = 0;
    for await (const chunk of opened.stream) {
      observedSize += chunk.byteLength;
    }
    expect(observedSize).toBe(4);
    expect(opened.mediaType).toBe("image/png");

    const deleted = await fixture.adapter.deleteObject({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      reason: ImageAssetStorageLifecycleDeleteReasons.assetDeleted,
      reference: written.reference,
    });
    expect(deleted.deleted).toBeTrue();

    expect(fixture.logicalService.commands.map((entry) => entry.intent)).toEqual([
      StorageLogicalAccessOperationIntents.createObjectKey,
      StorageLogicalAccessOperationIntents.writeObject,
      StorageLogicalAccessOperationIntents.openObjectReadStream,
      StorageLogicalAccessOperationIntents.deleteObject,
    ]);
  });

  it("rejects write reservations that do not match actor/workspace/reference claims", async () => {
    const fixture = createFixture();
    const reservation = await fixture.adapter.reserveStorageLocation({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      storageInstanceId: "storage-alpha",
      area: ImageAssetStorageObjectAreas.original,
      normalizedFileName: "source.png",
    });

    await expect(fixture.adapter.writeObject({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-other",
      reservationId: reservation.reservationId,
      reference: reservation.reference,
      content: new Uint8Array([1]),
    })).rejects.toEqual(expect.objectContaining({
      code: ImageAssetStorageErrorCodes.reservationDenied,
    }));
  });

  it("creates and resolves opaque access handles with actor/workspace scoping and expiry", async () => {
    const fixture = createFixture();
    const issued = await fixture.adapter.createAccessHandle({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      purpose: ImageAssetStorageAccessPurposes.inlinePreview,
      reference: {
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/preview/photo.webp",
        area: ImageAssetStorageObjectAreas.preview,
      },
      expiresInSeconds: 30,
    });

    const resolved = await fixture.adapter.resolveAccessHandle({
      handleToken: issued.handleToken,
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:00:10.000Z",
    });

    expect(resolved?.purpose).toBe(ImageAssetStorageAccessPurposes.inlinePreview);

    const expired = await fixture.adapter.resolveAccessHandle({
      handleToken: issued.handleToken,
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:01:00.000Z",
    });
    expect(expired).toBeUndefined();
  });

  it("maps logical-access and storage-object errors to image-asset storage error codes", async () => {
    const fixture = createFixture();
    fixture.logicalService.nextError = {
      code: StorageLogicalAccessResolutionErrorCodes.policyViolation,
      message: "denied",
    };

    await expect(fixture.adapter.reserveStorageLocation({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      storageInstanceId: "storage-alpha",
      area: ImageAssetStorageObjectAreas.original,
    })).rejects.toEqual(expect.objectContaining({
      code: ImageAssetStorageErrorCodes.accessDenied,
    }));

    fixture.logicalService.nextError = undefined;
    fixture.objectPort.failWriteWith = new StorageObjectAccessError(
      StorageObjectErrorCodes.sizeLimitExceeded,
      "too big",
    );

    const reservation = await fixture.adapter.reserveStorageLocation({
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      actorUserId: "user-owner",
      storageInstanceId: "storage-alpha",
      area: ImageAssetStorageObjectAreas.original,
    });

    try {
      await fixture.adapter.writeObject({
        workspaceId: "workspace-alpha",
        assetId: "image-asset:001",
        actorUserId: "user-owner",
        reservationId: reservation.reservationId,
        reference: reservation.reference,
        content: new Uint8Array([1, 2, 3]),
      });
      throw new Error("Expected writeObject to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageAssetStorageError);
      expect((error as ImageAssetStorageError).code).toBe(ImageAssetStorageErrorCodes.sizeLimitExceeded);
    }
  });
});

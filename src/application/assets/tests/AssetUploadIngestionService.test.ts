import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  AssetKinds,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  type Asset,
} from "../../../domain/assets/AssetDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type {
  AssetUploadSessionRecord,
  IAssetUploadSessionRepository,
} from "../ports/IAssetUploadSessionRepository";
import type {
  IStorageLogicalAccessResolutionService,
  StorageLogicalAccessResolutionPlan,
  StorageLogicalAccessResolutionResult,
} from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import {
  StorageLogicalAccessOperationIntents,
} from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IStorageObjectPort } from "../../storage/ports/StorageObjectPort";
import { AssetUploadIngestionService } from "../use-cases/AssetUploadIngestionService";

class InMemoryAssetRepository implements IAssetRepository {
  public readonly records = new Map<string, Asset>();

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.records.get(assetId);
  }

  public async listAssets(): Promise<ReadonlyArray<Asset>> {
    return Object.freeze([...this.records.values()]);
  }

  public async createAsset(asset: Asset) {
    this.records.set(asset.id, asset);
    return Object.freeze({ changed: true, asset });
  }

  public async saveAsset(asset: Asset) {
    this.records.set(asset.id, asset);
    return Object.freeze({ changed: true, asset });
  }

  public async replaceAssetLineage(): Promise<void> {
    return;
  }
}

class InMemoryUploadSessionRepository implements IAssetUploadSessionRepository {
  public readonly records = new Map<string, AssetUploadSessionRecord>();

  public async createUploadSession(session: AssetUploadSessionRecord): Promise<void> {
    this.records.set(session.uploadSessionId, session);
  }

  public async findUploadSessionById(uploadSessionId: string): Promise<AssetUploadSessionRecord | undefined> {
    return this.records.get(uploadSessionId);
  }

  public async saveUploadSession(session: AssetUploadSessionRecord): Promise<void> {
    this.records.set(session.uploadSessionId, session);
  }
}

class InMemoryStorageObjectPort implements IStorageObjectPort {
  public readonly objects = new Map<string, Uint8Array>();

  public failWrites = false;

  public createObjectKey() {
    return {
      objectKey: "assets/input/file.bin",
      normalizedFileName: "file.bin",
      partition: ["aa", "bb"],
    } as const;
  }

  public async writeObject(input: Parameters<IStorageObjectPort["writeObject"]>[0]) {
    if (this.failWrites) {
      throw new Error("write failed");
    }

    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    const hasher = createHash("sha256");
    for await (const chunk of input.content) {
      sizeBytes += chunk.byteLength;
      const asBuffer = Buffer.from(chunk);
      chunks.push(asBuffer);
      hasher.update(asBuffer);
    }
    this.objects.set(input.reference.objectKey, Buffer.concat(chunks));

    return {
      objectKey: input.reference.objectKey,
      sizeBytes,
      checksum: {
        algorithm: "sha256" as const,
        digest: hasher.digest("hex"),
      },
      writtenAt: "2026-04-06T12:00:00.000Z",
    };
  }

  public async objectExists(reference: Parameters<IStorageObjectPort["objectExists"]>[0]) {
    return this.objects.has(reference.objectKey);
  }

  public async readObjectMetadata(reference: Parameters<IStorageObjectPort["readObjectMetadata"]>[0]) {
    const value = this.objects.get(reference.objectKey);
    if (!value) {
      throw new Error("not found");
    }
    return {
      objectKey: reference.objectKey,
      sizeBytes: value.byteLength,
      lastModifiedAt: "2026-04-06T12:00:00.000Z",
    };
  }

  public async openObjectReadStream(reference: Parameters<IStorageObjectPort["openObjectReadStream"]>[0]) {
    const value = this.objects.get(reference.objectKey);
    if (!value) {
      throw new Error("not found");
    }
    return (async function* stream() {
      yield value;
    })();
  }

  public async deleteObject(input: Parameters<IStorageObjectPort["deleteObject"]>[0]) {
    const deleted = this.objects.delete(input.reference.objectKey);
    return {
      objectKey: input.reference.objectKey,
      deleted,
      deletedAt: "2026-04-06T12:00:00.000Z",
    };
  }
}

class StubStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(
    private readonly plan: StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>,
  ) {}

  public async resolveLogicalAccessPlan(
    command: Parameters<IStorageLogicalAccessResolutionService["resolveLogicalAccessPlan"]>[0],
  ): Promise<StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>> {
    expect(command.intent).toBe(StorageLogicalAccessOperationIntents.writeObject);
    return this.plan;
  }
}

function createStorage(): StorageInstance {
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
      policyId: "policy-alpha",
      maxObjectBytes: 1024 * 1024,
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T11:00:00.000Z",
    lastCorrelationId: "corr-storage",
  });
}

async function seedAsset(repository: InMemoryAssetRepository): Promise<void> {
  await repository.createAsset(createAsset({
    id: "asset-upload-001",
    kind: AssetKinds.uploadedFile,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T11:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: "asset-upload-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/seed.bin",
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "application/octet-stream",
        sizeBytes: 4,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T11:00:00.000Z",
    }),
  }));
}

async function seedPendingSession(repository: InMemoryUploadSessionRepository, expectedSizeBytes: number): Promise<void> {
  await repository.createUploadSession({
    uploadSessionId: "asset-upload-session:test-001",
    workspaceId: "workspace-alpha",
    assetId: "asset-upload-001",
    actorUserId: "user-owner",
    storageInstanceId: "storage-alpha",
    objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/asset-upload-session-test-001/file.bin",
    area: "input",
    expected: {
      fileName: "file.bin",
      mimeType: "application/octet-stream",
      sizeBytes: expectedSizeBytes,
    },
    status: "pending",
    expiresAt: "2026-04-06T12:15:00.000Z",
    createdAt: "2026-04-06T12:00:00.000Z",
    updatedAt: "2026-04-06T12:00:00.000Z",
  });
}

function toContent(chunks: ReadonlyArray<string>): AsyncIterable<Uint8Array> {
  return (async function* stream() {
    for (const chunk of chunks) {
      yield Buffer.from(chunk, "utf8");
    }
  })();
}

describe("AssetUploadIngestionService", () => {
  it("stores uploaded content through storage adapter and finalizes asset metadata", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    await seedAsset(assetRepository);
    await seedPendingSession(uploadSessionRepository, 12);

    const service = new AssetUploadIngestionService({
      repository: assetRepository,
      uploadSessionRepository,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService({
        ok: true,
        value: {
          intent: StorageLogicalAccessOperationIntents.writeObject,
          storageInstance: storage,
          objectPort,
          occurredAt: "2026-04-06T12:00:00.000Z",
        },
      }),
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:1",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: toContent(["hello ", "world!"]),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.finalizedVersionId).toBe("asset-upload-001:v2");
    expect(result.value.content.sizeBytes).toBe(12);
    expect(result.value.content.checksum.algorithm).toBe("sha256");

    const persistedAsset = await assetRepository.findAssetById("asset-upload-001");
    expect(persistedAsset?.versions.length).toBe(2);
    expect(persistedAsset?.currentVersionId).toBe("asset-upload-001:v2");

    const uploadSession = await uploadSessionRepository.findUploadSessionById("asset-upload-session:test-001");
    expect(uploadSession?.status).toBe("completed");
    expect(uploadSession?.finalizedVersionId).toBe("asset-upload-001:v2");
  });

  it("marks sessions incomplete for oversized uploads and does not finalize asset", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    await seedAsset(assetRepository);
    await seedPendingSession(uploadSessionRepository, 4);

    const service = new AssetUploadIngestionService({
      repository: assetRepository,
      uploadSessionRepository,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService({
        ok: true,
        value: {
          intent: StorageLogicalAccessOperationIntents.writeObject,
          storageInstance: storage,
          objectPort,
          occurredAt: "2026-04-06T12:00:00.000Z",
        },
      }),
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:oversize",
      uploadSessionId: "asset-upload-session:test-001",
      content: toContent(["too-large"]),
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "asset-policy-violation",
      }),
    });

    const persistedAsset = await assetRepository.findAssetById("asset-upload-001");
    expect(persistedAsset?.versions.length).toBe(1);

    const uploadSession = await uploadSessionRepository.findUploadSessionById("asset-upload-session:test-001");
    expect(uploadSession?.status).toBe("incomplete");
    expect(uploadSession?.incompleteReasonCode).toBe("upload-payload-too-large");
  });

  it("marks sessions incomplete for interrupted uploads", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    await seedAsset(assetRepository);
    await seedPendingSession(uploadSessionRepository, 8);

    const service = new AssetUploadIngestionService({
      repository: assetRepository,
      uploadSessionRepository,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService({
        ok: true,
        value: {
          intent: StorageLogicalAccessOperationIntents.writeObject,
          storageInstance: storage,
          objectPort,
          occurredAt: "2026-04-06T12:00:00.000Z",
        },
      }),
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:interrupted",
      uploadSessionId: "asset-upload-session:test-001",
      content: toContent(["short"]),
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "asset-invalid-request",
      }),
    });

    const persistedAsset = await assetRepository.findAssetById("asset-upload-001");
    expect(persistedAsset?.versions.length).toBe(1);

    const uploadSession = await uploadSessionRepository.findUploadSessionById("asset-upload-session:test-001");
    expect(uploadSession?.status).toBe("incomplete");
    expect(uploadSession?.incompleteReasonCode).toBe("upload-size-mismatch");
  });

  it("finalizes descriptor metadata using detected checksum and normalized mime type", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    await seedAsset(assetRepository);
    await seedPendingSession(uploadSessionRepository, 11);

    const service = new AssetUploadIngestionService({
      repository: assetRepository,
      uploadSessionRepository,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService({
        ok: true,
        value: {
          intent: StorageLogicalAccessOperationIntents.writeObject,
          storageInstance: storage,
          objectPort,
          occurredAt: "2026-04-06T12:00:00.000Z",
        },
      }),
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:metadata",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "text/plain; charset=utf-8",
      content: toContent(["hello world"]),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.content.mimeType).toBe("text/plain");

    const persisted = await assetRepository.findAssetById("asset-upload-001");
    const version = persisted?.versions[persisted.versions.length - 1];
    expect(version?.content.mimeType).toBe("text/plain");
    expect(version?.content.sizeBytes).toBe(11);
    expect(version?.content.checksum.algorithm).toBe("sha256");
    expect(version?.content.checksum.digest.length).toBe(64);
    expect(version?.content.originalFileName).toBe("file.bin");
  });
});

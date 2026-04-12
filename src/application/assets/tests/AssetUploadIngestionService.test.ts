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
} from "@domain/assets/AssetDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
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
import type { AssetAuditEvent, AssetAuditSink } from "../ports/AssetAuditPort";
import type { IEncryptionAtRestPolicyContextResolverPort } from "../../security/ports/EncryptionAtRestPolicyEvaluationPorts";
import { EncryptionPolicyEvaluationService } from "../../security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "../../security/use-cases/EncryptionKeyResolutionService";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import { DeterministicScopeEncryptionKeyPort } from "@infrastructure/security/encryption/DeterministicScopeEncryptionKeyPort";
import { AesGcmAssetContentCipherPort } from "@infrastructure/security/encryption/AesGcmAssetContentCipherPort";
import type { IEncryptionEnforcementObservabilityPort } from "../../security/ports/EncryptionEnforcementObservabilityPorts";

class InMemoryAssetRepository implements IAssetRepository {
  public readonly records = new Map<string, Asset>();

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.records.get(assetId);
  }

  public async listAssets(
    _query: Parameters<IAssetRepository["listAssets"]>[0],
  ): Promise<ReadonlyArray<Asset>> {
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

class RecordingAuditSink implements AssetAuditSink {
  public readonly events: AssetAuditEvent[] = [];

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class RecordingEncryptionObservabilityPort implements IEncryptionEnforcementObservabilityPort {
  public readonly events: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0][] = [];

  public async recordEncryptionEnforcementEvent(
    event: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
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

function createEncryptionDependencies(contentEncryptionRequired: boolean) {
  const policyResolver: IEncryptionAtRestPolicyContextResolverPort = {
    async resolvePolicyContext() {
      return Object.freeze({
        platformPolicy: createEncryptionAtRestPolicyDefinition({
          policyId: "policy:platform:test",
          scope: EncryptionPolicyScopes.platform,
          rules: Object.freeze([
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMaterial,
              encryptionMode: EncryptionModes.scopedContent,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.sensitiveMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
          ]),
        }),
        storageInstancePolicy: createEncryptionAtRestPolicyDefinition({
          policyId: "policy:storage:test",
          scope: EncryptionPolicyScopes.storageInstance,
          workspaceId: "workspace-alpha",
          storageInstanceId: "storage-alpha",
          rules: Object.freeze([
            Object.freeze({
              dataClass: ProtectedDataClasses.assetContent,
              encryptionMode: contentEncryptionRequired ? EncryptionModes.scopedContent : EncryptionModes.none,
              keyScope: contentEncryptionRequired ? EncryptionKeyScopes.storageInstance : undefined,
              decryption: Object.freeze({
                allowPreview: contentEncryptionRequired,
                allowWorker: contentEncryptionRequired,
              }),
            }),
          ]),
        }),
      });
    },
  };

  const keyPort = new DeterministicScopeEncryptionKeyPort({
    encodedKey: Buffer.alloc(32, 7).toString("base64"),
    keyPrefix: "kek:asset-content:test",
  });

  const encryptionPolicyEvaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: policyResolver,
  });
  const encryptionKeyResolutionService = new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService,
    encryptionKeyCatalogPort: keyPort,
  });
  const assetContentCipherPort = new AesGcmAssetContentCipherPort({
    keyMaterialPort: keyPort,
  });

  return {
    encryptionPolicyEvaluationService,
    encryptionKeyResolutionService,
    assetContentCipherPort,
  };
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
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
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
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
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
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
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
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
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

  it("rejects invalid or mismatched upload content types", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const invalidContentType = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:content-type-invalid",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "not-a-mime-type",
      content: toContent(["hello world"]),
    });
    expect(invalidContentType.ok).toBeFalse();
    if (invalidContentType.ok) {
      return;
    }
    expect(invalidContentType.error.code).toBe("asset-invalid-request");

    await seedPendingSession(uploadSessionRepository, 11);
    const mismatchedContentType = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:content-type-mismatch",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "image/png",
      content: toContent(["hello world"]),
    });
    expect(mismatchedContentType.ok).toBeFalse();
    if (mismatchedContentType.ok) {
      return;
    }
    expect(mismatchedContentType.error.code).toBe("asset-invalid-request");

    const uploadSession = await uploadSessionRepository.findUploadSessionById("asset-upload-session:test-001");
    expect(uploadSession?.status).toBe("incomplete");
    expect(uploadSession?.incompleteReasonCode).toBe("upload-content-type-mismatch");
  });

  it("encrypts ingested content when policy requires scoped-content encryption", async () => {
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    const encryption = createEncryptionDependencies(true);
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
      ...encryption,
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:encrypted",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: toContent(["hello world"]),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    const storedObject = objectPort.objects.get(
      "workspaces/workspace-alpha/assets/asset-upload-001/input/asset-upload-session-test-001/file.bin",
    );
    expect(storedObject).toBeDefined();
    expect(storedObject && Buffer.from(storedObject).toString("utf8")).not.toBe("hello world");

    const persisted = await assetRepository.findAssetById("asset-upload-001");
    const latestVersion = persisted?.versions[persisted.versions.length - 1];
    expect(latestVersion?.content.encryption?.format).toBe("asset-content/aes-256-gcm/v1");
    expect(latestVersion?.content.encryption?.keyReferenceId).toContain("kek:asset-content:test");
  });

  it("emits upload-finalized audit events for success and rejected outcomes", async () => {
    const auditSink = new RecordingAuditSink();
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    const encryption = createEncryptionDependencies(false);
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
      ...encryption,
      auditSink,
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const successful = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:audit",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: toContent(["hello world"]),
    });
    expect(successful.ok).toBeTrue();

    const failed = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:audit-failed",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: toContent(["hello world"]),
    });
    expect(failed.ok).toBeFalse();

    expect(auditSink.events.some((event) => event.type === "asset-upload-finalized" && event.outcome === "success")).toBeTrue();
    expect(auditSink.events.some((event) => event.type === "asset-upload-finalized" && event.outcome !== "success")).toBeTrue();
  });

  it("emits encryption enforcement diagnostics for protected-write policy and key-scope outcomes", async () => {
    const encryptionObservabilityPort = new RecordingEncryptionObservabilityPort();
    const assetRepository = new InMemoryAssetRepository();
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const storage = createStorage();
    const encryption = createEncryptionDependencies(true);
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
      ...encryption,
      encryptionObservabilityPort,
      clock: {
        now: () => new Date("2026-04-06T12:00:00.000Z"),
      },
    });

    const result = await service.ingestUploadContent({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:upload:finalize:encryption-observability",
      uploadSessionId: "asset-upload-session:test-001",
      contentType: "application/octet-stream",
      content: toContent(["hello world"]),
      correlationId: "corr-upload-encryption-observability",
    });

    expect(result.ok).toBeTrue();
    expect(encryptionObservabilityPort.events.some((event) => (
      event.event === "asset-content.protected-write-evaluated"
      && event.outcome === "succeeded"
    ))).toBeTrue();
    expect(encryptionObservabilityPort.events.some((event) => (
      event.event === "asset-content.protected-write-key-scope-resolved"
      && event.outcome === "succeeded"
    ))).toBeTrue();
    expect(encryptionObservabilityPort.events.some((event) => (
      event.event === "asset-content.protected-write-completed"
      && event.outcome === "succeeded"
    ))).toBeTrue();
  });
});


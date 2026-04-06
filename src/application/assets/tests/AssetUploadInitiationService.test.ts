import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "../../../domain/storage/StorageDomain";
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
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IStorageInstanceRepository } from "../../storage/ports/IStorageInstanceRepository";
import type { IStoragePolicyEvaluationPort } from "../../storage/ports/StoragePolicyEvaluationPort";
import { AssetUploadInitiationService } from "../use-cases/AssetUploadInitiationService";

class InMemoryAssetRepository implements IAssetRepository {
  private readonly records = new Map<string, Asset>();

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.records.get(assetId);
  }

  public async listAssets(): Promise<ReadonlyArray<Asset>> {
    return Object.freeze([...this.records.values()]);
  }

  public async createAsset(asset: Asset) {
    if (this.records.has(asset.id)) {
      throw new Error(`Asset '${asset.id}' already exists.`);
    }
    this.records.set(asset.id, asset);
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async saveAsset(asset: Asset) {
    this.records.set(asset.id, asset);
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async replaceAssetLineage(): Promise<void> {
    return;
  }
}

class WorkspaceAuthorizationRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  public isAdmin = false;

  public async getWorkspaceAuthorizationSnapshot(
    query: Parameters<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>[0],
  ): Promise<Awaited<ReturnType<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>>> {
    if (!this.allow) {
      return undefined;
    }
    return Object.freeze({
      workspace: {
        id: query.workspaceId,
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        status: "active",
        ownership: {
          workspaceId: query.workspaceId,
          ownerUserId: "user-owner",
          visibility: "team",
          createdBy: "user-owner",
          lastModifiedBy: "user-owner",
          createdAt: "2026-04-06T10:00:00.000Z",
          lastModifiedAt: "2026-04-06T10:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-06T10:00:00.000Z",
        updatedAt: "2026-04-06T10:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

class StorageRepository implements IStorageInstanceRepository {
  public instance: StorageInstance = createStorageInstance({
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
    createdAt: "2026-04-06T10:00:00.000Z",
    lastCorrelationId: "corr-seed-storage",
  });

  public async findStorageInstanceById(_storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.instance;
  }

  public async listStorageInstances(_query: any): Promise<ReadonlyArray<StorageInstance>> {
    return Object.freeze([this.instance]);
  }

  public async createStorageInstance(_storageInstance: any, _mutation: any): Promise<any> {
    throw new Error("not used");
  }

  public async saveStorageInstance(_storageInstance: any, _mutation: any): Promise<any> {
    throw new Error("not used");
  }
}

class StoragePolicyPort implements IStoragePolicyEvaluationPort {
  public allow = true;

  public async evaluateStorageAction(
    input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0],
  ): Promise<Awaited<ReturnType<IStoragePolicyEvaluationPort["evaluateStorageAction"]>>> {
    if (!this.allow) {
      return Object.freeze({
        allowed: false,
        reasonCode: "workspace-admin-required",
        message: "Denied.",
        occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
      });
    }
    return Object.freeze({
      allowed: true,
      reasonCode: "allowed",
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    });
  }

  public async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

function buildService() {
  const repository = new InMemoryAssetRepository();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationRepository();
  const storageInstanceRepository = new StorageRepository();
  const storagePolicyEvaluationPort = new StoragePolicyPort();
  const service = new AssetUploadInitiationService({
    repository,
    workspaceAuthorizationReadRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort,
    idGenerator: {
      nextId: () => "session-001",
    },
    clock: {
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    },
  });

  return {
    service,
    repository,
    workspaceAuthorizationReadRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort,
  };
}

async function seedAsset(repository: InMemoryAssetRepository): Promise<Asset> {
  const asset = createAsset({
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
        objectKey: "workspaces/workspace-alpha/assets/asset-upload-001/input/v1/seed.png",
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 64,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T11:00:00.000Z",
    }),
  });
  await repository.createAsset(asset);
  return asset;
}

describe("AssetUploadInitiationService", () => {
  it("registers an asset and initiates upload for an authorized user", async () => {
    const { service, repository } = buildService();

    const registered = await service.registerAsset({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:register:1",
      assetId: "asset-register-001",
      kind: "uploaded-file",
      storageInstanceId: "storage-alpha",
      ownerUserId: "user-owner",
      visibility: "private",
      initialVersion: {
        versionId: "asset-register-001:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-register-001/input/v1/image.png",
        area: "input",
        content: {
          mimeType: "image/png",
          sizeBytes: 128,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
          originalFileName: "image.png",
        },
      },
    });

    expect(registered.ok).toBeTrue();
    if (!registered.ok) {
      return;
    }
    expect(registered.value.asset.id).toBe("asset-register-001");

    await seedAsset(repository);
    const initiated = await service.beginAssetUpload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:begin:1",
      assetId: "asset-upload-001",
      storageInstanceId: "storage-alpha",
      fileName: "upload.png",
      mimeType: "image/png",
      sizeBytes: 512,
    });
    expect(initiated.ok).toBeTrue();
    if (!initiated.ok) {
      return;
    }
    expect(initiated.value.upload.uploadSessionId).toContain("asset-upload-session:");
    expect(initiated.value.upload.uploadEndpoint).toContain("/api/v1/assets/upload-sessions/");
    expect(initiated.value.upload.objectKey).toContain("workspaces/workspace-alpha/assets/asset-upload-001/input");
  });

  it("rejects upload initiation when workspace membership is missing", async () => {
    const {
      service,
      repository,
      workspaceAuthorizationReadRepository,
    } = buildService();
    await seedAsset(repository);
    workspaceAuthorizationReadRepository.allow = false;

    const denied = await service.beginAssetUpload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:begin:denied",
      assetId: "asset-upload-001",
      storageInstanceId: "storage-alpha",
      fileName: "upload.png",
      mimeType: "image/png",
      sizeBytes: 512,
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "asset-access-denied",
      }),
    });
  });

  it("rejects storage/workspace mismatches for upload initiation", async () => {
    const {
      service,
      repository,
      storageInstanceRepository,
    } = buildService();
    await seedAsset(repository);
    storageInstanceRepository.instance = createStorageInstance({
      ...storageInstanceRepository.instance,
      ownership: {
        workspaceId: "workspace-beta",
        ownerUserIdentityId: "user-owner",
      },
      lastCorrelationId: "corr-storage-mismatch",
    });

    const denied = await service.beginAssetUpload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:begin:mismatch",
      assetId: "asset-upload-001",
      storageInstanceId: "storage-alpha",
      fileName: "upload.png",
      mimeType: "image/png",
      sizeBytes: 512,
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "asset-not-found",
      }),
    });
  });
});

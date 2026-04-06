import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IAssetDownloadGrantPort } from "../ports/AssetDownloadGrantPort";
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
  createStoragePolicy,
} from "../../../domain/storage/StorageDomain";
import { AssetDownloadPurposes } from "../use-cases/AssetServiceContracts";
import { AssetDownloadService } from "../use-cases/AssetDownloadService";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly asset: Asset) {}

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.asset.id === assetId ? this.asset : undefined;
  }

  public async listAssets(): Promise<ReadonlyArray<Asset>> {
    return Object.freeze([this.asset]);
  }

  public async createAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async saveAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async replaceAssetLineage(): Promise<void> {
    throw new Error("not implemented");
  }
}

class WorkspaceAuthorizationRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  public isAdmin = false;

  public async getWorkspaceAuthorizationSnapshot(
    query: Parameters<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>[0],
  ) {
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
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

class StubStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  private readonly storageInstance = createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: createStoragePolicy({
      policyId: "policy-alpha",
      allowCrossWorkspaceReads: false,
      immutableWrites: false,
      encryption: {
        profileId: "enc-profile",
        envelopeRequired: true,
      },
      security: {
        allowPreviewDecryption: true,
        allowWorkerDecryption: true,
      },
    }),
    lifecycleState: StorageLifecycleStates.active,
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastModifiedBy: "user-owner",
    lastModifiedAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-alpha",
  });

  public async resolveLogicalAccessPlan() {
    return {
      ok: true as const,
      value: {
        intent: "open-object-read-stream" as const,
        storageInstance: this.storageInstance,
        objectPort: {
          createObjectKey: () => {
            throw new Error("not used");
          },
          writeObject: async () => {
            throw new Error("not used");
          },
          objectExists: async () => true,
          readObjectMetadata: async () => ({
            objectKey: "object",
            sizeBytes: 5,
            lastModifiedAt: "2026-04-06T12:00:00.000Z",
          }),
          openObjectReadStream: async function* () {
            yield Buffer.from("hello", "utf8");
          },
          deleteObject: async () => ({
            objectKey: "object",
            deleted: true,
            deletedAt: "2026-04-06T12:00:00.000Z",
          }),
        },
        occurredAt: "2026-04-06T12:00:00.000Z",
      },
    };
  }
}

class InMemoryDownloadGrantPort implements IAssetDownloadGrantPort {
  private readonly grants = new Map<string, Awaited<ReturnType<IAssetDownloadGrantPort["resolveDownloadGrant"]>>>();

  public async issueDownloadGrant(request: Parameters<IAssetDownloadGrantPort["issueDownloadGrant"]>[0]) {
    const token = `token-${request.assetId}-${request.versionId}`;
    this.grants.set(token, {
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      assetId: request.assetId,
      versionId: request.versionId,
      storageInstanceId: request.storageInstanceId,
      objectKey: request.objectKey,
      objectVersionId: request.objectVersionId,
      area: request.area,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      contentDispositionFileName: request.contentDispositionFileName,
      purpose: request.purpose,
      expiresAt: "2026-04-06T12:10:00.000Z",
    });
    return Object.freeze({
      contentToken: token,
      expiresAt: "2026-04-06T12:10:00.000Z",
    });
  }

  public async resolveDownloadGrant(request: Parameters<IAssetDownloadGrantPort["resolveDownloadGrant"]>[0]) {
    const claim = this.grants.get(request.contentToken);
    if (!claim) {
      return undefined;
    }
    return claim;
  }
}

function createTestAsset(): Asset {
  return createAsset({
    id: "asset-download-001",
    kind: AssetKinds.generatedOutput,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: "asset-download-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-download-001/output/v1/file.png",
        area: "output",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 5,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
        originalFileName: "file.png",
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

describe("AssetDownloadService", () => {
  it("authorizes download and opens a streaming response for the same actor", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const grantPort = new InMemoryDownloadGrantPort();
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: grantPort,
    });

    const authorization = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });
    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      return;
    }
    expect(authorization.value.contentToken).toContain("token-asset-download-001");

    const streamResult = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: authorization.value.contentToken,
    });
    expect(streamResult.ok).toBeTrue();
    if (!streamResult.ok) {
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.value.stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe("hello");
  });

  it("returns not-found for private assets owned by another user", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-not-found");
  });

  it("blocks stream opening when content token is invalid", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
    });

    const outcome = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: "invalid-token",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-access-denied");
  });
});


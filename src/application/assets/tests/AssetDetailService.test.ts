import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
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
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import { AssetDetailService } from "../use-cases/AssetDetailService";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly assets: ReadonlyArray<Asset>) {}

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.assets.find((asset) => asset.id === assetId);
  }

  public async listAssets(
    _query: Parameters<IAssetRepository["listAssets"]>[0],
  ): Promise<ReadonlyArray<Asset>> {
    return Object.freeze(this.assets);
  }

  public async createAsset(
    asset: Parameters<IAssetRepository["createAsset"]>[0],
  ): Promise<Awaited<ReturnType<IAssetRepository["createAsset"]>>> {
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async saveAsset(
    asset: Parameters<IAssetRepository["saveAsset"]>[0],
  ): Promise<Awaited<ReturnType<IAssetRepository["saveAsset"]>>> {
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async replaceAssetLineage(
    _assetId: string,
    _lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void> {
    // not used in tests
  }

  public async listAssetLineage(): Promise<ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation?: string;
  }>> {
    return Object.freeze([Object.freeze({
      sourceAssetId: "asset-source-001",
      sourceAssetVersionId: "asset-source-001:v3",
      relation: "derived-from",
    })]);
  }

  public async getAssetGeneratedOutputSource(): Promise<{
    readonly producerType: "run";
    readonly runId: string;
    readonly systemId: string;
  }> {
    return Object.freeze({
      producerType: "run",
      runId: "execution-run-001",
      systemId: "system-render",
    });
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

function createTestAsset(input: {
  readonly id: string;
  readonly ownerUserId: string;
  readonly visibility: Asset["visibility"];
}): Asset {
  return createAsset({
    id: input.id,
    kind: AssetKinds.generatedOutput,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: input.ownerUserId,
      createdBy: input.ownerUserId,
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: input.visibility,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: `${input.id}:v1`,
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: `workspaces/workspace-alpha/assets/${input.id}/output/v1/file.png`,
        area: "output",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 2,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: input.ownerUserId,
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

describe("AssetDetailService", () => {
  it("returns detail metadata and lineage hooks for authorized actors", async () => {
    const authorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDetailService({
      repository: new InMemoryAssetRepository([
        createTestAsset({
          id: "asset-detail-001",
          ownerUserId: "user-owner",
          visibility: AssetVisibilities.private,
        }),
      ]),
      workspaceAuthorizationReadRepository: authorization,
    });

    const outcome = await service.getAssetById({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-detail-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.asset.id).toBe("asset-detail-001");
    expect(outcome.value.metadata.uploadState).toBe("ready");
    expect(outcome.value.metadata.previewAvailable).toBeTrue();
    expect(outcome.value.metadata.allowedActions.canInitiateUpload).toBeTrue();
    expect(outcome.value.metadata.lineage.sources[0]?.sourceAssetId).toBe("asset-source-001");
    expect(outcome.value.metadata.generatedOutputSource).toEqual({
      producerType: "run",
      runId: "execution-run-001",
      systemId: "system-render",
    });
  });

  it("returns safe not-found for non-owner private assets", async () => {
    const authorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDetailService({
      repository: new InMemoryAssetRepository([
        createTestAsset({
          id: "asset-detail-private",
          ownerUserId: "user-owner",
          visibility: AssetVisibilities.private,
        }),
      ]),
      workspaceAuthorizationReadRepository: authorization,
    });

    const outcome = await service.getAssetById({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      assetId: "asset-detail-private",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-not-found");
  });
});


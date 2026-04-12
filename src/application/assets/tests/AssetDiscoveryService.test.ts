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
import { AssetDiscoveryService } from "../use-cases/AssetDiscoveryService";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly assets: ReadonlyArray<Asset>) {}

  public async findAssetById(): Promise<Asset | undefined> {
    return undefined;
  }

  public async listAssets(query: Parameters<IAssetRepository["listAssets"]>[0]): Promise<ReadonlyArray<Asset>> {
    let filtered = [...this.assets];
    if (query.workspaceId) {
      filtered = filtered.filter((item) => item.ownership.workspaceId === query.workspaceId);
    }
    if (query.ownerUserId) {
      filtered = filtered.filter((item) => item.ownership.ownerUserId === query.ownerUserId);
    }
    if (query.createdByUserId) {
      filtered = filtered.filter((item) => item.ownership.createdBy === query.createdByUserId);
    }
    if (query.assetKinds && query.assetKinds.length > 0) {
      filtered = filtered.filter((item) => query.assetKinds?.includes(item.kind));
    }
    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      filtered = filtered.filter((item) => query.lifecycleStates?.includes(item.lifecycle.state));
    }
    if (query.visibilities && query.visibilities.length > 0) {
      filtered = filtered.filter((item) => query.visibilities?.includes(item.visibility));
    }
    if (typeof query.offset === "number") {
      filtered = filtered.slice(query.offset);
    }
    if (typeof query.limit === "number") {
      filtered = filtered.slice(0, query.limit);
    }
    return Object.freeze(filtered);
  }

  public async createAsset(
    asset: Parameters<IAssetRepository["createAsset"]>[0],
  ): Promise<Awaited<ReturnType<IAssetRepository["createAsset"]>>> {
    const result = Object.freeze({
      changed: true,
      asset,
    });
    return result;
  }

  public async saveAsset(
    asset: Parameters<IAssetRepository["saveAsset"]>[0],
  ): Promise<Awaited<ReturnType<IAssetRepository["saveAsset"]>>> {
    const result = Object.freeze({
      changed: true,
      asset,
    });
    return result;
  }

  public async replaceAssetLineage(
    _assetId: string,
    _lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void> {
    throw new Error("not used");
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
  readonly createdBy?: string;
  readonly kind?: Asset["kind"];
}): Asset {
  return createAsset({
    id: input.id,
    kind: input.kind ?? AssetKinds.uploadedFile,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: input.ownerUserId,
      createdBy: input.createdBy ?? input.ownerUserId,
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
        objectKey: `workspaces/workspace-alpha/assets/${input.id}/input/v1/file.bin`,
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "application/octet-stream",
        sizeBytes: 1,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: input.createdBy ?? input.ownerUserId,
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

describe("AssetDiscoveryService", () => {
  it("filters unauthorized private assets from non-admin list results", async () => {
    const authorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDiscoveryService({
      repository: new InMemoryAssetRepository([
        createTestAsset({ id: "asset-private-owner", ownerUserId: "user-owner", visibility: AssetVisibilities.private }),
        createTestAsset({ id: "asset-private-other", ownerUserId: "user-other", visibility: AssetVisibilities.private }),
        createTestAsset({ id: "asset-workspace", ownerUserId: "user-other", visibility: AssetVisibilities.workspace }),
      ]),
      workspaceAuthorizationReadRepository: authorization,
    });

    const outcome = await service.listAssets({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      scope: "all",
      limit: 10,
      offset: 0,
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.items.map((item) => item.id)).toEqual([
      "asset-private-owner",
      "asset-workspace",
    ]);
  });

  it("returns forbidden when actor lacks workspace membership", async () => {
    const authorization = new WorkspaceAuthorizationRepository();
    authorization.allow = false;
    const service = new AssetDiscoveryService({
      repository: new InMemoryAssetRepository([]),
      workspaceAuthorizationReadRepository: authorization,
    });

    const outcome = await service.listAssets({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-access-denied");
  });

  it("supports createdBy and scope filtering with pagination metadata", async () => {
    const authorization = new WorkspaceAuthorizationRepository();
    const service = new AssetDiscoveryService({
      repository: new InMemoryAssetRepository([
        createTestAsset({
          id: "asset-shared-a",
          ownerUserId: "user-other",
          createdBy: "user-owner",
          visibility: AssetVisibilities.shared,
          kind: AssetKinds.generatedOutput,
        }),
        createTestAsset({
          id: "asset-workspace-b",
          ownerUserId: "user-other",
          createdBy: "user-owner",
          visibility: AssetVisibilities.workspace,
          kind: AssetKinds.generatedOutput,
        }),
        createTestAsset({
          id: "asset-private-c",
          ownerUserId: "user-owner",
          createdBy: "user-owner",
          visibility: AssetVisibilities.private,
          kind: AssetKinds.generatedOutput,
        }),
      ]),
      workspaceAuthorizationReadRepository: authorization,
    });

    const outcome = await service.listAssets({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      scope: "workspace",
      createdByUserId: "user-owner",
      assetKinds: [AssetKinds.generatedOutput],
      limit: 1,
      offset: 0,
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.items).toHaveLength(1);
    expect(outcome.value.items[0]?.id).toBe("asset-shared-a");
    expect(outcome.value.pagination.hasMore).toBeTrue();
    expect(outcome.value.pagination.limit).toBe(1);
    expect(outcome.value.pagination.offset).toBe(0);
  });
});


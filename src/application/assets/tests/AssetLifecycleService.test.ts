import { describe, expect, it } from "bun:test";
import {
  AssetKinds,
  AssetLifecycleStates,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  transitionAssetLifecycle,
  type Asset,
} from "../../../domain/assets/AssetDomain";
import type { AssetAuditEvent, AssetAuditSink } from "../ports/AssetAuditPort";
import type { IAssetRepository } from "../ports/IAssetRepository";
import { AssetLifecycleService } from "../use-cases/AssetLifecycleService";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly records = new Map<string, Asset>()) {}

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

  public async replaceAssetLineage(
    _assetId: string,
    _lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void> {
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
          ownerUserId: "workspace-owner",
          visibility: "team",
          createdBy: "workspace-owner",
          lastModifiedBy: "workspace-owner",
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

class RecordingAuditSink implements AssetAuditSink {
  public readonly events: AssetAuditEvent[] = [];

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildAsset(state: Asset["lifecycle"]["state"] = AssetLifecycleStates.active): Asset {
  const asset = createAsset({
    id: "asset-lifecycle-001",
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
      versionId: "asset-lifecycle-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-lifecycle-001/input/v1/file.png",
        area: "input",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 128,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T11:00:00.000Z",
    }),
  });

  if (state === AssetLifecycleStates.active) {
    return asset;
  }
  const archived = transitionAssetLifecycle(asset, AssetLifecycleStates.archived, {
    actorUserId: "user-owner",
    occurredAt: "2026-04-06T12:00:00.000Z",
  });
  if (state === AssetLifecycleStates.archived) {
    return archived;
  }
  return transitionAssetLifecycle(archived, AssetLifecycleStates.deleted, {
    actorUserId: "user-owner",
    occurredAt: "2026-04-06T12:30:00.000Z",
  });
}

describe("AssetLifecycleService", () => {
  it("archives active assets and emits success audit events", async () => {
    const audit = new RecordingAuditSink();
    const repository = new InMemoryAssetRepository(new Map<string, Asset>([
      ["asset-lifecycle-001", buildAsset(AssetLifecycleStates.active)],
    ]));
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationRepository();
    const service = new AssetLifecycleService({
      repository,
      workspaceAuthorizationReadRepository,
      auditSink: audit,
      clock: {
        now: () => new Date("2026-04-06T13:00:00.000Z"),
      },
    });

    const result = await service.archiveAsset({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:archive:1",
      assetId: "asset-lifecycle-001",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.asset.lifecycle.state).toBe(AssetLifecycleStates.archived);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.type).toBe("asset-archived");
    expect(audit.events[0]?.outcome).toBe("success");
  });

  it("returns already-applied deletes and emits already-applied audit outcome", async () => {
    const audit = new RecordingAuditSink();
    const repository = new InMemoryAssetRepository(new Map<string, Asset>([
      ["asset-lifecycle-001", buildAsset(AssetLifecycleStates.deleted)],
    ]));
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationRepository();
    workspaceAuthorizationReadRepository.isAdmin = true;
    const service = new AssetLifecycleService({
      repository,
      workspaceAuthorizationReadRepository,
      auditSink: audit,
    });

    const result = await service.deleteAsset({
      actorUserId: "workspace-admin",
      workspaceId: "workspace-alpha",
      operationKey: "asset:delete:1",
      assetId: "asset-lifecycle-001",
    });

    expect(result.ok).toBeTrue();
    expect(audit.events[0]?.type).toBe("asset-deleted");
    expect(audit.events[0]?.outcome).toBe("already-applied");
  });

  it("emits rejected audit outcomes for unauthorized lifecycle mutations", async () => {
    const audit = new RecordingAuditSink();
    const repository = new InMemoryAssetRepository(new Map<string, Asset>([
      ["asset-lifecycle-001", buildAsset(AssetLifecycleStates.active)],
    ]));
    const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationRepository();
    const service = new AssetLifecycleService({
      repository,
      workspaceAuthorizationReadRepository,
      auditSink: audit,
    });

    const result = await service.deleteAsset({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      operationKey: "asset:delete:2",
      assetId: "asset-lifecycle-001",
    });

    expect(result.ok).toBeFalse();
    expect(audit.events[0]?.type).toBe("asset-deleted");
    expect(audit.events[0]?.outcome).toBe("rejected");
    expect((audit.events[0]?.details as Record<string, unknown>)?.reasonCode).toBe("asset-access-denied");
  });
});

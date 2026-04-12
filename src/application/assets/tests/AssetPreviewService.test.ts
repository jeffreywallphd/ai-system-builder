import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IAssetPreviewPort } from "../ports/AssetPreviewPort";
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
import { AssetPreviewService } from "../use-cases/AssetPreviewService";
import type { AssetAuditEvent, AssetAuditSink } from "../ports/AssetAuditPort";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly assets: ReadonlyArray<Asset>) {}

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.assets.find((asset) => asset.id === assetId);
  }

  public async listAssets(query: Parameters<IAssetRepository["listAssets"]>[0]): Promise<ReadonlyArray<Asset>> {
    let items = [...this.assets];

    if (query.workspaceId) {
      items = items.filter((asset) => asset.ownership.workspaceId === query.workspaceId);
    }
    if (query.assetKinds && query.assetKinds.length > 0) {
      items = items.filter((asset) => query.assetKinds?.includes(asset.kind));
    }
    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      items = items.filter((asset) => query.lifecycleStates?.includes(asset.lifecycle.state));
    }
    if (query.sourceAssetId) {
      items = items.filter((asset) => asset.id.startsWith(`preview-${query.sourceAssetId}`));
    }

    return Object.freeze(items);
  }

  public async createAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async saveAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async replaceAssetLineage(): Promise<void> {
    // not used
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

class StubAssetPreviewPort implements IAssetPreviewPort {
  public enabled = false;

  public previewAssetId = "preview-generated-worker";

  public async resolvePreviewForAsset(
    request: Parameters<IAssetPreviewPort["resolvePreviewForAsset"]>[0],
  ): Promise<Awaited<ReturnType<IAssetPreviewPort["resolvePreviewForAsset"]>>> {
    if (!this.enabled) {
      return undefined;
    }

    return Object.freeze({
      assetId: this.previewAssetId,
      versionId: `${this.previewAssetId}:v1`,
      mimeType: "image/webp",
      storageInstanceId: "storage-alpha",
      objectKey: `workspaces/workspace-alpha/assets/${this.previewAssetId}/preview/v1/preview.webp`,
      generatedAt: "2026-04-06T12:00:00.000Z",
    });
  }
}

class RecordingAuditSink implements AssetAuditSink {
  public readonly events: AssetAuditEvent[] = [];

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function createAssetRecord(input: {
  readonly id: string;
  readonly kind: Asset["kind"];
  readonly ownerUserId?: string;
  readonly visibility: Asset["visibility"];
  readonly mimeType: string;
}): Asset {
  return createAsset({
    id: input.id,
    kind: input.kind,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: input.ownerUserId,
      createdBy: input.ownerUserId ?? "user-owner",
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
        objectKey: `workspaces/workspace-alpha/assets/${input.id}/preview/v1/file`,
        area: "preview",
      }),
      content: createContentDescriptor({
        mimeType: input.mimeType,
        sizeBytes: 8,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
      createdBy: input.ownerUserId ?? "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

describe("AssetPreviewService", () => {
  it("resolves preview derivatives with preferred mime selection", async () => {
    const source = createAssetRecord({
      id: "asset-source-001",
      kind: AssetKinds.uploadedFile,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "application/octet-stream",
    });
    const previewPng = createAssetRecord({
      id: "preview-asset-source-001-main",
      kind: AssetKinds.preview,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/png",
    });
    const previewWebp = createAssetRecord({
      id: "preview-asset-source-001-thumb",
      kind: AssetKinds.preview,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/webp",
    });

    const service = new AssetPreviewService({
      repository: new InMemoryAssetRepository([source, previewPng, previewWebp]),
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationRepository(),
    });

    const outcome = await service.resolveAssetPreview({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-source-001",
      preferredMimeTypes: ["image/webp", "image/png"],
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.previewAssetId).toBe("preview-asset-source-001-thumb");
    expect(outcome.value.previewMimeType).toBe("image/webp");
    expect(outcome.value.previewObjectKey).toContain("preview-asset-source-001-thumb");
  });

  it("returns safe not-found for unauthorized private assets", async () => {
    const source = createAssetRecord({
      id: "asset-source-002",
      kind: AssetKinds.uploadedFile,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/png",
    });
    const service = new AssetPreviewService({
      repository: new InMemoryAssetRepository([source]),
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationRepository(),
    });

    const outcome = await service.resolveAssetPreview({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      assetId: "asset-source-002",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-not-found");
  });

  it("falls back to inline preview on source asset when derivative is unavailable", async () => {
    const source = createAssetRecord({
      id: "asset-source-003",
      kind: AssetKinds.uploadedFile,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/png",
    });

    const service = new AssetPreviewService({
      repository: new InMemoryAssetRepository([source]),
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationRepository(),
    });

    const outcome = await service.resolveAssetPreview({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-source-003",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.previewAssetId).toBe("asset-source-003");
    expect(outcome.value.previewVersionId).toBe("asset-source-003:v1");
  });

  it("uses preview port seam when derivative assets are not yet persisted", async () => {
    const source = createAssetRecord({
      id: "asset-source-004",
      kind: AssetKinds.uploadedFile,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "application/octet-stream",
    });
    const workerPreview = createAssetRecord({
      id: "worker-preview-asset-source-004",
      kind: AssetKinds.preview,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/webp",
    });

    const previewPort = new StubAssetPreviewPort();
    previewPort.enabled = true;
    previewPort.previewAssetId = "worker-preview-asset-source-004";

    const service = new AssetPreviewService({
      repository: new InMemoryAssetRepository([source, workerPreview]),
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationRepository(),
      previewPort,
    });

    const outcome = await service.resolveAssetPreview({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-source-004",
      preferredMimeTypes: ["image/webp"],
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }

    expect(outcome.value.previewAssetId).toBe("worker-preview-asset-source-004");
    expect(outcome.value.previewMimeType).toBe("image/webp");
  });

  it("emits audit events for successful preview resolution", async () => {
    const source = createAssetRecord({
      id: "asset-source-005",
      kind: AssetKinds.uploadedFile,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/png",
    });
    const preview = createAssetRecord({
      id: "preview-asset-source-005-thumb",
      kind: AssetKinds.preview,
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
      mimeType: "image/webp",
    });
    const auditSink = new RecordingAuditSink();
    const service = new AssetPreviewService({
      repository: new InMemoryAssetRepository([source, preview]),
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationRepository(),
      auditSink,
    });

    const outcome = await service.resolveAssetPreview({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-source-005",
      preferredMimeTypes: ["image/webp"],
    });

    expect(outcome.ok).toBeTrue();
    expect(auditSink.events).toHaveLength(1);
    expect(auditSink.events[0]?.type).toBe("asset-preview-resolved");
    expect(auditSink.events[0]?.outcome).toBe("success");
  });
});


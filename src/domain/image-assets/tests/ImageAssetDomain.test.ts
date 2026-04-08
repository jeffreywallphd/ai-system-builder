import { describe, expect, it } from "bun:test";
import {
  ImageAssetDomainError,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  ImageAssetStatusTransitionError,
  createImageAsset,
  transitionImageAssetStatus,
  updateImageAssetVisibility,
} from "../ImageAssetDomain";

function makeDigest(length: number): string {
  return "a".repeat(length);
}

describe("ImageAssetDomain", () => {
  it("creates private uploaded image assets scoped to workspace and user ownership", () => {
    const asset = createImageAsset({
      assetId: "image-asset:source:1",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      storageBindingReference: "storage-instance://workspace-primary-store/input",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "Reference Portrait.PNG",
      normalizedFilename: "reference-portrait.png",
      sizeBytes: 128_000,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
      lifecycleStatus: ImageAssetStatuses.available,
      createdAt: "2026-04-08T12:00:00.000Z",
    });

    expect(asset.workspaceId).toBe("workspace-alpha");
    expect(asset.ownerUserId).toBe("user-owner");
    expect(asset.storageInstanceId).toBe("workspace-primary-store");
    expect(asset.mediaType).toBe("image/png");
    expect(asset.lifecycle.status).toBe(ImageAssetStatuses.available);
    expect(asset.lifecycle.ingestedAt).toBe("2026-04-08T12:00:00.000Z");
  });

  it("creates generated workspace-owned image assets with lineage metadata", () => {
    const asset = createImageAsset({
      assetId: "image-asset:generated:1",
      workspaceId: "workspace-alpha",
      storageInstanceId: "workspace-primary-store",
      storageBindingReference: "storage-instance://workspace-primary-store/output",
      originKind: ImageAssetOriginKinds.generatedResult,
      mediaType: "image/webp",
      originalFilename: "result.webp",
      normalizedFilename: "result.webp",
      sizeBytes: 98_112,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      visibility: "workspace",
      createdBy: "user-worker",
      lifecycleStatus: ImageAssetStatuses.available,
      lineage: {
        upstreamAssetIds: ["image-asset:source:1"],
        sourceRunId: "run-123",
        generationOperationId: "op-image-gen-123",
      },
      createdAt: "2026-04-08T12:15:00.000Z",
    });

    expect(asset.ownerUserId).toBeUndefined();
    expect(asset.visibility).toBe("workspace");
    expect(asset.lineage?.upstreamAssetIds).toEqual(["image-asset:source:1"]);
  });

  it("rejects unsupported image media types", () => {
    expect(() => createImageAsset({
      assetId: "image-asset:invalid-media",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "application/pdf",
      originalFilename: "doc.pdf",
      normalizedFilename: "doc.pdf",
      sizeBytes: 1234,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
    })).toThrow(ImageAssetDomainError);
  });

  it("rejects filesystem paths and filename path separators", () => {
    expect(() => createImageAsset({
      assetId: "image-asset:path-invalid",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      storageBindingReference: "C:\\assets\\input",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "input.png",
      normalizedFilename: "input.png",
      sizeBytes: 300,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
    })).toThrow(ImageAssetDomainError);

    expect(() => createImageAsset({
      assetId: "image-asset:filename-invalid",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "input.png",
      normalizedFilename: "images/input.png",
      sizeBytes: 300,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
    })).toThrow(ImageAssetDomainError);
  });

  it("enforces ownership and sharing invariants by visibility", () => {
    expect(() => createImageAsset({
      assetId: "image-asset:no-owner-private",
      workspaceId: "workspace-alpha",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "input.png",
      normalizedFilename: "input.png",
      sizeBytes: 300,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
    })).toThrow("Private image assets require ownerUserId");

    expect(() => createImageAsset({
      assetId: "image-asset:shared-no-policy",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "input.png",
      normalizedFilename: "input.png",
      sizeBytes: 300,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
      visibility: "shared",
    })).toThrow("Shared image assets require sharingPolicy.policyId");
  });

  it("allows safe lifecycle transitions and rejects invalid transitions", () => {
    const created = createImageAsset({
      assetId: "image-asset:lifecycle",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/jpeg",
      originalFilename: "portrait.jpg",
      normalizedFilename: "portrait.jpg",
      sizeBytes: 10_240,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
      lifecycleStatus: ImageAssetStatuses.ingesting,
      createdAt: "2026-04-08T12:00:00.000Z",
    });

    const available = transitionImageAssetStatus(created, {
      nextStatus: ImageAssetStatuses.available,
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:01:00.000Z",
    });

    const archived = transitionImageAssetStatus(available, {
      nextStatus: ImageAssetStatuses.archived,
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:02:00.000Z",
    });

    const deleted = transitionImageAssetStatus(archived, {
      nextStatus: ImageAssetStatuses.deleted,
      actorUserId: "user-admin",
      occurredAt: "2026-04-08T12:03:00.000Z",
    });

    expect(available.lifecycle.status).toBe(ImageAssetStatuses.available);
    expect(archived.lifecycle.status).toBe(ImageAssetStatuses.archived);
    expect(deleted.lifecycle.status).toBe(ImageAssetStatuses.deleted);
    expect(deleted.lifecycle.deletedBy).toBe("user-admin");

    expect(() => transitionImageAssetStatus(deleted, {
      nextStatus: ImageAssetStatuses.available,
      actorUserId: "user-admin",
    })).toThrow(ImageAssetStatusTransitionError);
  });

  it("blocks visibility mutation for deleted assets", () => {
    const deleted = createImageAsset({
      assetId: "image-asset:deleted-visibility",
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      storageInstanceId: "workspace-primary-store",
      originKind: ImageAssetOriginKinds.generatedResult,
      mediaType: "image/png",
      originalFilename: "result.png",
      normalizedFilename: "result.png",
      sizeBytes: 10_240,
      fingerprint: {
        algorithm: "sha256",
        digest: makeDigest(64),
      },
      createdBy: "user-owner",
      lifecycleStatus: ImageAssetStatuses.deleted,
      createdAt: "2026-04-08T12:00:00.000Z",
    });

    expect(() => updateImageAssetVisibility(deleted, {
      visibility: "workspace",
      actorUserId: "user-owner",
    })).toThrow("Deleted image assets cannot update visibility");
  });
});

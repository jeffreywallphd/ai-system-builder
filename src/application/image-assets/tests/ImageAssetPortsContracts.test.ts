import { describe, expect, it } from "bun:test";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  createImageAsset,
  transitionImageAssetStatus,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import {
  type CreateImageAssetStorageAccessHandleRequest,
  type CreateImageAssetStorageAccessHandleResult,
  type DeleteImageAssetStorageObjectRequest,
  type DeleteImageAssetStorageObjectResult,
  ImageAssetStorageAccessPurposes,
  type ImageAssetRepositoryListQuery,
  ImageAssetStorageLifecycleDeleteReasons,
  type OpenImageAssetStorageObjectReadRequest,
  type OpenImageAssetStorageObjectReadResult,
  ImageAssetStorageObjectAreas,
  type IImageAssetStoragePort,
  type ImageAssetRepositoryMutationContext,
  type ImageAssetRepositoryMutationResult,
  type IImageAssetRepository,
  type ImageAssetStoredObjectReference,
  type ImageAssetStorageAccessHandleClaims,
  type ImageAssetStorageObjectReference,
  type ReserveImageAssetStorageLocationRequest,
  type ReserveImageAssetStorageLocationResult,
  type ResolveImageAssetStorageAccessHandleRequest,
  type WriteImageAssetStorageObjectRequest,
  type WriteImageAssetStorageObjectResult,
} from "../ports";

function createTestImageAsset(input?: {
  readonly assetId?: string;
  readonly lifecycleStatus?: typeof ImageAssetStatuses[keyof typeof ImageAssetStatuses];
}): ImageAsset {
  return createImageAsset({
    assetId: input?.assetId ?? "image-asset-1",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-alpha",
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/images",
    originKind: ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: "source.png",
    normalizedFilename: "source.png",
    sizeBytes: 256,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: "a".repeat(64),
    },
    visibility: ResourceVisibilities.private,
    sharingPolicy: {
      mode: SharingPolicyModes.ownerOnly,
    },
    createdBy: "user-alpha",
    lifecycleStatus: input?.lifecycleStatus,
  });
}

class InMemoryImageAssetRepository implements IImageAssetRepository {
  private readonly assets = new Map<string, ImageAsset>();

  private readonly originalReferences = new Map<string, ImageAssetStoredObjectReference>();

  async findImageAssetById(assetId: string, options?: { readonly includeDeleted?: boolean }): Promise<ImageAsset | undefined> {
    const asset = this.assets.get(assetId.trim());
    if (!asset) {
      return undefined;
    }
    if (!options?.includeDeleted && asset.lifecycle.status === ImageAssetStatuses.deleted) {
      return undefined;
    }
    return asset;
  }

  async listImageAssets(_query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    return [...this.assets.values()];
  }

  async createImageAsset(
    imageAsset: ImageAsset,
    _mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult> {
    this.assets.set(imageAsset.assetId, imageAsset);
    return {
      changed: true,
      wasReplay: false,
      imageAsset,
    };
  }

  async saveImageAsset(
    imageAsset: ImageAsset,
    _mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult> {
    this.assets.set(imageAsset.assetId, imageAsset);
    return {
      changed: true,
      wasReplay: false,
      imageAsset,
    };
  }

  async setImageAssetOriginalObjectReference(
    assetId: string,
    reference: ImageAssetStoredObjectReference,
  ): Promise<void> {
    this.originalReferences.set(assetId, reference);
  }

  async getImageAssetOriginalObjectReference(assetId: string): Promise<ImageAssetStoredObjectReference | undefined> {
    return this.originalReferences.get(assetId);
  }

  async archiveImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    const current = this.assets.get(assetId.trim());
    if (!current) {
      return undefined;
    }
    const archived = transitionImageAssetStatus(current, {
      nextStatus: ImageAssetStatuses.archived,
      actorUserId: mutation.actorUserId,
      occurredAt: mutation.occurredAt,
    });
    this.assets.set(archived.assetId, archived);
    return {
      changed: true,
      wasReplay: false,
      imageAsset: archived,
    };
  }

  async softDeleteImageAsset(
    assetId: string,
    mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    const current = this.assets.get(assetId.trim());
    if (!current) {
      return undefined;
    }
    const deleted = transitionImageAssetStatus(current, {
      nextStatus: ImageAssetStatuses.deleted,
      actorUserId: mutation.actorUserId,
      occurredAt: mutation.occurredAt,
    });
    this.assets.set(deleted.assetId, deleted);
    return {
      changed: true,
      wasReplay: false,
      imageAsset: deleted,
    };
  }
}

class InMemoryImageAssetStoragePort implements IImageAssetStoragePort {
  private readonly objects = new Map<string, Uint8Array>();
  private readonly handles = new Map<string, ImageAssetStorageAccessHandleClaims>();

  async reserveStorageLocation(
    _request: ReserveImageAssetStorageLocationRequest,
  ): Promise<ReserveImageAssetStorageLocationResult> {
    return {
      reservationId: "reservation-1",
      reference: {
        storageInstanceId: "storage-alpha",
        objectKey: "workspace-alpha/image-assets/image-asset-1/original/source.png",
        area: ImageAssetStorageObjectAreas.original,
      } as ImageAssetStorageObjectReference,
      expiresAt: "2026-04-08T12:00:00.000Z",
    };
  }

  async writeObject(request: WriteImageAssetStorageObjectRequest): Promise<WriteImageAssetStorageObjectResult> {
    const chunks: Uint8Array[] = [];
    if (request.content instanceof Uint8Array) {
      chunks.push(request.content);
    } else {
      for await (const chunk of request.content) {
        chunks.push(chunk);
      }
    }

    const sizeBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    this.objects.set(`${request.reference.storageInstanceId}:${request.reference.objectKey}`, bytes);
    return {
      reference: request.reference,
      sizeBytes,
      checksum: {
        algorithm: "sha256" as const,
        digest: "b".repeat(64),
      },
      writtenAt: "2026-04-08T12:01:00.000Z",
    };
  }

  async openReadStream(
    request: OpenImageAssetStorageObjectReadRequest,
  ): Promise<OpenImageAssetStorageObjectReadResult> {
    const key = `${request.reference.storageInstanceId}:${request.reference.objectKey}`;
    const content = this.objects.get(key) ?? new Uint8Array();
    return {
      reference: request.reference,
      sizeBytes: content.length,
      mediaType: "image/png",
      stream: (async function* streamBytes() {
        yield content;
      })(),
    };
  }

  async createAccessHandle(
    request: CreateImageAssetStorageAccessHandleRequest,
  ): Promise<CreateImageAssetStorageAccessHandleResult> {
    const claims: ImageAssetStorageAccessHandleClaims = {
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      actorUserId: request.actorUserId,
      purpose: request.purpose,
      reference: request.reference,
      expiresAt: "2026-04-08T12:05:00.000Z",
    };
    this.handles.set("handle-1", claims);
    return {
      handleToken: "handle-1",
      expiresAt: claims.expiresAt,
    };
  }

  async resolveAccessHandle(
    request: ResolveImageAssetStorageAccessHandleRequest,
  ): Promise<ImageAssetStorageAccessHandleClaims | undefined> {
    return this.handles.get(request.handleToken);
  }

  async deleteObject(
    request: DeleteImageAssetStorageObjectRequest,
  ): Promise<DeleteImageAssetStorageObjectResult> {
    const key = `${request.reference.storageInstanceId}:${request.reference.objectKey}`;
    const deleted = this.objects.delete(key);
    return {
      reference: request.reference,
      deleted,
      deletedAt: "2026-04-08T12:06:00.000Z",
    };
  }
}

describe("image-assets application ports contracts", () => {
  it("supports repository seams for create/list/archive/soft-delete metadata operations", async () => {
    const repository: IImageAssetRepository = new InMemoryImageAssetRepository();

    const created = await repository.createImageAsset(createTestImageAsset(), {
      operationKey: "create-1",
      actorUserId: "user-alpha",
    });
    expect(created.imageAsset.assetId).toBe("image-asset-1");

    await repository.setImageAssetOriginalObjectReference("image-asset-1", {
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset-1/original/source.png",
      objectVersionId: "v1",
    });
    const originalReference = await repository.getImageAssetOriginalObjectReference("image-asset-1");
    expect(originalReference?.objectKey).toContain("/original/");

    const listed = await repository.listImageAssets({
      workspaceId: "workspace-alpha",
      includeDeleted: false,
    });
    expect(listed).toHaveLength(1);

    const archived = await repository.archiveImageAsset("image-asset-1", {
      operationKey: "archive-1",
      actorUserId: "user-alpha",
    });
    expect(archived?.imageAsset.lifecycle.status).toBe(ImageAssetStatuses.archived);

    const deleted = await repository.softDeleteImageAsset("image-asset-1", {
      operationKey: "delete-1",
      actorUserId: "user-alpha",
    });
    expect(deleted?.imageAsset.lifecycle.status).toBe(ImageAssetStatuses.deleted);

    const hiddenDeleted = await repository.findImageAssetById("image-asset-1");
    expect(hiddenDeleted).toBeUndefined();

    const includedDeleted = await repository.findImageAssetById("image-asset-1", {
      includeDeleted: true,
    });
    expect(includedDeleted?.lifecycle.status).toBe(ImageAssetStatuses.deleted);
  });

  it("supports managed storage seams for reserve/store/read/access/delete without filesystem paths", async () => {
    const storage: IImageAssetStoragePort = new InMemoryImageAssetStoragePort();

    const reservation = await storage.reserveStorageLocation({
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
      storageInstanceId: "storage-alpha",
      area: ImageAssetStorageObjectAreas.original,
    });
    expect(reservation.reference.objectKey.startsWith("workspace-alpha/")).toBeTrue();

    const written = await storage.writeObject({
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
      reservationId: reservation.reservationId,
      reference: reservation.reference,
      content: new Uint8Array([1, 2, 3, 4]),
    });
    expect(written.sizeBytes).toBe(4);

    const grant = await storage.createAccessHandle({
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
      purpose: ImageAssetStorageAccessPurposes.downloadOriginal,
      reference: written.reference,
      expiresInSeconds: 60,
    });
    const claims = await storage.resolveAccessHandle({
      handleToken: grant.handleToken,
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
    });
    expect(claims?.purpose).toBe(ImageAssetStorageAccessPurposes.downloadOriginal);

    const streamResult = await storage.openReadStream({
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
      purpose: ImageAssetStorageAccessPurposes.inlinePreview,
      reference: written.reference,
    });

    let streamSize = 0;
    for await (const chunk of streamResult.stream) {
      streamSize += chunk.length;
    }
    expect(streamSize).toBe(4);

    const deleted = await storage.deleteObject({
      workspaceId: "workspace-alpha",
      assetId: "image-asset-1",
      actorUserId: "user-alpha",
      reason: ImageAssetStorageLifecycleDeleteReasons.assetDeleted,
      reference: written.reference,
    });
    expect(deleted.deleted).toBeTrue();
  });
});

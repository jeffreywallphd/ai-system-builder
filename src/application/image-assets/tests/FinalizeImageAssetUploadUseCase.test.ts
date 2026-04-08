import { createHash } from "node:crypto";
import { describe, expect, it } from "bun:test";
import {
  ResourceVisibilities,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  createImageAsset,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  IImageAssetRepository,
  ImageAssetRepositoryListQuery,
  ImageAssetRepositoryMutationContext,
  ImageAssetRepositoryMutationResult,
  ImageAssetStoredObjectReference,
} from "../ports/IImageAssetRepository";
import {
  ImageAssetStorageAccessPurposes,
  ImageAssetStorageLifecycleDeleteReasons,
  ImageAssetStorageObjectAreas,
  type IImageAssetStoragePort,
  type ImageAssetStorageObjectReference,
} from "../ports/ImageAssetStoragePort";
import {
  FinalizeImageAssetUploadUseCase,
  ImageAssetUploadFinalizationErrorCodes,
} from "../use-cases";

class InMemoryImageAssetRepository implements IImageAssetRepository {
  public readonly records = new Map<string, ImageAsset>();

  public readonly originalReferences = new Map<string, ImageAssetStoredObjectReference>();

  async findImageAssetById(assetId: string): Promise<ImageAsset | undefined> {
    return this.records.get(assetId.trim());
  }

  async listImageAssets(_query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    return Object.freeze([...this.records.values()]);
  }

  async createImageAsset(
    imageAsset: ImageAsset,
    _mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult> {
    if (this.records.has(imageAsset.assetId)) {
      throw new Error(`Image asset '${imageAsset.assetId}' already exists.`);
    }
    this.records.set(imageAsset.assetId, imageAsset);
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
    this.records.set(imageAsset.assetId, imageAsset);
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

  async archiveImageAsset(): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }

  async softDeleteImageAsset(): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }
}

class InMemoryImageAssetStoragePort implements IImageAssetStoragePort {
  public readonly deletedReasons: string[] = [];

  public constructor(
    private readonly contentByKey: Map<string, Uint8Array>,
  ) {}

  async reserveStorageLocation(
    _request: Parameters<IImageAssetStoragePort["reserveStorageLocation"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["reserveStorageLocation"]>>> {
    throw new Error("not used");
  }

  async writeObject(
    _request: Parameters<IImageAssetStoragePort["writeObject"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["writeObject"]>>> {
    throw new Error("not used");
  }

  async openReadStream(
    request: Parameters<IImageAssetStoragePort["openReadStream"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["openReadStream"]>>> {
    if (request.purpose !== ImageAssetStorageAccessPurposes.workerProcess) {
      throw new Error("unexpected purpose");
    }

    const content = this.contentByKey.get(request.reference.objectKey);
    if (!content) {
      throw new Error("missing content");
    }

    return {
      reference: request.reference,
      sizeBytes: content.byteLength,
      mediaType: "image/png",
      stream: (async function* asStream() {
        yield content;
      }()),
    };
  }

  async createAccessHandle(
    _request: Parameters<IImageAssetStoragePort["createAccessHandle"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["createAccessHandle"]>>> {
    throw new Error("not used");
  }

  async resolveAccessHandle(
    _request: Parameters<IImageAssetStoragePort["resolveAccessHandle"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["resolveAccessHandle"]>>> {
    throw new Error("not used");
  }

  async deleteObject(
    request: Parameters<IImageAssetStoragePort["deleteObject"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["deleteObject"]>>> {
    this.deletedReasons.push(request.reason);
    const deleted = this.contentByKey.delete(request.reference.objectKey);
    return {
      reference: request.reference,
      deleted,
      deletedAt: "2026-04-08T12:00:05.000Z",
    };
  }
}

class WorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  async getWorkspaceAuthorizationSnapshot(
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
          createdAt: "2026-04-08T10:00:00.000Z",
          lastModifiedAt: "2026-04-08T10:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

function buildImageAsset(input: {
  readonly sizeBytes: number;
  readonly digest: string;
}): ImageAsset {
  return createImageAsset({
    assetId: "image-asset:001",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-actor",
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    originKind: ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: "source.png",
    normalizedFilename: "source.png",
    sizeBytes: input.sizeBytes,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: input.digest,
    },
    visibility: ResourceVisibilities.private,
    sharingPolicy: {
      mode: SharingPolicyModes.ownerOnly,
    },
    createdBy: "user-actor",
    lastModifiedBy: "user-actor",
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
    lifecycleStatus: ImageAssetStatuses.ingesting,
  });
}

function buildFixture() {
  const content = new Uint8Array([1, 2, 3, 4]);
  const digest = createHash("sha256").update(content).digest("hex");
  const objectKey = "workspaces/workspace-alpha/image-assets/image-asset:001/original/source.png";
  const contentByKey = new Map<string, Uint8Array>([[objectKey, content]]);
  const imageAssetRepository = new InMemoryImageAssetRepository();
  const imageAssetStoragePort = new InMemoryImageAssetStoragePort(contentByKey);
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
  const useCase = new FinalizeImageAssetUploadUseCase({
    imageAssetRepository,
    imageAssetStoragePort,
    workspaceAuthorizationReadRepository,
    clock: {
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    },
  });

  const asset = buildImageAsset({
    sizeBytes: content.byteLength,
    digest,
  });
  imageAssetRepository.records.set(asset.assetId, asset);

  const reference: ImageAssetStorageObjectReference = {
    storageInstanceId: "storage-alpha",
    objectKey,
    area: ImageAssetStorageObjectAreas.original,
  };

  return {
    useCase,
    imageAssetRepository,
    imageAssetStoragePort,
    workspaceAuthorizationReadRepository,
    reference,
  };
}

describe("FinalizeImageAssetUploadUseCase", () => {
  it("finalizes a pending image asset upload only after storage content verification succeeds", async () => {
    const fixture = buildFixture();
    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      operationKey: "image-asset:finalize:001",
      storageReference: fixture.reference,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.imageAsset.lifecycle.status).toBe(ImageAssetStatuses.available);
    expect(result.value.imageAsset.lifecycle.ingestedAt).toBe("2026-04-08T12:00:00.000Z");
    expect(result.value.upload.status).toBe("finalized");
    expect(result.value.upload.observedSizeBytes).toBe(4);
    expect(result.value.imageAsset.sizeBytes).toBe(4);
    expect(fixture.imageAssetRepository.originalReferences.get("image-asset:001")?.objectKey).toBe(
      fixture.reference.objectKey,
    );
  });

  it("returns invalid-state when the asset is not pending ingestion", async () => {
    const fixture = buildFixture();
    const existing = fixture.imageAssetRepository.records.get("image-asset:001");
    if (!existing) {
      throw new Error("missing fixture asset");
    }
    fixture.imageAssetRepository.records.set("image-asset:001", {
      ...existing,
      lifecycle: {
        status: ImageAssetStatuses.available,
        ingestedAt: "2026-04-08T12:00:00.000Z",
      },
    });

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      operationKey: "image-asset:finalize:invalid-state",
      storageReference: fixture.reference,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetUploadFinalizationErrorCodes.invalidState,
      }),
    });
  });

  it("marks the asset failed and performs cleanup when verification fails", async () => {
    const fixture = buildFixture();
    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      operationKey: "image-asset:finalize:mismatch",
      storageReference: fixture.reference,
      expectedChecksumSha256: "a".repeat(64),
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetUploadFinalizationErrorCodes.conflict,
      }),
    });

    const updated = fixture.imageAssetRepository.records.get("image-asset:001");
    expect(updated?.lifecycle.status).toBe(ImageAssetStatuses.failed);
    expect(updated?.lifecycle.failureReason).toBe("checksum-mismatch");
    expect(fixture.imageAssetStoragePort.deletedReasons).toEqual([
      ImageAssetStorageLifecycleDeleteReasons.ingestFailure,
    ]);
  });
});

import { describe, expect, it } from "bun:test";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  createImageAsset,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import {
  ResourceVisibilities,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
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
  ImageAssetStorageObjectAreas,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  GetImageAssetOriginalContentUseCase,
  ImageAssetOriginalContentReadErrorCodes,
} from "../use-cases";

class InMemoryImageAssetRepository implements IImageAssetRepository {
  public readonly assets = new Map<string, ImageAsset>();

  public readonly originalReferences = new Map<string, ImageAssetStoredObjectReference>();

  async findImageAssetById(assetId: string): Promise<ImageAsset | undefined> {
    return this.assets.get(assetId.trim());
  }

  async listImageAssets(_query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    return Object.freeze([...this.assets.values()]);
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

  async setImageAssetOriginalObjectReference(assetId: string, reference: ImageAssetStoredObjectReference): Promise<void> {
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

class WorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public constructor(
    private readonly options?: {
      readonly isActive?: boolean;
      readonly isAdmin?: boolean;
    },
  ) {}

  async getWorkspaceAuthorizationSnapshot(): Promise<Awaited<ReturnType<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>>> {
    if (this.options?.isActive === false) {
      return undefined;
    }

    return Object.freeze({
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      isWorkspaceOwner: this.options?.isAdmin ?? false,
      membership: Object.freeze({
        workspaceId: "workspace-alpha",
        userIdentityId: "user-owner",
        role: this.options?.isAdmin ? WorkspaceRoles.admin : WorkspaceRoles.member,
        status: WorkspaceMembershipStatuses.active,
        invitedByUserIdentityId: "user-owner",
        invitedAt: "2026-04-08T10:00:00.000Z",
        acceptedAt: "2026-04-08T10:00:00.000Z",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
      }),
      effectiveRoles: Object.freeze(this.options?.isAdmin ? [WorkspaceRoles.admin] : [WorkspaceRoles.member]),
      activePermissionGrantIds: Object.freeze([]),
      activeSharingGrantIds: Object.freeze([]),
      resolvedAt: "2026-04-08T10:00:00.000Z",
    });
  }
}

class InMemoryImageAssetStoragePort implements IImageAssetStoragePort {
  public openReadCallCount = 0;

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
    this.openReadCallCount += 1;
    expect(request.purpose).toBe(ImageAssetStorageAccessPurposes.downloadOriginal);
    expect(request.reference.area).toBe(ImageAssetStorageObjectAreas.original);
    return {
      reference: request.reference,
      sizeBytes: 5,
      mediaType: "image/png",
      stream: (async function* stream() {
        yield Buffer.from("hello", "utf8");
      })(),
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
    _request: Parameters<IImageAssetStoragePort["deleteObject"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["deleteObject"]>>> {
    throw new Error("not used");
  }
}

function createAvailableAsset(): ImageAsset {
  return createImageAsset({
    assetId: "image-asset:001",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-owner",
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    originKind: ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: "image.png",
    normalizedFilename: "image.png",
    sizeBytes: 5,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: "a".repeat(64),
    },
    visibility: ResourceVisibilities.private,
    sharingPolicy: {
      mode: SharingPolicyModes.ownerOnly,
    },
    createdBy: "user-owner",
    lifecycleStatus: ImageAssetStatuses.available,
    createdAt: "2026-04-08T10:00:00.000Z",
  });
}

describe("GetImageAssetOriginalContentUseCase", () => {
  it("retrieves original image content through the storage abstraction for authorized callers", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());
    repository.originalReferences.set("image-asset:001", Object.freeze({
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
      objectVersionId: "v1",
    }));

    const useCase = new GetImageAssetOriginalContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.mediaType).toBe("image/png");
    expect(outcome.value.contentDisposition).toBe("attachment");

    const chunks: number[] = [];
    for await (const chunk of outcome.value.stream) {
      chunks.push(...chunk);
    }
    expect(Buffer.from(chunks).toString("utf8")).toBe("hello");
  });

  it("blocks retrieval before storage access for callers without active workspace membership", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());
    repository.originalReferences.set("image-asset:001", Object.freeze({
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
    }));

    const useCase = new GetImageAssetOriginalContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository({
        isActive: false,
      }),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(ImageAssetOriginalContentReadErrorCodes.accessDenied);
    expect(storagePort.openReadCallCount).toBe(0);
  });

  it("returns content-unavailable when no persisted original-object reference is present", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());

    const useCase = new GetImageAssetOriginalContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(ImageAssetOriginalContentReadErrorCodes.contentUnavailable);
  });
});

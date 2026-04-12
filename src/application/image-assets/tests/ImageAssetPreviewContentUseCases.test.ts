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
  ImageAssetStorageError,
  ImageAssetStorageErrorCodes,
  ImageAssetStorageObjectAreas,
  type IImageAssetStoragePort,
} from "../ports/ImageAssetStoragePort";
import {
  OpenImageAssetPreviewContentUseCase,
  RequestImageAssetPreviewContentUseCase,
} from "../use-cases";
import {
  type ImageAssetAuditEvent,
  type ImageAssetAuditSink,
} from "../ports/ImageAssetAuditPort";

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

  public allowResolvedPreviewHandle = true;
  public throwCreateHandleNotFound = false;

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
    expect(request.purpose).toBe(ImageAssetStorageAccessPurposes.inlinePreview);
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
    if (this.throwCreateHandleNotFound) {
      throw new ImageAssetStorageError(
        ImageAssetStorageErrorCodes.notFound,
        "preview source not found",
        {
          retryable: true,
        },
      );
    }
    return Object.freeze({
      handleToken: "preview-token",
      expiresAt: "2026-04-08T10:05:00.000Z",
    });
  }

  async resolveAccessHandle(
    request: Parameters<IImageAssetStoragePort["resolveAccessHandle"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["resolveAccessHandle"]>>> {
    if (!this.allowResolvedPreviewHandle) {
      return undefined;
    }
    return Object.freeze({
      workspaceId: request.workspaceId,
      assetId: request.assetId,
      actorUserId: request.actorUserId,
      purpose: ImageAssetStorageAccessPurposes.inlinePreview,
      reference: Object.freeze({
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
        area: ImageAssetStorageObjectAreas.original,
      }),
      expiresAt: "2026-04-08T10:05:00.000Z",
    });
  }

  async deleteObject(
    _request: Parameters<IImageAssetStoragePort["deleteObject"]>[0],
  ): Promise<Awaited<ReturnType<IImageAssetStoragePort["deleteObject"]>>> {
    throw new Error("not used");
  }
}

class RecordingImageAssetAuditSink implements ImageAssetAuditSink {
  public readonly events: ImageAssetAuditEvent[] = [];

  public async recordImageAssetEvent(event: ImageAssetAuditEvent): Promise<void> {
    this.events.push(event);
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

describe("Image asset preview use cases", () => {
  it("issues preview access contracts using original-content fallback", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    const auditSink = new RecordingImageAssetAuditSink();
    repository.assets.set("image-asset:001", createAvailableAsset());
    repository.originalReferences.set("image-asset:001", Object.freeze({
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
    }));

    const useCase = new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
      auditSink,
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      representation: "gallery",
      preferredMediaTypes: ["image/png"],
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.status).toBe("available");
    expect(outcome.value.resolvedFrom).toBe("original-fallback");
    expect(outcome.value.access?.previewToken).toBe("preview-token");
    expect(auditSink.events.at(-1)?.type).toBe("image-asset-preview-access-requested");
    expect(auditSink.events.at(-1)?.outcome).toBe("success");
  });

  it("returns pending-generation when preferred preview format is unavailable", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());
    repository.originalReferences.set("image-asset:001", Object.freeze({
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
    }));

    const useCase = new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      representation: "thumbnail",
      preferredMediaTypes: ["image/webp"],
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.status).toBe("pending-generation");
    expect(outcome.value.access).toBeUndefined();
  });

  it("opens preview content streams through preview access handles", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    const auditSink = new RecordingImageAssetAuditSink();
    repository.assets.set("image-asset:001", createAvailableAsset());

    const useCase = new OpenImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
      auditSink,
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      previewToken: "preview-token",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.contentDisposition).toBe("inline");

    const chunks: number[] = [];
    for await (const chunk of outcome.value.stream) {
      chunks.push(...chunk);
    }
    expect(Buffer.from(chunks).toString("utf8")).toBe("hello");
    expect(auditSink.events.at(-1)?.type).toBe("image-asset-preview-content-opened");
    expect(auditSink.events.at(-1)?.outcome).toBe("success");
  });

  it("blocks preview stream open before storage access for inactive workspace membership", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());

    const useCase = new OpenImageAssetPreviewContentUseCase({
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
      previewToken: "preview-token",
    });

    expect(outcome.ok).toBeFalse();
    expect(storagePort.openReadCallCount).toBe(0);
  });

  it("rejects unsupported preferred preview media-types at the request boundary", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    repository.assets.set("image-asset:001", createAvailableAsset());

    const useCase = new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      preferredMediaTypes: ["text/plain" as "image/png"],
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("image-asset-preview-invalid-request");
  });

  it("treats stale preview tokens as invalid-state with explicit stale-request details", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    storagePort.allowResolvedPreviewHandle = false;
    repository.assets.set("image-asset:001", createAvailableAsset());

    const useCase = new OpenImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      previewToken: "stale-token",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("image-asset-preview-invalid-state");
    expect(outcome.error.details).toEqual(expect.objectContaining({
      staleRequest: true,
      imageManipulationFailure: expect.any(Object),
    }));
  });

  it("reports preview-generation failure as temporarily unavailable with retry guidance", async () => {
    const repository = new InMemoryImageAssetRepository();
    const storagePort = new InMemoryImageAssetStoragePort();
    storagePort.throwCreateHandleNotFound = true;
    repository.assets.set("image-asset:001", createAvailableAsset());
    repository.originalReferences.set("image-asset:001", Object.freeze({
      storageInstanceId: "storage-alpha",
      objectKey: "workspaces/workspace-alpha/image-assets/image-asset:001/original/image.png",
    }));

    const useCase = new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository: repository,
      imageAssetStoragePort: storagePort,
      workspaceAuthorizationReadRepository: new WorkspaceAuthorizationReadRepository(),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      representation: "gallery",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("image-asset-preview-unavailable");
    expect((outcome.error.details as { imageManipulationFailure?: { code?: string; resilience?: { state?: string } } } | undefined)
      ?.imageManipulationFailure?.code).toBe("preview-temporarily-unavailable");
    expect((outcome.error.details as { imageManipulationFailure?: { resilience?: { state?: string } } } | undefined)
      ?.imageManipulationFailure?.resilience?.state).toBe("temporarily-unavailable");
  });
});

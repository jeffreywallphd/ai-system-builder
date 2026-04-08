import { describe, expect, it } from "bun:test";
import {
  ResourceVisibilities,
  SharingPolicyModes,
} from "@domain/authorization/AuthorizationDomain";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import type {
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import type { IStoragePolicyEvaluationPort } from "@application/storage/ports/StoragePolicyEvaluationPort";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  IImageAssetRepository,
  ImageAssetRepositoryListQuery,
  ImageAssetRepositoryMutationContext,
  ImageAssetRepositoryMutationResult,
  ImageAssetStoredObjectReference,
} from "../ports/IImageAssetRepository";
import {
  ImageAssetStorageObjectAreas,
  type IImageAssetStoragePort,
  type ReserveImageAssetStorageLocationResult,
} from "../ports/ImageAssetStoragePort";
import {
  ImageAssetCreationErrorCodes,
  InitiateImageAssetCreationUseCase,
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

  async archiveImageAsset(
    _assetId: string,
    _mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }

  async softDeleteImageAsset(
    _assetId: string,
    _mutation: ImageAssetRepositoryMutationContext,
  ): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }
}

class InMemoryImageAssetStoragePort implements IImageAssetStoragePort {
  public reservations: Array<ReserveImageAssetStorageLocationResult> = [];

  async reserveStorageLocation(
    request: Parameters<IImageAssetStoragePort["reserveStorageLocation"]>[0],
  ): Promise<ReserveImageAssetStorageLocationResult> {
    const result: ReserveImageAssetStorageLocationResult = {
      reservationId: `reservation:${request.assetId}`,
      reference: {
        storageInstanceId: request.storageInstanceId,
        objectKey: `workspaces/${request.workspaceId}/image-assets/${request.assetId}/original/${request.normalizedFileName ?? "upload.bin"}`,
        area: request.area,
      },
      expiresAt: "2026-04-08T12:15:00.000Z",
    };
    this.reservations.push(result);
    return result;
  }

  async writeObject(
    _request: Parameters<IImageAssetStoragePort["writeObject"]>[0],
  ): Promise<any> {
    throw new Error("not used");
  }

  async openReadStream(
    _request: Parameters<IImageAssetStoragePort["openReadStream"]>[0],
  ): Promise<any> {
    throw new Error("not used");
  }

  async createAccessHandle(
    _request: Parameters<IImageAssetStoragePort["createAccessHandle"]>[0],
  ): Promise<any> {
    throw new Error("not used");
  }

  async resolveAccessHandle(
    _request: Parameters<IImageAssetStoragePort["resolveAccessHandle"]>[0],
  ): Promise<any> {
    throw new Error("not used");
  }

  async deleteObject(
    _request: Parameters<IImageAssetStoragePort["deleteObject"]>[0],
  ): Promise<any> {
    throw new Error("not used");
  }
}

class WorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  public admin = false;

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
      effectiveRoles: this.admin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

class StorageInstanceRepository implements IStorageInstanceRepository {
  public records = new Map<string, StorageInstance>();

  async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.records.get(storageInstanceId.trim());
  }

  async listStorageInstances(_query: Parameters<IStorageInstanceRepository["listStorageInstances"]>[0]): Promise<ReadonlyArray<StorageInstance>> {
    return Object.freeze([...this.records.values()]);
  }

  async createStorageInstance(
    _storageInstance: Parameters<IStorageInstanceRepository["createStorageInstance"]>[0],
    _mutation: Parameters<IStorageInstanceRepository["createStorageInstance"]>[1],
  ): Promise<any> {
    throw new Error("not used");
  }

  async saveStorageInstance(
    _storageInstance: Parameters<IStorageInstanceRepository["saveStorageInstance"]>[0],
    _mutation: Parameters<IStorageInstanceRepository["saveStorageInstance"]>[1],
  ): Promise<any> {
    throw new Error("not used");
  }
}

class StoragePolicyEvaluationPort implements IStoragePolicyEvaluationPort {
  public deniedStorageIds = new Set<string>();

  async evaluateStorageAction(
    input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0],
  ): Promise<Awaited<ReturnType<IStoragePolicyEvaluationPort["evaluateStorageAction"]>>> {
    if (input.storageInstance && this.deniedStorageIds.has(input.storageInstance.id)) {
      return {
        allowed: false,
        reasonCode: "storage-denied",
        message: "Denied by storage policy.",
        occurredAt: input.occurredAt ?? "2026-04-08T12:00:00.000Z",
      };
    }

    return {
      allowed: true,
      reasonCode: "allowed",
      occurredAt: input.occurredAt ?? "2026-04-08T12:00:00.000Z",
    };
  }

  async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

class AuthorizationPolicyDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public allow = true;

  async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    return {
      decision: {
        isAllowed: this.allow,
        outcome: this.allow ? "allow" : "deny",
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: this.allow ? "allowed" : "image-asset-create-denied",
        reason: this.allow ? "allowed" : "Denied by authorization policy.",
        evaluatedAt: request.asOf ?? "2026-04-08T12:00:00.000Z",
        matchedRoleAssignmentIds: [],
        matchedPermissionGrantIds: [],
        matchedSharingGrantIds: [],
      },
    };
  }
}

function createStorage(input: {
  readonly id: string;
  readonly workspaceId?: string;
  readonly mode?: typeof StorageAccessModes[keyof typeof StorageAccessModes];
  readonly maxObjectBytes?: number;
}): StorageInstance {
  return createStorageInstance({
    id: input.id,
    displayName: input.id,
    backendType: StorageBackendTypes.managedFilesystem,
    lifecycleState: StorageLifecycleStates.active,
    ownership: {
      workspaceId: input.workspaceId ?? "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: input.mode ?? StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: `policy-${input.id}`,
      maxObjectBytes: input.maxObjectBytes ?? 1024 * 1024,
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-08T10:00:00.000Z",
    lastCorrelationId: `corr-${input.id}`,
  });
}

function buildFixture() {
  const imageAssetRepository = new InMemoryImageAssetRepository();
  const imageAssetStoragePort = new InMemoryImageAssetStoragePort();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
  const storageInstanceRepository = new StorageInstanceRepository();
  const storagePolicyEvaluationPort = new StoragePolicyEvaluationPort();
  const authorizationPolicyDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator();

  const useCase = new InitiateImageAssetCreationUseCase({
    imageAssetRepository,
    imageAssetStoragePort,
    workspaceAuthorizationReadRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort,
    authorizationPolicyDecisionEvaluator,
    idGenerator: {
      nextAssetId: () => "image-asset:auto-1",
    },
    clock: {
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    },
  });

  return {
    useCase,
    imageAssetRepository,
    imageAssetStoragePort,
    workspaceAuthorizationReadRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort,
    authorizationPolicyDecisionEvaluator,
  };
}

describe("InitiateImageAssetCreationUseCase", () => {
  it("creates an upload-pending image asset with workspace/user ownership and reservation", async () => {
    const fixture = buildFixture();
    fixture.storageInstanceRepository.records.set("storage-alpha", createStorage({ id: "storage-alpha" }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:1",
      assetId: "image-asset:001",
      storageInstanceId: "storage-alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
      originKind: ImageAssetOriginKinds.uploadedSource,
      mediaType: "image/png",
      originalFilename: "Photo.PNG",
      sizeBytes: 512,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "a".repeat(64),
      },
      uploadArea: ImageAssetStorageObjectAreas.original,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.imageAsset.workspaceId).toBe("workspace-alpha");
    expect(result.value.imageAsset.ownerUserId).toBe("user-actor");
    expect(result.value.imageAsset.storageInstanceId).toBe("storage-alpha");
    expect(result.value.imageAsset.lifecycle.status).toBe("ingesting");
    expect(result.value.upload.status).toBe("upload-pending");
    expect(result.value.upload.reservation.reference.area).toBe("original");
    expect(fixture.imageAssetRepository.records.get("image-asset:001")?.assetId).toBe("image-asset:001");
  });

  it("auto-selects an eligible storage instance when storageInstanceId is omitted", async () => {
    const fixture = buildFixture();
    fixture.storageInstanceRepository.records.set("storage-a", createStorage({ id: "storage-a" }));
    fixture.storageInstanceRepository.records.set("storage-b", createStorage({ id: "storage-b" }));
    fixture.storagePolicyEvaluationPort.deniedStorageIds.add("storage-a");

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:auto-storage",
      mediaType: "image/png",
      originalFilename: "auto.png",
      sizeBytes: 1024,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "b".repeat(64),
      },
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.imageAsset.storageInstanceId).toBe("storage-b");
    expect(result.value.upload.reservation.reference.storageInstanceId).toBe("storage-b");
  });

  it("supports workspace-owned assets when visibility is workspace and owner is omitted", async () => {
    const fixture = buildFixture();
    fixture.storageInstanceRepository.records.set("storage-alpha", createStorage({ id: "storage-alpha" }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:workspace-owned",
      storageInstanceId: "storage-alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicy: {
        mode: SharingPolicyModes.workspaceMembers,
      },
      mediaType: "image/png",
      originalFilename: "workspace-owned.png",
      sizeBytes: 256,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "f".repeat(64),
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.imageAsset.ownerUserId).toBeUndefined();
    expect(result.value.imageAsset.visibility).toBe(ResourceVisibilities.workspace);
  });

  it("rejects requests when actor is not an active workspace member", async () => {
    const fixture = buildFixture();
    fixture.workspaceAuthorizationReadRepository.allow = false;
    fixture.storageInstanceRepository.records.set("storage-alpha", createStorage({ id: "storage-alpha" }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:denied",
      storageInstanceId: "storage-alpha",
      mediaType: "image/png",
      originalFilename: "x.png",
      sizeBytes: 64,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "c".repeat(64),
      },
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetCreationErrorCodes.accessDenied,
      }),
    });
  });

  it("rejects owner delegation for non-admin actors", async () => {
    const fixture = buildFixture();
    fixture.storageInstanceRepository.records.set("storage-alpha", createStorage({ id: "storage-alpha" }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:owner-delegation",
      ownerUserId: "user-other",
      storageInstanceId: "storage-alpha",
      mediaType: "image/png",
      originalFilename: "x.png",
      sizeBytes: 64,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "d".repeat(64),
      },
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetCreationErrorCodes.accessDenied,
      }),
    });
  });

  it("rejects when authorization policy denies image asset creation", async () => {
    const fixture = buildFixture();
    fixture.authorizationPolicyDecisionEvaluator.allow = false;
    fixture.storageInstanceRepository.records.set("storage-alpha", createStorage({ id: "storage-alpha" }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:policy-denied",
      storageInstanceId: "storage-alpha",
      mediaType: "image/png",
      originalFilename: "x.png",
      sizeBytes: 64,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "e".repeat(64),
      },
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetCreationErrorCodes.accessDenied,
      }),
    });
  });

  it("rejects invalid request payloads at the boundary", async () => {
    const fixture = buildFixture();

    const result = await fixture.useCase.execute({
      actorUserId: "user-actor",
      workspaceId: "workspace-alpha",
      operationKey: "image-asset:create:invalid",
      mediaType: "",
      originalFilename: "x.png",
      sizeBytes: 0,
      fingerprint: {
        algorithm: ImageAssetFingerprintAlgorithms.sha256,
        digest: "",
      },
      visibility: ResourceVisibilities.private,
      sharingPolicy: {
        mode: SharingPolicyModes.ownerOnly,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetCreationErrorCodes.invalidRequest,
      }),
    });
  });
});

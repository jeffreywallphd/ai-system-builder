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
  transitionImageAssetStatus,
  type ImageAsset,
} from "@domain/image-assets/ImageAssetDomain";
import type {
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  IImageAssetRepository,
  ImageAssetRepositoryListQuery,
  ImageAssetRepositoryMutationContext,
  ImageAssetRepositoryMutationResult,
} from "../ports/IImageAssetRepository";
import {
  GetImageAssetMetadataUseCase,
  ImageAssetMetadataReadErrorCodes,
} from "../use-cases";

class InMemoryImageAssetRepository implements IImageAssetRepository {
  public readonly records = new Map<string, ImageAsset>();

  async findImageAssetById(
    assetId: string,
    options?: { readonly includeDeleted?: boolean },
  ): Promise<ImageAsset | undefined> {
    const found = this.records.get(assetId.trim());
    if (!found) {
      return undefined;
    }
    if (!options?.includeDeleted && found.lifecycle.status === ImageAssetStatuses.deleted) {
      return undefined;
    }
    return found;
  }

  async listImageAssets(_query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    return Object.freeze([...this.records.values()]);
  }

  async createImageAsset(
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

  async archiveImageAsset(): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }

  async softDeleteImageAsset(): Promise<ImageAssetRepositoryMutationResult | undefined> {
    throw new Error("not used");
  }
}

class WorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  public isAdmin = false;

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
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
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
        reasonCode: this.allow ? "allowed" : "image-asset-view-denied",
        reason: this.allow ? "allowed" : "Denied by policy.",
        evaluatedAt: request.asOf ?? "2026-04-08T12:00:00.000Z",
        matchedRoleAssignmentIds: [],
        matchedPermissionGrantIds: [],
        matchedSharingGrantIds: [],
      },
    };
  }
}

function createFixtureAsset(input?: {
  readonly assetId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: "private" | "workspace" | "shared" | "published";
  readonly status?: "ingesting" | "available" | "failed" | "archived" | "deleted";
}): ImageAsset {
  let asset = createImageAsset({
    assetId: input?.assetId ?? "image-asset:001",
    workspaceId: "workspace-alpha",
    ownerUserId: input?.ownerUserId ?? "user-owner",
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    originKind: ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: "source.png",
    normalizedFilename: "source.png",
    sizeBytes: 1024,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: "a".repeat(64),
    },
    visibility: input?.visibility ?? ResourceVisibilities.private,
    sharingPolicy: input?.visibility === ResourceVisibilities.private
      ? { mode: SharingPolicyModes.ownerOnly }
      : input?.visibility === ResourceVisibilities.workspace
        ? { mode: SharingPolicyModes.workspaceMembers }
        : input?.visibility === ResourceVisibilities.shared
          ? { mode: SharingPolicyModes.explicit, policyId: "policy-shared" }
          : { mode: SharingPolicyModes.published, policyId: "policy-published" },
    createdBy: "user-owner",
    lastModifiedBy: "user-owner",
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
    lifecycleStatus: ImageAssetStatuses.available,
  });

  if (input?.status && input.status !== ImageAssetStatuses.available) {
    asset = transitionImageAssetStatus(asset, {
      nextStatus: input.status,
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:05:00.000Z",
      failureReason: input.status === ImageAssetStatuses.failed ? "failure" : undefined,
    });
  }

  return asset;
}

function buildFixture() {
  const imageAssetRepository = new InMemoryImageAssetRepository();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
  const authorizationPolicyDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator();

  const useCase = new GetImageAssetMetadataUseCase({
    imageAssetRepository,
    workspaceAuthorizationReadRepository,
    authorizationPolicyDecisionEvaluator,
    clock: {
      now: () => new Date("2026-04-08T12:00:00.000Z"),
    },
  });

  return {
    useCase,
    imageAssetRepository,
    workspaceAuthorizationReadRepository,
    authorizationPolicyDecisionEvaluator,
  };
}

describe("GetImageAssetMetadataUseCase", () => {
  it("returns metadata detail for authorized actors", async () => {
    const fixture = buildFixture();
    fixture.imageAssetRepository.records.set("image-asset:001", createFixtureAsset());

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.asset.assetId).toBe("image-asset:001");
    expect(result.value.asset.availability.isReadyForUse).toBeTrue();
    expect(result.value.asset.storage.storageInstanceId).toBe("storage-alpha");
  });

  it("returns safe not-found when policy denies metadata view", async () => {
    const fixture = buildFixture();
    fixture.authorizationPolicyDecisionEvaluator.allow = false;
    fixture.imageAssetRepository.records.set("image-asset:001", createFixtureAsset());

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetMetadataReadErrorCodes.notFound,
      }),
    });
  });

  it("returns not-found for deleted assets unless includeDeleted=true", async () => {
    const fixture = buildFixture();
    fixture.imageAssetRepository.records.set("image-asset:deleted", createFixtureAsset({
      assetId: "image-asset:deleted",
      status: ImageAssetStatuses.deleted,
    }));

    const hidden = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:deleted",
    });

    expect(hidden).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetMetadataReadErrorCodes.notFound,
      }),
    });

    const visible = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:deleted",
      includeDeleted: true,
    });

    expect(visible.ok).toBeTrue();
    if (!visible.ok) {
      return;
    }
    expect(visible.value.asset.availability.isDeleted).toBeTrue();
  });

  it("returns access-denied when actor is not an active workspace member", async () => {
    const fixture = buildFixture();
    fixture.workspaceAuthorizationReadRepository.allow = false;
    fixture.imageAssetRepository.records.set("image-asset:001", createFixtureAsset());

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetMetadataReadErrorCodes.accessDenied,
      }),
    });
  });
});

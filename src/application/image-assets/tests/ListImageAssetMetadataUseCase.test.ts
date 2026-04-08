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
  ImageAssetMetadataReadErrorCodes,
  ListImageAssetMetadataUseCase,
} from "../use-cases";

class InMemoryImageAssetRepository implements IImageAssetRepository {
  public readonly records = new Map<string, ImageAsset>();

  public lastListQuery?: ImageAssetRepositoryListQuery;

  async findImageAssetById(assetId: string): Promise<ImageAsset | undefined> {
    return this.records.get(assetId.trim());
  }

  async listImageAssets(query: ImageAssetRepositoryListQuery): Promise<ReadonlyArray<ImageAsset>> {
    this.lastListQuery = query;

    let records = [...this.records.values()]
      .filter((asset) => asset.workspaceId === query.workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    if (!query.includeDeleted) {
      records = records.filter((asset) => asset.lifecycle.status !== ImageAssetStatuses.deleted);
    }
    if (query.ownerUserIds && query.ownerUserIds.length > 0) {
      records = records.filter((asset) => asset.ownerUserId && query.ownerUserIds?.includes(asset.ownerUserId));
    }
    if (query.lifecycleStatuses && query.lifecycleStatuses.length > 0) {
      records = records.filter((asset) => query.lifecycleStatuses?.includes(asset.lifecycle.status));
    }
    if (query.originKinds && query.originKinds.length > 0) {
      records = records.filter((asset) => query.originKinds?.includes(asset.originKind));
    }
    if (query.createdAfter) {
      records = records.filter((asset) => asset.createdAt >= query.createdAfter!);
    }
    if (query.updatedAfter) {
      records = records.filter((asset) => asset.updatedAt >= query.updatedAfter!);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? records.length;
    return Object.freeze(records.slice(offset, offset + limit));
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
  public deniedAssetIds = new Set<string>();

  async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    const resourceId = request.target.kind === "resource-instance"
      ? request.target.resource.resourceId
      : undefined;
    const denied = resourceId ? this.deniedAssetIds.has(resourceId) : false;
    return {
      decision: {
        isAllowed: !denied,
        outcome: denied ? "deny" : "allow",
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: denied ? "image-asset-view-denied" : "allowed",
        reason: denied ? "Denied by policy." : "allowed",
        evaluatedAt: request.asOf ?? "2026-04-08T12:00:00.000Z",
        matchedRoleAssignmentIds: [],
        matchedPermissionGrantIds: [],
        matchedSharingGrantIds: [],
      },
    };
  }
}

function createFixtureAsset(input: {
  readonly assetId: string;
  readonly createdAt: string;
  readonly ownerUserId?: string;
  readonly visibility: "private" | "workspace" | "shared" | "published";
  readonly status: "ingesting" | "available" | "failed" | "archived" | "deleted";
}): ImageAsset {
  let asset = createImageAsset({
    assetId: input.assetId,
    workspaceId: "workspace-alpha",
    ownerUserId: input.ownerUserId,
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    originKind: ImageAssetOriginKinds.uploadedSource,
    mediaType: "image/png",
    originalFilename: `${input.assetId}.png`,
    normalizedFilename: `${input.assetId}.png`,
    sizeBytes: 1024,
    fingerprint: {
      algorithm: ImageAssetFingerprintAlgorithms.sha256,
      digest: "a".repeat(64),
    },
    visibility: input.visibility,
    sharingPolicy: input.visibility === ResourceVisibilities.private
      ? { mode: SharingPolicyModes.ownerOnly }
      : input.visibility === ResourceVisibilities.workspace
        ? { mode: SharingPolicyModes.workspaceMembers }
        : input.visibility === ResourceVisibilities.shared
          ? { mode: SharingPolicyModes.explicit, policyId: "policy-shared" }
          : { mode: SharingPolicyModes.published, policyId: "policy-published" },
    createdBy: input.ownerUserId ?? "user-owner",
    lastModifiedBy: input.ownerUserId ?? "user-owner",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    lifecycleStatus: ImageAssetStatuses.available,
  });

  if (input.status !== ImageAssetStatuses.available) {
    asset = transitionImageAssetStatus(asset, {
      nextStatus: input.status,
      actorUserId: input.ownerUserId ?? "user-owner",
      occurredAt: "2026-04-08T12:10:00.000Z",
      failureReason: input.status === ImageAssetStatuses.failed ? "failure" : undefined,
    });
  }

  return asset;
}

function buildFixture() {
  const imageAssetRepository = new InMemoryImageAssetRepository();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationReadRepository();
  const authorizationPolicyDecisionEvaluator = new AuthorizationPolicyDecisionEvaluator();

  const useCase = new ListImageAssetMetadataUseCase({
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

describe("ListImageAssetMetadataUseCase", () => {
  it("lists only authorized image assets with pagination", async () => {
    const fixture = buildFixture();
    fixture.imageAssetRepository.records.set("image-asset:1", createFixtureAsset({
      assetId: "image-asset:1",
      createdAt: "2026-04-08T12:00:00.000Z",
      ownerUserId: "user-owner",
      visibility: ResourceVisibilities.private,
      status: ImageAssetStatuses.available,
    }));
    fixture.imageAssetRepository.records.set("image-asset:2", createFixtureAsset({
      assetId: "image-asset:2",
      createdAt: "2026-04-08T11:59:00.000Z",
      ownerUserId: "user-other",
      visibility: ResourceVisibilities.private,
      status: ImageAssetStatuses.available,
    }));
    fixture.imageAssetRepository.records.set("image-asset:3", createFixtureAsset({
      assetId: "image-asset:3",
      createdAt: "2026-04-08T11:58:00.000Z",
      ownerUserId: undefined,
      visibility: ResourceVisibilities.workspace,
      status: ImageAssetStatuses.available,
    }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      limit: 1,
      offset: 0,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]?.assetId).toBe("image-asset:1");
    expect(result.value.pagination.hasMore).toBeTrue();
  });

  it("applies lifecycle and activity filters through repository query scaffolding", async () => {
    const fixture = buildFixture();
    fixture.imageAssetRepository.records.set("image-asset:available", createFixtureAsset({
      assetId: "image-asset:available",
      createdAt: "2026-04-08T12:00:00.000Z",
      ownerUserId: "user-owner",
      visibility: ResourceVisibilities.private,
      status: ImageAssetStatuses.available,
    }));
    fixture.imageAssetRepository.records.set("image-asset:archived", createFixtureAsset({
      assetId: "image-asset:archived",
      createdAt: "2026-04-07T12:00:00.000Z",
      ownerUserId: "user-owner",
      visibility: ResourceVisibilities.private,
      status: ImageAssetStatuses.archived,
    }));

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      lifecycleStatuses: [ImageAssetStatuses.available],
      updatedAfter: "2026-04-08T00:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.items.map((item) => item.assetId)).toEqual(["image-asset:available"]);
    expect(fixture.imageAssetRepository.lastListQuery).toEqual(
      expect.objectContaining({
        lifecycleStatuses: [ImageAssetStatuses.available],
        updatedAfter: "2026-04-08T00:00:00.000Z",
      }),
    );
  });

  it("excludes assets denied by policy evaluator from list results", async () => {
    const fixture = buildFixture();
    fixture.imageAssetRepository.records.set("image-asset:a", createFixtureAsset({
      assetId: "image-asset:a",
      createdAt: "2026-04-08T12:00:00.000Z",
      ownerUserId: "user-owner",
      visibility: ResourceVisibilities.workspace,
      status: ImageAssetStatuses.available,
    }));
    fixture.imageAssetRepository.records.set("image-asset:b", createFixtureAsset({
      assetId: "image-asset:b",
      createdAt: "2026-04-08T11:59:00.000Z",
      ownerUserId: "user-owner",
      visibility: ResourceVisibilities.workspace,
      status: ImageAssetStatuses.available,
    }));
    fixture.authorizationPolicyDecisionEvaluator.deniedAssetIds.add("image-asset:b");

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.items.map((item) => item.assetId)).toEqual(["image-asset:a"]);
  });

  it("returns access-denied when actor lacks active workspace membership", async () => {
    const fixture = buildFixture();
    fixture.workspaceAuthorizationReadRepository.allow = false;

    const result = await fixture.useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ImageAssetMetadataReadErrorCodes.accessDenied,
      }),
    });
  });
});

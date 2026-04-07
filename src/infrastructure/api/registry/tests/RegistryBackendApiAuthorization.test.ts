import { describe, expect, it } from "bun:test";
import { RegistryBackendApi } from "../RegistryBackendApi";
import { AuthorizationPolicyDecisionEvaluator } from "../../../../application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../../../../application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationRoleGrantReadRepository } from "../../../../application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../../../../application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../../../../application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  SharingPolicyModes,
  SharingSubjectKinds,
} from "../../../../domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "../../../../domain/authorization/AuthorizationPermissionCatalog";

class InMemoryRegistryAuthorizationRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrants: ReadonlyArray<AuthorizationSharingGrantRecord> = Object.freeze([]);
  public resourceMetadata = new Map<string, AuthorizationResourcePolicyMetadata>();

  public async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  public async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrants;
  }

  public async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourceMetadata.get(`${query.resource.resourceType}:${query.resource.resourceId}`);
  }

  public async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourceMetadata.values()]);
  }
}

describe("RegistryBackendApi authorization", () => {
  it("applies non-leaky authorization to asset detail reads", async () => {
    const repositories = new InMemoryRegistryAuthorizationRepositories();
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: { now: () => new Date("2026-04-05T16:00:00.000Z") },
    });
    repositories.resourceMetadata.set(
      "registry-asset:asset:alpha",
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "registry-asset",
        resourceId: "asset:alpha",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.sharingGrants = Object.freeze([
      Object.freeze({
        id: "share-asset-alpha",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-shared",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);

    const api = new RegistryBackendApi(
      {
        async listAllAssets() { return []; },
        async listByContractFacets() { return []; },
        async searchAssets() { return []; },
        async getAssetByVersionId(versionId: string) {
          if (versionId === "asset:alpha:v1") {
            return Object.freeze({ assetId: "asset:alpha", versionId: "asset:alpha:v1" });
          }
          return undefined;
        },
        async getAssetByAssetId(assetId: string) {
          if (assetId === "asset:alpha") {
            return Object.freeze({ assetId: "asset:alpha", versionId: "asset:alpha:v1" });
          }
          return undefined;
        },
      } as any,
      {} as any,
      undefined,
      {
        authorizationDecisionEvaluator: evaluator,
      },
    );

    const allowed = await api.getAssetDetail(
      { assetId: "asset:alpha" },
      { actorUserIdentityId: "user-shared", activeWorkspaceId: "workspace-alpha" },
    );
    expect(allowed.ok).toBeTrue();
    expect(allowed.data?.assetId).toBe("asset:alpha");

    const denied = await api.getAssetDetail(
      { assetId: "asset:alpha" },
      { actorUserIdentityId: "user-denied", activeWorkspaceId: "workspace-alpha" },
    );
    const missing = await api.getAssetDetail(
      { assetId: "asset:missing" },
      { actorUserIdentityId: "user-denied", activeWorkspaceId: "workspace-alpha" },
    );
    expect(denied.ok).toBeFalse();
    expect(denied.error).toEqual(missing.error);
  });
});

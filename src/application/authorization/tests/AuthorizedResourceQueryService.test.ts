import { describe, expect, it } from "bun:test";
import {
  PermissionEffects,
  PermissionGrantScopes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createPermissionGrant,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import {
  AuthorizedResourceAccessFilters,
  AuthorizedResourceQueryService,
} from "../use-cases/AuthorizedResourceQueryService";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";

class InMemoryAuthorizationQueryRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshotByActor = new Map<string, AuthorizationActorRoleGrantSnapshot>();
  public resourcePolicyMetadataByResourceKey = new Map<string, AuthorizationResourcePolicyMetadata>();
  public sharingGrantRecordsByResourceKey = new Map<string, ReadonlyArray<AuthorizationSharingGrantRecord>>();

  async getActorRoleGrantSnapshot(
    query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    const actorId = query.actor.actorUserIdentityId ?? query.actor.actorServiceId ?? "";
    return this.roleGrantSnapshotByActor.get(actorId) ?? Object.freeze({
      roleAssignments: Object.freeze([]),
      permissionGrants: Object.freeze([]),
    });
  }

  async listSharingGrants(
    query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    const key = toResourceKey(query.resource.resourceFamily, query.resource.resourceType, query.resource.resourceId);
    return this.sharingGrantRecordsByResourceKey.get(key) ?? Object.freeze([]);
  }

  async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourcePolicyMetadataByResourceKey.get(
      toResourceKey(query.resource.resourceFamily, query.resource.resourceType, query.resource.resourceId),
    );
  }

  async listResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return [...this.resourcePolicyMetadataByResourceKey.values()].filter((record) => {
      if (query.workspaceId && record.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.ownerUserIdentityId && record.ownerUserIdentityId !== query.ownerUserIdentityId) {
        return false;
      }
      if (query.visibility && record.visibility !== query.visibility) {
        return false;
      }
      if (query.resourceFamily && record.resourceFamily !== query.resourceFamily) {
        return false;
      }
      if (query.resourceType && record.resourceType !== query.resourceType) {
        return false;
      }
      return true;
    });
  }
}

describe("AuthorizedResourceQueryService", () => {
  it("returns only authorized resources for workspace list/search views and excludes unauthorized entries", async () => {
    const repositories = new InMemoryAuthorizationQueryRepositories();
    seedRepositories(repositories);

    const decisionEvaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });
    const service = new AuthorizedResourceQueryService({
      resourcePolicyMetadataReadRepository: repositories,
      policyDecisionEvaluator: decisionEvaluator,
    });

    const result = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "asset.read",
      resourceFamilies: [AuthorizationResourceFamilies.asset],
      searchText: "asset:",
      limit: 25,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.items.map((item) => item.resourceId)).toEqual([
      "asset:owned:1",
      "asset:shared:1",
      "asset:workspace:1",
    ]);
    expect(result.value.items.some((item) => item.resourceId === "asset:private-denied:1")).toBe(false);
  });

  it("supports owner/shared access filters for workspace result sets", async () => {
    const repositories = new InMemoryAuthorizationQueryRepositories();
    seedRepositories(repositories);

    const service = new AuthorizedResourceQueryService({
      resourcePolicyMetadataReadRepository: repositories,
      policyDecisionEvaluator: new AuthorizationPolicyDecisionEvaluator({
        roleGrantReadRepository: repositories,
        sharingGrantReadRepository: repositories,
        resourcePolicyMetadataReadRepository: repositories,
      }),
    });

    const ownerOnly = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "asset.read",
      resourceFamilies: [AuthorizationResourceFamilies.asset],
      accessFilters: [AuthorizedResourceAccessFilters.owner],
    });
    expect(ownerOnly.ok).toBe(true);
    if (ownerOnly.ok) {
      expect(ownerOnly.value.items.map((item) => item.resourceId)).toEqual(["asset:owned:1"]);
    }

    const sharedOnly = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "asset.read",
      resourceFamilies: [AuthorizationResourceFamilies.asset],
      accessFilters: [AuthorizedResourceAccessFilters.shared],
    });
    expect(sharedOnly.ok).toBe(true);
    if (sharedOnly.ok) {
      expect(sharedOnly.value.items.map((item) => item.resourceId)).toEqual(["asset:shared:1"]);
    }
  });

  it("preserves deterministic ordering/pagination and supports additional resource families", async () => {
    const repositories = new InMemoryAuthorizationQueryRepositories();
    seedRepositories(repositories);

    const service = new AuthorizedResourceQueryService({
      resourcePolicyMetadataReadRepository: repositories,
      policyDecisionEvaluator: new AuthorizationPolicyDecisionEvaluator({
        roleGrantReadRepository: repositories,
        sharingGrantReadRepository: repositories,
        resourcePolicyMetadataReadRepository: repositories,
      }),
    });

    const firstPage = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "log.read",
      resourceFamilies: [AuthorizationResourceFamilies.log],
      limit: 1,
      offset: 0,
    });
    const secondPage = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "log.read",
      resourceFamilies: [AuthorizationResourceFamilies.log],
      limit: 1,
      offset: 1,
    });
    const rerunFirstPage = await service.listAuthorizedResources({
      actor: {
        actorUserIdentityId: "user:alice",
        activeWorkspaceId: "workspace:alpha",
      },
      workspaceId: "workspace:alpha",
      requiredPermissionKey: "log.read",
      resourceFamilies: [AuthorizationResourceFamilies.log],
      limit: 1,
      offset: 0,
    });

    expect(firstPage.ok).toBe(true);
    expect(secondPage.ok).toBe(true);
    expect(rerunFirstPage.ok).toBe(true);
    if (firstPage.ok && secondPage.ok && rerunFirstPage.ok) {
      expect(firstPage.value.items[0]?.resourceId).toBe("log:shared:1");
      expect(firstPage.value.pagination.hasMore).toBe(true);
      expect(secondPage.value.items[0]?.resourceId).toBe("log:workspace:1");
      expect(rerunFirstPage.value.items).toEqual(firstPage.value.items);
    }
  });
});

function seedRepositories(repositories: InMemoryAuthorizationQueryRepositories): void {
  repositories.roleGrantSnapshotByActor.set("user:alice", Object.freeze({
    roleAssignments: Object.freeze([
      createRoleAssignment({
        id: "role:alpha:member",
        actorUserIdentityId: "user:alice",
        roleKey: "member",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace:alpha",
        assignedByUserIdentityId: "user:owner",
        assignedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]),
    permissionGrants: Object.freeze([
      createPermissionGrant({
        id: "grant:asset:read",
        permissionKey: "asset.read",
        effect: PermissionEffects.allow,
        scope: PermissionGrantScopes.workspace,
        workspaceId: "workspace:alpha",
        grantedByUserIdentityId: "user:owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
      createPermissionGrant({
        id: "grant:log:read",
        permissionKey: "log.read",
        effect: PermissionEffects.allow,
        scope: PermissionGrantScopes.workspace,
        workspaceId: "workspace:alpha",
        grantedByUserIdentityId: "user:owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]),
  }));

  const resourcePolicies: AuthorizationResourcePolicyMetadata[] = [
    {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset:owned:1",
      ownerUserIdentityId: "user:alice",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: SharingPolicyModes.ownerOnly,
      allowResharing: false,
      isPublishedCapable: false,
    },
    {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset:shared:1",
      ownerUserIdentityId: "user:bob",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
    },
    {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset:workspace:1",
      ownerUserIdentityId: "user:bob",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
      isPublishedCapable: false,
    },
    {
      resourceFamily: AuthorizationResourceFamilies.asset,
      resourceType: "asset",
      resourceId: "asset:private-denied:1",
      ownerUserIdentityId: "user:bob",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: SharingPolicyModes.ownerOnly,
      allowResharing: false,
      isPublishedCapable: false,
    },
    {
      resourceFamily: AuthorizationResourceFamilies.log,
      resourceType: "log",
      resourceId: "log:shared:1",
      ownerUserIdentityId: "user:bob",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
    },
    {
      resourceFamily: AuthorizationResourceFamilies.log,
      resourceType: "log",
      resourceId: "log:workspace:1",
      ownerUserIdentityId: "user:bob",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
      isPublishedCapable: false,
    },
  ];

  for (const policy of resourcePolicies) {
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey(policy.resourceFamily, policy.resourceType, policy.resourceId),
      Object.freeze(policy),
    );
  }

  repositories.sharingGrantRecordsByResourceKey.set(
    toResourceKey(AuthorizationResourceFamilies.asset, "asset", "asset:shared:1"),
    Object.freeze([
      Object.freeze({
        id: "share:asset:1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user:alice",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user:bob",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]),
  );
  repositories.sharingGrantRecordsByResourceKey.set(
    toResourceKey(AuthorizationResourceFamilies.log, "log", "log:shared:1"),
    Object.freeze([
      Object.freeze({
        id: "share:log:1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user:alice",
        },
        permissionKeys: Object.freeze(["log.read"]),
        grantedByUserIdentityId: "user:bob",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]),
  );
}

function toResourceKey(resourceFamily: string, resourceType: string, resourceId: string): string {
  return `${resourceFamily}:${resourceType}:${resourceId}`;
}


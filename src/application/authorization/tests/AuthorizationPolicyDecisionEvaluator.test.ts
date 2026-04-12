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
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationPolicyDecisionEvaluator } from "../use-cases/AuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";

const evaluationAsOf = "2026-04-05T16:00:00.000Z";

class InMemoryDecisionPolicyRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrantRecords: ReadonlyArray<AuthorizationSharingGrantRecord> = Object.freeze([]);
  public resourcePolicyMetadataByResourceKey = new Map<string, AuthorizationResourcePolicyMetadata>();

  async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  async listSharingGrants(
    _query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrantRecords;
  }

  async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourcePolicyMetadataByResourceKey.get(toResourceKey(query.resource.resourceType, query.resource.resourceId));
  }

  async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourcePolicyMetadataByResourceKey.values()]);
  }
}

describe("AuthorizationPolicyDecisionEvaluator", () => {
  it("allows shared-resource reads when sharing grants match actor identity", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-shared-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-shared-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.shared,
        sharingPolicyMode: SharingPolicyModes.explicit,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.sharingGrantRecords = Object.freeze([
      Object.freeze({
        id: "share-actor-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-shared",
        },
        permissionKeys: Object.freeze(["asset.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
      clock: {
        now: () => new Date(evaluationAsOf),
      },
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-shared",
        activeWorkspaceId: "workspace-alpha",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-shared-1",
        },
      },
      asOf: evaluationAsOf,
      includeDebugDetails: true,
    });

    expect(result.decision.isAllowed).toBe(true);
    expect(result.decision.reasonCode).toBe("matched-sharing-grant");
    expect(result.decision.matchedSharingGrantIds).toEqual(["share-actor-1"]);
    expect(result.debug?.targetKind).toBe("resource-instance");
    expect(result.debug?.sharingGrantCount).toBe(1);
  });

  it("returns stable denial reason when explicit deny grant matches", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("asset", "asset-deny-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.asset,
        resourceType: "asset",
        resourceId: "asset-deny-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.private,
        sharingPolicyMode: SharingPolicyModes.ownerOnly,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([]),
      permissionGrants: Object.freeze([
        createPermissionGrant({
          id: "deny-1",
          permissionKey: "asset.update",
          effect: PermissionEffects.deny,
          scope: PermissionGrantScopes.workspace,
          workspaceId: "workspace-alpha",
          grantedByUserIdentityId: "user-admin",
          grantedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.update",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "asset-deny-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("deny");
    expect(result.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant,
    );
    expect(result.decision.matchedPermissionGrantIds).toEqual(["deny-1"]);
  });

  it("returns deterministic deny when resource policy metadata is missing", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.asset,
          resourceType: "asset",
          resourceId: "missing-resource",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.outcome).toBe("deny");
    expect(result.decision.reasonCode).toBe("resource-policy-metadata-not-found");
    expect(result.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound,
    );
  });

  it("supports workspace-scoped capability checks without loading a resource instance", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-member-1",
          actorUserIdentityId: "user-member",
          roleKey: "member",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const allowed = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-member",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId: "workspace-alpha",
        capabilityResourceType: "asset",
      },
      asOf: evaluationAsOf,
    });

    expect(allowed.decision.isAllowed).toBe(true);
    expect(allowed.decision.reasonCode).toBe("matched-role-grant");

    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-viewer-1",
          actorUserIdentityId: "user-viewer",
          roleKey: "viewer",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const denied = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-viewer",
      },
      requiredPermissionKey: "asset.create",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId: "workspace-alpha",
        capabilityResourceType: "asset",
      },
      asOf: evaluationAsOf,
      includeDebugDetails: true,
    });

    expect(denied.decision.outcome).toBe("deny");
    expect(denied.decision.denialReason).toBe(
      AuthorizationPolicyDecisionDenialReasons.insufficientPermissions,
    );
    expect(denied.debug?.targetKind).toBe("workspace-capability");
  });

  it("uses workspace visibility fallback for read/list when actor has workspace membership context", async () => {
    const repositories = new InMemoryDecisionPolicyRepositories();
    repositories.resourcePolicyMetadataByResourceKey.set(
      toResourceKey("log", "log-visibility-1"),
      Object.freeze({
        resourceFamily: AuthorizationResourceFamilies.log,
        resourceType: "log",
        resourceId: "log-visibility-1",
        ownerUserIdentityId: "user-owner",
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId: "workspace-alpha",
        visibility: ResourceVisibilities.workspace,
        sharingPolicyMode: SharingPolicyModes.workspaceMembers,
        allowResharing: false,
        isPublishedCapable: false,
      }),
    );
    repositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-guest-1",
          actorUserIdentityId: "user-guest",
          roleKey: "guest",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-01T00:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: repositories,
      sharingGrantReadRepository: repositories,
      resourcePolicyMetadataReadRepository: repositories,
    });

    const result = await evaluator.evaluateDecision({
      actor: {
        actorUserIdentityId: "user-guest",
      },
      requiredPermissionKey: "log.read",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
        resource: {
          resourceFamily: AuthorizationResourceFamilies.log,
          resourceType: "log",
          resourceId: "log-visibility-1",
        },
      },
      asOf: evaluationAsOf,
    });

    expect(result.decision.isAllowed).toBe(true);
    expect(result.decision.reasonCode).toBe("visibility-workspace-member");
    expect(result.debug).toBeUndefined();
  });
});

function toResourceKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}


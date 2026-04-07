import { describe, expect, it } from "bun:test";
import {
  AuthorizationDomainError,
  PermissionEffects,
  PermissionGrantScopes,
  PolicyDecisionOutcomes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  createActorContext,
  createPermissionGrant,
  createPermissionKey,
  createPolicyDecision,
  createResourcePolicyContext,
  createRoleAssignment,
  createSharingGrant,
  createSharingPolicy,
} from "../AuthorizationDomain";

describe("AuthorizationDomain", () => {
  it("creates workspace-scoped role assignments with canonical invariants", () => {
    const assignment = createRoleAssignment({
      id: "role-assignment:1",
      actorUserIdentityId: "user:member-1",
      roleKey: "editor",
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace:alpha",
      assignedByUserIdentityId: "user:owner-1",
      assignedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(assignment.workspaceId).toBe("workspace:alpha");
    expect(assignment.scope).toBe(RoleAssignmentScopes.workspace);
  });

  it("rejects invalid role assignment scope combinations", () => {
    expect(() => createRoleAssignment({
      id: "role-assignment:invalid",
      actorUserIdentityId: "user:member-1",
      roleKey: "editor",
      scope: RoleAssignmentScopes.workspace,
      assignedByUserIdentityId: "user:owner-1",
    })).toThrow("workspaceId");

    expect(() => createRoleAssignment({
      id: "role-assignment:global-invalid",
      actorUserIdentityId: "user:member-1",
      roleKey: "editor",
      scope: RoleAssignmentScopes.global,
      workspaceId: "workspace:alpha",
      assignedByUserIdentityId: "user:owner-1",
    })).toThrow("Global role assignments");
  });

  it("creates permission grants with namespaced permission keys", () => {
    const grant = createPermissionGrant({
      id: "permission-grant:1",
      permissionKey: createPermissionKey("asset.read"),
      effect: PermissionEffects.allow,
      scope: PermissionGrantScopes.resource,
      resourceType: "asset",
      resourceId: "asset:1",
      grantedByUserIdentityId: "user:owner-1",
      grantedAt: "2026-04-05T12:00:00.000Z",
      expiresAt: "2026-04-05T13:00:00.000Z",
    });

    expect(grant.permissionKey).toBe("asset.read");
    expect(grant.scope).toBe(PermissionGrantScopes.resource);
  });

  it("rejects invalid permission keys and grant scope combinations", () => {
    expect(() => createPermissionKey("asset")).toThrow("namespaced format");

    expect(() => createPermissionGrant({
      id: "permission-grant:invalid",
      permissionKey: "asset.read",
      effect: PermissionEffects.allow,
      scope: PermissionGrantScopes.workspace,
      grantedByUserIdentityId: "user:owner-1",
    })).toThrow("workspaceId");
  });

  it("enforces visibility and sharing invariants for private resources", () => {
    expect(() => createResourcePolicyContext({
      resourceType: "asset",
      resourceId: "asset:private",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.userPrivate,
      visibility: ResourceVisibilities.private,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.ownerOnly,
      }),
      sharingGrants: [
        createSharingGrant({
          id: "sharing-grant:user",
          subject: {
            kind: "user",
            userIdentityId: "user:other-1",
          },
          permissions: ["asset.read"],
          grantedByUserIdentityId: "user:owner-1",
          grantedAt: "2026-04-05T12:00:00.000Z",
        }),
      ],
    })).toThrow("Private visibility cannot include explicit sharing grants");
  });

  it("enforces workspace-scope visibility semantics", () => {
    expect(() => createResourcePolicyContext({
      resourceType: "workflow",
      resourceId: "workflow:1",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.userPrivate,
      visibility: ResourceVisibilities.workspace,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.workspaceMembers,
      }),
    })).toThrow("Workspace visibility is only valid for workspace-scoped resources");

    const workspaceResource = createResourcePolicyContext({
      resourceType: "workflow",
      resourceId: "workflow:2",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.workspaceMembers,
      }),
    });

    expect(workspaceResource.workspaceId).toBe("workspace:alpha");
    expect(workspaceResource.visibility).toBe(ResourceVisibilities.workspace);
  });

  it("enforces explicit-sharing invariants for shared visibility", () => {
    expect(() => createResourcePolicyContext({
      resourceType: "template",
      resourceId: "template:shared-1",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.workspaceMembers,
      }),
    })).toThrow("Shared visibility requires sharingPolicy.mode='explicit'");

    const sharedResource = createResourcePolicyContext({
      resourceType: "template",
      resourceId: "template:shared-2",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.explicit,
      }),
      sharingGrants: [
        createSharingGrant({
          id: "sharing-grant:user",
          subject: {
            kind: "user",
            userIdentityId: "user:viewer-1",
          },
          permissions: ["template.read"],
          grantedByUserIdentityId: "user:owner-1",
          grantedAt: "2026-04-05T12:00:00.000Z",
        }),
      ],
    });

    expect(sharedResource.sharingGrants).toHaveLength(1);
  });

  it("enforces published-capable semantics and public sharing constraints", () => {
    expect(() => createResourcePolicyContext({
      resourceType: "artifact",
      resourceId: "artifact:1",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.published,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.published,
      }),
      isPublishedCapable: false,
      publishedAt: "2026-04-05T12:00:00.000Z",
    })).toThrow("isPublishedCapable=true");

    expect(() => createResourcePolicyContext({
      resourceType: "artifact",
      resourceId: "artifact:2",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.explicit,
      }),
      sharingGrants: [
        createSharingGrant({
          id: "sharing-grant:public",
          subject: {
            kind: "public",
          },
          permissions: ["artifact.read"],
          grantedByUserIdentityId: "user:owner-1",
          grantedAt: "2026-04-05T12:00:00.000Z",
        }),
      ],
    })).toThrow("Public sharing subjects require published visibility");

    const published = createResourcePolicyContext({
      resourceType: "artifact",
      resourceId: "artifact:3",
      ownerUserIdentityId: "user:owner-1",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace:alpha",
      visibility: ResourceVisibilities.published,
      sharingPolicy: createSharingPolicy({
        mode: SharingPolicyModes.published,
      }),
      sharingGrants: [
        createSharingGrant({
          id: "sharing-grant:public",
          subject: {
            kind: "public",
          },
          permissions: ["artifact.read"],
          grantedByUserIdentityId: "user:owner-1",
          grantedAt: "2026-04-05T12:00:00.000Z",
        }),
      ],
      isPublishedCapable: true,
      publishedAt: "2026-04-05T12:01:00.000Z",
    });

    expect(published.visibility).toBe(ResourceVisibilities.published);
  });

  it("builds actor context with role and permission context", () => {
    const roleAssignment = createRoleAssignment({
      id: "role-assignment:workspace-admin",
      actorUserIdentityId: "user:admin-1",
      roleKey: "admin",
      scope: RoleAssignmentScopes.workspace,
      workspaceId: "workspace:alpha",
      assignedByUserIdentityId: "user:owner-1",
      assignedAt: "2026-04-05T12:00:00.000Z",
    });
    const permissionGrant = createPermissionGrant({
      id: "permission-grant:workflow-run",
      permissionKey: "workflow.run",
      effect: PermissionEffects.allow,
      scope: PermissionGrantScopes.workspace,
      workspaceId: "workspace:alpha",
      grantedByUserIdentityId: "user:owner-1",
      grantedAt: "2026-04-05T12:00:00.000Z",
    });

    const actor = createActorContext({
      actorUserIdentityId: "user:admin-1",
      activeWorkspaceId: "workspace:alpha",
      roleAssignments: [roleAssignment],
      permissionGrants: [permissionGrant],
      authenticatedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(actor.roleAssignments).toHaveLength(1);
    expect(actor.permissionGrants).toHaveLength(1);
  });

  it("requires actor identity or service identity in actor context", () => {
    expect(() => createActorContext({})).toThrow(AuthorizationDomainError);
  });

  it("creates policy decisions with structured evaluation metadata", () => {
    const decision = createPolicyDecision({
      outcome: PolicyDecisionOutcomes.allow,
      requiredPermissionKey: "asset.read",
      reasonCode: "matched-sharing-grant",
      reason: "Actor has explicit sharing grant.",
      evaluatedAt: "2026-04-05T12:00:00.000Z",
      matchedRoleAssignmentIds: ["role-assignment:workspace-admin"],
      matchedPermissionGrantIds: ["permission-grant:workflow-run"],
      matchedSharingGrantIds: ["sharing-grant:user"],
    });

    expect(decision.outcome).toBe(PolicyDecisionOutcomes.allow);
    expect(decision.requiredPermissionKey).toBe("asset.read");
    expect(decision.matchedSharingGrantIds).toEqual(["sharing-grant:user"]);
  });
});

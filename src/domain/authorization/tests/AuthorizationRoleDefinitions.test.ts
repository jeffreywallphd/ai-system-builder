import { describe, expect, it } from "bun:test";
import { AuthorizationPermissionCatalog } from "../AuthorizationPermissionCatalog";
import {
  AuthorizationRoleCatalog,
  AuthorizationRoleDefinitionError,
  AuthorizationRoleGrantStrategies,
  WorkspaceAuthorizationRoleKeys,
  createAuthorizationRoleCatalog,
  createWorkspaceMembershipAuthorizationSemantics,
  isWorkspaceAuthorizationRoleKey,
  normalizeWorkspaceMembershipRoleKeys,
} from "../AuthorizationRoleDefinitions";

describe("AuthorizationRoleDefinitions", () => {
  it("exposes centrally discoverable baseline role definitions", () => {
    expect(AuthorizationRoleCatalog.version).toBe(1);
    expect(AuthorizationRoleCatalog.deploymentProfileId).toBe("default");
    expect(AuthorizationRoleCatalog.roleKeys).toEqual([
      WorkspaceAuthorizationRoleKeys.owner,
      WorkspaceAuthorizationRoleKeys.admin,
      WorkspaceAuthorizationRoleKeys.member,
      WorkspaceAuthorizationRoleKeys.viewer,
    ]);

    for (const roleKey of AuthorizationRoleCatalog.roleKeys) {
      expect(AuthorizationRoleCatalog.roleDefinitions[roleKey]?.scope).toBe("workspace");
      expect(AuthorizationRoleCatalog.roleDefinitions[roleKey]?.grantStrategy).toBe(
        AuthorizationRoleGrantStrategies.static,
      );
      expect(AuthorizationRoleCatalog.roleDefinitions[roleKey]?.baselinePermissionKeys.length).toBeGreaterThan(0);
    }
  });

  it("maps baseline permissions for each role with expected separation", () => {
    const ownerPermissions = AuthorizationRoleCatalog.roleDefinitions.owner.baselinePermissionKeys;
    const adminPermissions = AuthorizationRoleCatalog.roleDefinitions.admin.baselinePermissionKeys;
    const memberPermissions = AuthorizationRoleCatalog.roleDefinitions.member.baselinePermissionKeys;
    const viewerPermissions = AuthorizationRoleCatalog.roleDefinitions.viewer.baselinePermissionKeys;

    expect(ownerPermissions).toEqual(AuthorizationPermissionCatalog.keys);

    expect(adminPermissions).not.toContain("artifact.publish");
    expect(adminPermissions).toContain("asset.manage");
    expect(adminPermissions).toContain("workflow.run");

    expect(memberPermissions).toContain("workflow.run");
    expect(memberPermissions).toContain("queue.enqueue");
    expect(memberPermissions).not.toContain("asset.delete");
    expect(memberPermissions).not.toContain("system.manage");

    expect(viewerPermissions).toContain("asset.read");
    expect(viewerPermissions).toContain("run.list");
    expect(viewerPermissions).not.toContain("asset.create");
    expect(viewerPermissions).not.toContain("workflow.run");
  });

  it("normalizes workspace membership role assignments and rejects invalid mappings", () => {
    expect(normalizeWorkspaceMembershipRoleKeys(["member", "viewer", "member"])).toEqual([
      WorkspaceAuthorizationRoleKeys.member,
      WorkspaceAuthorizationRoleKeys.viewer,
    ]);

    expect(() => normalizeWorkspaceMembershipRoleKeys([])).toThrow(AuthorizationRoleDefinitionError);
    expect(() => normalizeWorkspaceMembershipRoleKeys(["unknown-role"])).toThrow("invalid");
  });

  it("builds workspace membership authorization semantics from one or more role assignments", () => {
    const semantics = createWorkspaceMembershipAuthorizationSemantics({
      workspaceId: "workspace:alpha",
      userIdentityId: "user:member-1",
      roleKeys: [WorkspaceAuthorizationRoleKeys.member, WorkspaceAuthorizationRoleKeys.viewer],
    });

    expect(semantics.workspaceId).toBe("workspace:alpha");
    expect(semantics.userIdentityId).toBe("user:member-1");
    expect(semantics.roleKeys).toEqual([WorkspaceAuthorizationRoleKeys.member, WorkspaceAuthorizationRoleKeys.viewer]);
    expect(semantics.baselinePermissionKeys).toContain("workflow.run");
    expect(semantics.baselinePermissionKeys).toContain("asset.read");
    expect(semantics.permissionSources.some((entry) => (
      entry.roleKey === WorkspaceAuthorizationRoleKeys.member && entry.permissionKey === "workflow.run"
    ))).toBeTrue();
  });

  it("supports deployment-profile permission overrides without redesign", () => {
    const classroomCatalog = createAuthorizationRoleCatalog({
      deploymentProfileId: "classroom",
      rolePermissionOverrides: {
        member: {
          grantStrategy: AuthorizationRoleGrantStrategies.policyInfluenced,
          addPermissionKeys: ["artifact.publish"],
          removePermissionKeys: ["system.execute"],
        },
      },
    });

    expect(classroomCatalog.deploymentProfileId).toBe("classroom");
    expect(classroomCatalog.roleDefinitions.member.grantStrategy).toBe(
      AuthorizationRoleGrantStrategies.policyInfluenced,
    );
    expect(classroomCatalog.roleDefinitions.member.baselinePermissionKeys).toContain("artifact.publish");
    expect(classroomCatalog.roleDefinitions.member.baselinePermissionKeys).not.toContain("system.execute");

    expect(AuthorizationRoleCatalog.roleDefinitions.member.grantStrategy).toBe(AuthorizationRoleGrantStrategies.static);
    expect(AuthorizationRoleCatalog.roleDefinitions.member.baselinePermissionKeys).toContain("system.execute");
    expect(AuthorizationRoleCatalog.roleDefinitions.member.baselinePermissionKeys).not.toContain("artifact.publish");
  });

  it("rejects invalid override role and permission mappings", () => {
    expect(() => createAuthorizationRoleCatalog({
      deploymentProfileId: "invalid-role",
      rolePermissionOverrides: {
        instructor: {},
      } as never,
    })).toThrow("invalid");

    expect(() => createAuthorizationRoleCatalog({
      deploymentProfileId: "invalid-permission",
      rolePermissionOverrides: {
        viewer: {
          addPermissionKeys: ["system.fake" as never],
        },
      },
    })).toThrow("not defined in AuthorizationPermissionCatalog");
  });

  it("provides role-key type guard for policy evaluation inputs", () => {
    expect(isWorkspaceAuthorizationRoleKey("owner")).toBeTrue();
    expect(isWorkspaceAuthorizationRoleKey("instructor")).toBeFalse();
  });
});

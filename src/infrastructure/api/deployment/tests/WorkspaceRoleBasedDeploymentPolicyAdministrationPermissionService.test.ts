import { describe, expect, it } from "bun:test";
import {
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  type WorkspaceRoleAssignment,
} from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService } from "../WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService";

describe("WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService", () => {
  it("allows owner and admin role assignments for policy-state inspection", async () => {
    const service = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
      workspaceRoleAssignmentRepository: {
        findRoleAssignmentById: async () => undefined,
        countActiveRoleAssignments: async () => 1,
        saveRoleAssignment: async () => {
          throw new Error("unused");
        },
        listRoleAssignments: async () => Object.freeze([Object.freeze({
          id: "role-assignment-1",
          workspaceId: "workspace-alpha",
          userIdentityId: "user:admin",
          role: WorkspaceRoles.admin,
          status: WorkspaceRoleAssignmentStatuses.active,
          assignedAt: "2026-04-08T00:00:00.000Z",
          assignedBy: "user:owner",
        })] satisfies ReadonlyArray<WorkspaceRoleAssignment>),
      },
    });

    const result = await service.evaluatePermission({
      actorUserIdentityId: "user:admin",
      requiredPermission: "deployment-policy.state.read",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      }),
    });

    expect(result.allowed).toBeTrue();
  });

  it("denies non-admin actors", async () => {
    const service = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
      workspaceRoleAssignmentRepository: {
        findRoleAssignmentById: async () => undefined,
        countActiveRoleAssignments: async () => 1,
        saveRoleAssignment: async () => {
          throw new Error("unused");
        },
        listRoleAssignments: async () => Object.freeze([]),
      },
    });

    const result = await service.evaluatePermission({
      actorUserIdentityId: "user:member",
      requiredPermission: "deployment-policy.profile.select",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      }),
    });

    expect(result.allowed).toBeFalse();
    expect(result.reasonCode).toBe("deployment-policy-permission-admin-role-required");
  });

  it("requires owner role for policy mutations", async () => {
    const service = new WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService({
      workspaceRoleAssignmentRepository: {
        findRoleAssignmentById: async () => undefined,
        countActiveRoleAssignments: async () => 1,
        saveRoleAssignment: async () => {
          throw new Error("unused");
        },
        listRoleAssignments: async () => Object.freeze([]),
      },
    });

    const result = await service.evaluatePermission({
      actorUserIdentityId: "user:admin",
      requiredPermission: "deployment-policy.override.manage",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      }),
    });

    expect(result.allowed).toBeFalse();
    expect(result.reason).toContain("owner role");
  });
});

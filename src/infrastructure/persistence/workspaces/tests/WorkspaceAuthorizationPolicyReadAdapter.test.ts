import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import {
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
} from "@domain/workspaces/WorkspaceDomain";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import { WorkspaceAuthorizationPolicyReadAdapter } from "../WorkspaceAuthorizationPolicyReadAdapter";

class InMemoryWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public workspace: Workspace;
  public membershipStatus = WorkspaceMembershipStatuses.active;
  public readonly roleAssignments = [createWorkspaceRoleAssignment({
    id: "workspace-role-assignment:owner",
    workspaceId: "workspace:alpha",
    userIdentityId: "user:owner",
    role: WorkspaceRoles.owner,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T10:00:00.000Z",
    status: WorkspaceRoleAssignmentStatuses.active,
  })];

  public constructor() {
    this.workspace = createWorkspace({
      id: "workspace:alpha",
      slug: "alpha-workspace",
      displayName: "Alpha Workspace",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.team,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T10:00:00.000Z"),
    });
  }

  public async getWorkspaceAuthorizationSnapshot(
    _query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    return Object.freeze({
      workspace: this.workspace,
      membership: createWorkspaceMembership({
        id: "workspace-membership:owner",
        workspaceId: this.workspace.id,
        userIdentityId: "user:owner",
        status: this.membershipStatus,
        joinedAt: "2026-04-05T10:00:00.000Z",
        createdBy: "user:owner",
        now: new Date("2026-04-05T10:00:00.000Z"),
      }),
      activeRoleAssignments: Object.freeze([...this.roleAssignments]),
      effectiveRoles: Object.freeze([WorkspaceRoles.owner]),
      isWorkspaceOwner: true,
    });
  }
}

describe("WorkspaceAuthorizationPolicyReadAdapter", () => {
  it("maps active workspace membership role assignments into authorization role grants", async () => {
    const adapter = new WorkspaceAuthorizationPolicyReadAdapter({
      workspaceAuthorizationReadRepository: new InMemoryWorkspaceAuthorizationReadRepository(),
    });

    const snapshot = await adapter.getActorRoleGrantSnapshot({
      actor: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace:alpha",
      },
      asOf: "2026-04-05T10:30:00.000Z",
    });

    expect(snapshot.roleAssignments).toHaveLength(1);
    expect(snapshot.roleAssignments[0]?.scope).toBe("workspace");
    expect(snapshot.roleAssignments[0]?.workspaceId).toBe("workspace:alpha");
    expect(snapshot.roleAssignments[0]?.roleKey).toBe("owner");
    expect(snapshot.permissionGrants).toEqual([]);
  });

  it("returns no grants when workspace membership is not active", async () => {
    const readRepository = new InMemoryWorkspaceAuthorizationReadRepository();
    readRepository.membershipStatus = WorkspaceMembershipStatuses.suspended;
    const adapter = new WorkspaceAuthorizationPolicyReadAdapter({
      workspaceAuthorizationReadRepository: readRepository,
    });

    const snapshot = await adapter.getActorRoleGrantSnapshot({
      actor: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace:alpha",
      },
      asOf: "2026-04-05T10:30:00.000Z",
    });

    expect(snapshot.roleAssignments).toEqual([]);
    expect(snapshot.permissionGrants).toEqual([]);
  });
});


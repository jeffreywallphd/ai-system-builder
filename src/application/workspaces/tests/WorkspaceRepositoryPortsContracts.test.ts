import { describe, expect, it } from "bun:test";
import {
  WorkspaceStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  createWorkspace,
  createWorkspaceInvitation,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  type Workspace,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceRole,
  type WorkspaceRoleAssignment,
} from "../../../domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  WorkspaceInvitationMutationActions,
  WorkspaceIdNamespaces,
  type CreateWorkspaceInvitationRecordInput,
  type CreateWorkspaceMembershipRecordInput,
  type CreateWorkspaceRecordInput,
  type CreateWorkspaceRoleAssignmentRecordInput,
  type WorkspaceAdministrativeActionContext,
  type WorkspaceAuthorizationSnapshot,
  type WorkspaceAuthorizationSnapshotQuery,
  type WorkspaceInvitationListQuery,
  type WorkspaceListQuery,
  type WorkspaceMembershipListQuery,
  type WorkspacePendingInvitationLookupQuery,
  type WorkspaceRoleAssignmentListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import type { WorkspaceRepositoryPorts } from "../ports/WorkspaceRepositoryPorts";

class InMemoryWorkspacePortAdapter
  implements
    IWorkspaceRepository,
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceInvitationRepository,
    IWorkspaceAuthorizationReadRepository {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly memberships = new Map<string, WorkspaceMembership>();
  private readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();
  private readonly invitations = new Map<string, WorkspaceInvitation>();

  async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId.trim());
  }

  async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalizedSlug = slug.trim().toLowerCase();
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === normalizedSlug) {
        return workspace;
      }
    }
    return undefined;
  }

  async listWorkspaces(query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
    const filtered = [...this.workspaces.values()]
      .filter((workspace) => !query.ownerUserId || workspace.ownership.ownerUserId === query.ownerUserId)
      .filter((workspace) => !query.visibility || workspace.ownership.visibility === query.visibility)
      .filter((workspace) => !query.slugPrefix || workspace.slug.startsWith(query.slugPrefix.trim().toLowerCase()))
      .filter((workspace) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(workspace.status))
      .filter((workspace) => {
        if (!query.memberUserIdentityId) {
          return true;
        }
        for (const membership of this.memberships.values()) {
          if (
            membership.workspaceId === workspace.id &&
            membership.userIdentityId === query.memberUserIdentityId &&
            membership.status === WorkspaceMembershipStatuses.active
          ) {
            return true;
          }
        }
        return false;
      });

    return this.page(filtered, query.limit, query.offset);
  }

  async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async findMembershipById(membershipId: string): Promise<WorkspaceMembership | undefined> {
    return this.memberships.get(membershipId.trim());
  }

  async findMembershipByWorkspaceAndUser(
    workspaceId: string,
    userIdentityId: string,
  ): Promise<WorkspaceMembership | undefined> {
    for (const membership of this.memberships.values()) {
      if (membership.workspaceId === workspaceId && membership.userIdentityId === userIdentityId) {
        return membership;
      }
    }
    return undefined;
  }

  async listMemberships(query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
    const filtered = [...this.memberships.values()]
      .filter((membership) => membership.workspaceId === query.workspaceId)
      .filter((membership) => !query.userIdentityId || membership.userIdentityId === query.userIdentityId)
      .filter((membership) => !query.invitationId || membership.invitationId === query.invitationId)
      .filter((membership) => !query.invitedByUserId || membership.invitedByUserId === query.invitedByUserId)
      .filter((membership) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(membership.status));

    return this.page(filtered, query.limit, query.offset);
  }

  async saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership> {
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined> {
    return this.roleAssignments.get(roleAssignmentId.trim());
  }

  async listRoleAssignments(query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>> {
    const filtered = [...this.roleAssignments.values()]
      .filter((assignment) => assignment.workspaceId === query.workspaceId)
      .filter((assignment) => !query.userIdentityId || assignment.userIdentityId === query.userIdentityId)
      .filter((assignment) => !query.roles || query.roles.length === 0 || query.roles.includes(assignment.role))
      .filter((assignment) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(assignment.status));

    return this.page(filtered, query.limit, query.offset);
  }

  async countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number> {
    let count = 0;
    for (const assignment of this.roleAssignments.values()) {
      if (
        assignment.workspaceId === workspaceId &&
        assignment.status === WorkspaceRoleAssignmentStatuses.active &&
        (!role || assignment.role === role)
      ) {
        count += 1;
      }
    }
    return count;
  }

  async saveRoleAssignment(roleAssignment: WorkspaceRoleAssignment): Promise<WorkspaceRoleAssignment> {
    this.roleAssignments.set(roleAssignment.id, roleAssignment);
    return roleAssignment;
  }

  async findInvitationById(invitationId: string): Promise<WorkspaceInvitation | undefined> {
    return this.invitations.get(invitationId.trim());
  }

  async findPendingInvitationByEmail(
    query: WorkspacePendingInvitationLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const normalizedEmail = query.invitedEmail.trim().toLowerCase();
    const asOf = query.asOf ? new Date(query.asOf).getTime() : undefined;
    for (const invitation of this.invitations.values()) {
      if (
        invitation.workspaceId === query.workspaceId &&
        invitation.invitedEmail === normalizedEmail &&
        invitation.status === "pending" &&
        (asOf === undefined || new Date(invitation.expiresAt).getTime() > asOf)
      ) {
        return invitation;
      }
    }
    return undefined;
  }

  async listInvitations(query: WorkspaceInvitationListQuery): Promise<ReadonlyArray<WorkspaceInvitation>> {
    const expiresBefore = query.expiresBefore ? new Date(query.expiresBefore).getTime() : undefined;
    const expiresAfter = query.expiresAfter ? new Date(query.expiresAfter).getTime() : undefined;

    const filtered = [...this.invitations.values()]
      .filter((invitation) => invitation.workspaceId === query.workspaceId)
      .filter((invitation) => !query.invitedEmail || invitation.invitedEmail === query.invitedEmail.trim().toLowerCase())
      .filter((invitation) => !query.invitedByUserId || invitation.invitedByUserId === query.invitedByUserId)
      .filter((invitation) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(invitation.status))
      .filter((invitation) => !query.activeOnly || invitation.status === "pending")
      .filter((invitation) => expiresBefore === undefined || new Date(invitation.expiresAt).getTime() < expiresBefore)
      .filter((invitation) => expiresAfter === undefined || new Date(invitation.expiresAt).getTime() > expiresAfter);

    return this.page(filtered, query.limit, query.offset);
  }

  async saveInvitation(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = await this.findWorkspaceById(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const membership = await this.findMembershipByWorkspaceAndUser(query.workspaceId, query.userIdentityId);
    const assignments = [...this.roleAssignments.values()].filter((assignment) => (
      assignment.workspaceId === query.workspaceId &&
      assignment.userIdentityId === query.userIdentityId &&
      assignment.status === WorkspaceRoleAssignmentStatuses.active
    ));
    const effectiveRoles = Object.freeze([...new Set(assignments.map((assignment) => assignment.role))]);
    return Object.freeze({
      workspace,
      membership,
      activeRoleAssignments: Object.freeze(assignments),
      effectiveRoles,
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
    });
  }

  private page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
    const normalizedOffset = offset && offset > 0 ? offset : 0;
    const normalizedLimit = limit && limit > 0 ? limit : undefined;
    const paged = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
    return normalizedLimit ? paged.slice(0, normalizedLimit) : paged;
  }
}

describe("workspace repository ports and shared contracts", () => {
  it("exposes stable namespace and lifecycle mutation constants", () => {
    expect(WorkspaceIdNamespaces.workspace).toBe("workspace");
    expect(WorkspaceIdNamespaces.workspaceMembership).toBe("workspace-membership");
    expect(WorkspaceInvitationMutationActions.accept).toBe("accept");
    expect(WorkspaceInvitationMutationActions.expire).toBe("expire");
  });

  it("supports create and list/query contracts for workspace tenancy records", async () => {
    const adapter = new InMemoryWorkspacePortAdapter();
    const action: WorkspaceAdministrativeActionContext = {
      actorUserIdentityId: "user-owner",
      actorWorkspaceId: "workspace-alpha",
      occurredAt: "2026-04-05T12:00:00.000Z",
      authorization: {
        scope: "workspace-admin",
      },
      audit: {
        reason: "initialization",
      },
    };

    const workspaceInput: CreateWorkspaceRecordInput = {
      id: "workspace-alpha",
      slug: "team-alpha",
      displayName: "Team Alpha",
      ownerUserId: "user-owner",
      visibility: WorkspaceVisibilities.team,
      status: WorkspaceStatuses.active,
      action,
    };
    const workspace = await adapter.saveWorkspace(createWorkspace({
      id: workspaceInput.id,
      slug: workspaceInput.slug,
      displayName: workspaceInput.displayName,
      description: workspaceInput.description,
      ownerUserId: workspaceInput.ownerUserId,
      visibility: workspaceInput.visibility,
      status: workspaceInput.status,
      createdBy: workspaceInput.action.actorUserIdentityId,
      now: new Date(workspaceInput.action.occurredAt ?? "2026-04-05T12:00:00.000Z"),
    }));

    const membershipInput: CreateWorkspaceMembershipRecordInput = {
      id: "membership-alpha-owner",
      workspaceId: workspace.id,
      userIdentityId: "user-owner",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T12:00:00.000Z",
      action,
    };
    await adapter.saveMembership(createWorkspaceMembership({
      id: membershipInput.id,
      workspaceId: membershipInput.workspaceId,
      userIdentityId: membershipInput.userIdentityId,
      status: membershipInput.status,
      joinedAt: membershipInput.joinedAt,
      createdBy: membershipInput.action.actorUserIdentityId,
      now: new Date(membershipInput.action.occurredAt ?? membershipInput.joinedAt ?? "2026-04-05T12:00:00.000Z"),
    }));

    const roleInput: CreateWorkspaceRoleAssignmentRecordInput = {
      id: "role-alpha-owner",
      workspaceId: workspace.id,
      userIdentityId: "user-owner",
      role: WorkspaceRoles.owner,
      action,
    };
    await adapter.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: roleInput.id,
      workspaceId: roleInput.workspaceId,
      userIdentityId: roleInput.userIdentityId,
      role: roleInput.role,
      assignedBy: roleInput.action.actorUserIdentityId,
      assignedAt: roleInput.action.occurredAt,
    }));

    const invitationInput: CreateWorkspaceInvitationRecordInput = {
      id: "invite-alpha-member",
      workspaceId: workspace.id,
      invitedEmail: "member@example.com",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.member],
      expiresAt: "2026-04-06T12:00:00.000Z",
      action,
    };
    await adapter.saveInvitation(createWorkspaceInvitation({
      id: invitationInput.id,
      workspaceId: invitationInput.workspaceId,
      invitedEmail: invitationInput.invitedEmail,
      invitedByUserId: invitationInput.invitedByUserId,
      invitedRoles: invitationInput.invitedRoles,
      expiresAt: invitationInput.expiresAt,
      createdAt: invitationInput.action.occurredAt,
      lastModifiedBy: invitationInput.action.actorUserIdentityId,
      lastModifiedAt: invitationInput.action.occurredAt,
    }));

    const listedWorkspaces = await adapter.listWorkspaces({
      memberUserIdentityId: "user-owner",
      statuses: [WorkspaceStatuses.active],
      visibility: WorkspaceVisibilities.team,
    });
    const listedMemberships = await adapter.listMemberships({
      workspaceId: workspace.id,
      statuses: [WorkspaceMembershipStatuses.active],
    });
    const listedInvitations = await adapter.listInvitations({
      workspaceId: workspace.id,
      statuses: ["pending"],
      activeOnly: true,
    });
    const listedRoleAssignments = await adapter.listRoleAssignments({
      workspaceId: workspace.id,
      roles: [WorkspaceRoles.owner],
      statuses: [WorkspaceRoleAssignmentStatuses.active],
    });

    expect((await adapter.findWorkspaceBySlug("TEAM-ALPHA"))?.id).toBe(workspace.id);
    expect(listedWorkspaces).toHaveLength(1);
    expect(listedMemberships).toHaveLength(1);
    expect(listedInvitations).toHaveLength(1);
    expect(listedRoleAssignments).toHaveLength(1);
    expect(await adapter.countActiveRoleAssignments(workspace.id, WorkspaceRoles.owner)).toBe(1);
  });

  it("supports authorization snapshot and pending invitation lookup contracts", async () => {
    const adapter = new InMemoryWorkspacePortAdapter();
    const workspace = await adapter.saveWorkspace(createWorkspace({
      id: "workspace-snapshot",
      slug: "snapshot-team",
      displayName: "Snapshot Team",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      visibility: WorkspaceVisibilities.private,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T14:00:00.000Z"),
    }));
    await adapter.saveMembership(createWorkspaceMembership({
      id: "membership-snapshot",
      workspaceId: workspace.id,
      userIdentityId: "user-owner",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T14:00:00.000Z",
      createdBy: "user-owner",
      now: new Date("2026-04-05T14:00:00.000Z"),
    }));
    await adapter.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: "role-snapshot-owner",
      workspaceId: workspace.id,
      userIdentityId: "user-owner",
      role: WorkspaceRoles.owner,
      assignedBy: "user-owner",
      assignedAt: "2026-04-05T14:00:00.000Z",
    }));
    await adapter.saveInvitation(createWorkspaceInvitation({
      id: "invite-snapshot",
      workspaceId: workspace.id,
      invitedEmail: "viewer@example.com",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.viewer],
      createdAt: "2026-04-05T14:00:00.000Z",
      expiresAt: "2026-04-05T15:00:00.000Z",
      lastModifiedBy: "user-owner",
      lastModifiedAt: "2026-04-05T14:00:00.000Z",
    }));

    const snapshot = await adapter.getWorkspaceAuthorizationSnapshot({
      workspaceId: workspace.id,
      userIdentityId: "user-owner",
      asOf: "2026-04-05T14:30:00.000Z",
    });
    const pendingInvitation = await adapter.findPendingInvitationByEmail({
      workspaceId: workspace.id,
      invitedEmail: "VIEWER@EXAMPLE.COM",
      asOf: "2026-04-05T14:30:00.000Z",
    });

    expect(snapshot?.workspace.id).toBe(workspace.id);
    expect(snapshot?.isWorkspaceOwner).toBe(true);
    expect(snapshot?.effectiveRoles).toEqual([WorkspaceRoles.owner]);
    expect(pendingInvitation?.id).toBe("invite-snapshot");
  });

  it("supports aggregate dependency wiring through workspace repository port bundle", async () => {
    const adapter = new InMemoryWorkspacePortAdapter();
    const ports: WorkspaceRepositoryPorts = {
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
    };

    const workspace = await ports.workspaceRepository.saveWorkspace(createWorkspace({
      id: "workspace-bundle",
      slug: "bundle-team",
      displayName: "Bundle Team",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
    }));
    const loaded = await ports.workspaceRepository.findWorkspaceById(workspace.id);

    expect(loaded?.slug).toBe("bundle-team");
  });
});

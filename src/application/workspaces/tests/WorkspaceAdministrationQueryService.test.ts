import { describe, expect, it } from "bun:test";
import type { IWorkspaceAuthorizationReadRepository } from "../ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../ports/IWorkspaceRoleAssignmentRepository";
import {
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
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
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
  WorkspaceInvitationListQuery,
  WorkspaceListQuery,
  WorkspaceMembershipListQuery,
  WorkspacePendingInvitationLookupQuery,
  WorkspaceRoleAssignmentListQuery,
} from "../../../shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceVisibilities } from "../../../shared/workspaces/WorkspaceOwnership";
import {
  WorkspaceAdministrationQueryErrorCodes,
  WorkspaceAdministrationQueryService,
  type WorkspaceAdministrationQueryClock,
} from "../use-cases/WorkspaceAdministrationQueryService";

class InMemoryWorkspaceAdministrationQueryAdapter
  implements
    IWorkspaceRepository,
    IWorkspaceMembershipRepository,
    IWorkspaceRoleAssignmentRepository,
    IWorkspaceInvitationRepository,
    IWorkspaceAuthorizationReadRepository {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly memberships = new Map<string, WorkspaceMembership>();
  public readonly roleAssignments = new Map<string, WorkspaceRoleAssignment>();
  public readonly invitations = new Map<string, WorkspaceInvitation>();

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId.trim());
  }

  public async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalizedSlug = slug.trim().toLowerCase();
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === normalizedSlug) {
        return workspace;
      }
    }
    return undefined;
  }

  public async listWorkspaces(query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
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
            membership.workspaceId === workspace.id
            && membership.userIdentityId === query.memberUserIdentityId
            && membership.status === WorkspaceMembershipStatuses.active
          ) {
            return true;
          }
        }

        return false;
      })
      .sort((left, right) => right.ownership.createdAt.localeCompare(left.ownership.createdAt));

    return page(filtered, query.limit, query.offset);
  }

  public async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  public async findMembershipById(membershipId: string): Promise<WorkspaceMembership | undefined> {
    return this.memberships.get(membershipId.trim());
  }

  public async findMembershipByWorkspaceAndUser(
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

  public async listMemberships(query: WorkspaceMembershipListQuery): Promise<ReadonlyArray<WorkspaceMembership>> {
    const filtered = [...this.memberships.values()]
      .filter((membership) => membership.workspaceId === query.workspaceId)
      .filter((membership) => !query.userIdentityId || membership.userIdentityId === query.userIdentityId)
      .filter((membership) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(membership.status))
      .filter((membership) => !query.invitationId || membership.invitationId === query.invitationId)
      .filter((membership) => !query.invitedByUserId || membership.invitedByUserId === query.invitedByUserId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return page(filtered, query.limit, query.offset);
  }

  public async saveMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership> {
    this.memberships.set(membership.id, membership);
    return membership;
  }

  public async findRoleAssignmentById(roleAssignmentId: string): Promise<WorkspaceRoleAssignment | undefined> {
    return this.roleAssignments.get(roleAssignmentId.trim());
  }

  public async listRoleAssignments(query: WorkspaceRoleAssignmentListQuery): Promise<ReadonlyArray<WorkspaceRoleAssignment>> {
    const filtered = [...this.roleAssignments.values()]
      .filter((assignment) => assignment.workspaceId === query.workspaceId)
      .filter((assignment) => !query.userIdentityId || assignment.userIdentityId === query.userIdentityId)
      .filter((assignment) => !query.roles || query.roles.length === 0 || query.roles.includes(assignment.role))
      .filter((assignment) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(assignment.status))
      .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt));

    return page(filtered, query.limit, query.offset);
  }

  public async countActiveRoleAssignments(workspaceId: string, role?: WorkspaceRole): Promise<number> {
    let total = 0;
    for (const roleAssignment of this.roleAssignments.values()) {
      if (
        roleAssignment.workspaceId === workspaceId
        && roleAssignment.status === WorkspaceRoleAssignmentStatuses.active
        && (!role || roleAssignment.role === role)
      ) {
        total += 1;
      }
    }

    return total;
  }

  public async saveRoleAssignment(roleAssignment: WorkspaceRoleAssignment): Promise<WorkspaceRoleAssignment> {
    this.roleAssignments.set(roleAssignment.id, roleAssignment);
    return roleAssignment;
  }

  public async findInvitationById(invitationId: string): Promise<WorkspaceInvitation | undefined> {
    return this.invitations.get(invitationId.trim());
  }

  public async findPendingInvitationByEmail(
    query: WorkspacePendingInvitationLookupQuery,
  ): Promise<WorkspaceInvitation | undefined> {
    const asOf = query.asOf ? new Date(query.asOf).getTime() : Number.NaN;
    const normalizedEmail = query.invitedEmail.trim().toLowerCase();

    for (const invitation of this.invitations.values()) {
      const expiresAt = new Date(invitation.expiresAt).getTime();
      if (
        invitation.workspaceId === query.workspaceId
        && invitation.invitedEmail === normalizedEmail
        && invitation.status === WorkspaceInvitationStatuses.pending
        && (Number.isNaN(asOf) || expiresAt > asOf)
      ) {
        return invitation;
      }
    }

    return undefined;
  }

  public async listInvitations(query: WorkspaceInvitationListQuery): Promise<ReadonlyArray<WorkspaceInvitation>> {
    const invitedEmail = query.invitedEmail?.trim().toLowerCase();
    const expiresBefore = query.expiresBefore ? new Date(query.expiresBefore).getTime() : undefined;
    const expiresAfter = query.expiresAfter ? new Date(query.expiresAfter).getTime() : undefined;

    const filtered = [...this.invitations.values()]
      .filter((invitation) => invitation.workspaceId === query.workspaceId)
      .filter((invitation) => !invitedEmail || invitation.invitedEmail === invitedEmail)
      .filter((invitation) => !query.invitedByUserId || invitation.invitedByUserId === query.invitedByUserId)
      .filter((invitation) => !query.statuses || query.statuses.length === 0 || query.statuses.includes(invitation.status))
      .filter((invitation) => !query.activeOnly || invitation.status === WorkspaceInvitationStatuses.pending)
      .filter((invitation) => expiresBefore === undefined || new Date(invitation.expiresAt).getTime() < expiresBefore)
      .filter((invitation) => expiresAfter === undefined || new Date(invitation.expiresAt).getTime() > expiresAfter)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return page(filtered, query.limit, query.offset);
  }

  public async saveInvitation(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = this.workspaces.get(query.workspaceId);
    if (!workspace) {
      return undefined;
    }

    const membership = await this.findMembershipByWorkspaceAndUser(query.workspaceId, query.userIdentityId);
    const activeRoleAssignments = [...this.roleAssignments.values()].filter((roleAssignment) => (
      roleAssignment.workspaceId === query.workspaceId
      && roleAssignment.userIdentityId === query.userIdentityId
      && roleAssignment.status === WorkspaceRoleAssignmentStatuses.active
    ));
    const effectiveRoles = Object.freeze([
      ...new Set(activeRoleAssignments.map((assignment) => assignment.role)),
    ]);

    return Object.freeze({
      workspace,
      membership,
      activeRoleAssignments: Object.freeze(activeRoleAssignments),
      effectiveRoles,
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
    });
  }
}

class FixedWorkspaceAdministrationQueryClock implements WorkspaceAdministrationQueryClock {
  public constructor(private readonly nowIso: string) {}

  public now(): Date {
    return new Date(this.nowIso);
  }
}

function page<TValue>(values: ReadonlyArray<TValue>, limit?: number, offset?: number): ReadonlyArray<TValue> {
  const normalizedOffset = Number.isInteger(offset) && (offset ?? -1) >= 0 ? (offset as number) : 0;
  const normalizedLimit = Number.isInteger(limit) && (limit ?? 0) > 0 ? (limit as number) : undefined;
  const sliced = normalizedOffset > 0 ? values.slice(normalizedOffset) : values;
  return Object.freeze(normalizedLimit === undefined ? sliced : sliced.slice(0, normalizedLimit));
}

function seedWorkspaceAdministrationReadModel(
  adapter: InMemoryWorkspaceAdministrationQueryAdapter,
): { readonly workspaceId: string; readonly secondaryWorkspaceId: string } {
  const workspace = createWorkspace({
    id: "workspace:alpha",
    slug: "team-alpha",
    displayName: "Team Alpha",
    description: "Primary workspace",
    ownerUserId: "user:owner",
    createdBy: "user:owner",
    visibility: WorkspaceVisibilities.team,
    status: WorkspaceStatuses.active,
    now: new Date("2026-04-05T10:00:00.000Z"),
  });
  const workspaceBeta = createWorkspace({
    id: "workspace:beta",
    slug: "team-beta",
    displayName: "Team Beta",
    ownerUserId: "user:beta-owner",
    createdBy: "user:beta-owner",
    visibility: WorkspaceVisibilities.private,
    status: WorkspaceStatuses.active,
    now: new Date("2026-04-05T11:00:00.000Z"),
  });

  adapter.workspaces.set(workspace.id, workspace);
  adapter.workspaces.set(workspaceBeta.id, workspaceBeta);

  adapter.memberships.set("membership:owner", createWorkspaceMembership({
    id: "membership:owner",
    workspaceId: workspace.id,
    userIdentityId: "user:owner",
    status: WorkspaceMembershipStatuses.active,
    joinedAt: "2026-04-05T10:00:00.000Z",
    createdBy: "user:owner",
    now: new Date("2026-04-05T10:00:00.000Z"),
  }));
  adapter.memberships.set("membership:admin", createWorkspaceMembership({
    id: "membership:admin",
    workspaceId: workspace.id,
    userIdentityId: "user:admin",
    status: WorkspaceMembershipStatuses.active,
    joinedAt: "2026-04-05T10:05:00.000Z",
    createdBy: "user:owner",
    now: new Date("2026-04-05T10:05:00.000Z"),
  }));
  adapter.memberships.set("membership:viewer", createWorkspaceMembership({
    id: "membership:viewer",
    workspaceId: workspace.id,
    userIdentityId: "user:viewer",
    status: WorkspaceMembershipStatuses.active,
    joinedAt: "2026-04-05T10:10:00.000Z",
    createdBy: "user:owner",
    now: new Date("2026-04-05T10:10:00.000Z"),
  }));
  adapter.memberships.set("membership:pending", createWorkspaceMembership({
    id: "membership:pending",
    workspaceId: workspace.id,
    userIdentityId: "user:pending",
    status: WorkspaceMembershipStatuses.pending,
    invitedByUserId: "user:owner",
    invitationId: "invite:pending",
    createdBy: "user:owner",
    now: new Date("2026-04-05T10:20:00.000Z"),
  }));

  adapter.memberships.set("membership:beta-owner", createWorkspaceMembership({
    id: "membership:beta-owner",
    workspaceId: workspaceBeta.id,
    userIdentityId: "user:beta-owner",
    status: WorkspaceMembershipStatuses.active,
    joinedAt: "2026-04-05T11:00:00.000Z",
    createdBy: "user:beta-owner",
    now: new Date("2026-04-05T11:00:00.000Z"),
  }));

  adapter.roleAssignments.set("role:owner", createWorkspaceRoleAssignment({
    id: "role:owner",
    workspaceId: workspace.id,
    userIdentityId: "user:owner",
    role: WorkspaceRoles.owner,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T10:00:00.000Z",
  }));
  adapter.roleAssignments.set("role:admin", createWorkspaceRoleAssignment({
    id: "role:admin",
    workspaceId: workspace.id,
    userIdentityId: "user:admin",
    role: WorkspaceRoles.admin,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T10:05:00.000Z",
  }));
  adapter.roleAssignments.set("role:viewer", createWorkspaceRoleAssignment({
    id: "role:viewer",
    workspaceId: workspace.id,
    userIdentityId: "user:viewer",
    role: WorkspaceRoles.viewer,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T10:10:00.000Z",
  }));
  adapter.roleAssignments.set("role:viewer-revoked", createWorkspaceRoleAssignment({
    id: "role:viewer-revoked",
    workspaceId: workspace.id,
    userIdentityId: "user:viewer",
    role: WorkspaceRoles.member,
    status: WorkspaceRoleAssignmentStatuses.revoked,
    assignedBy: "user:owner",
    assignedAt: "2026-04-05T10:09:00.000Z",
    revokedAt: "2026-04-05T10:15:00.000Z",
    revokedBy: "user:owner",
  }));

  adapter.roleAssignments.set("role:beta-owner", createWorkspaceRoleAssignment({
    id: "role:beta-owner",
    workspaceId: workspaceBeta.id,
    userIdentityId: "user:beta-owner",
    role: WorkspaceRoles.owner,
    status: WorkspaceRoleAssignmentStatuses.active,
    assignedBy: "user:beta-owner",
    assignedAt: "2026-04-05T11:00:00.000Z",
  }));

  adapter.invitations.set("invite:pending", createWorkspaceInvitation({
    id: "invite:pending",
    workspaceId: workspace.id,
    invitedEmail: "pending@example.com",
    invitedByUserId: "user:owner",
    invitedRoles: [WorkspaceRoles.member],
    status: WorkspaceInvitationStatuses.pending,
    createdAt: "2026-04-05T10:20:00.000Z",
    expiresAt: "2026-04-05T13:00:00.000Z",
    lastModifiedBy: "user:owner",
    lastModifiedAt: "2026-04-05T10:20:00.000Z",
  }));
  adapter.invitations.set("invite:expired-pending", createWorkspaceInvitation({
    id: "invite:expired-pending",
    workspaceId: workspace.id,
    invitedEmail: "expired@example.com",
    invitedByUserId: "user:owner",
    invitedRoles: [WorkspaceRoles.viewer],
    status: WorkspaceInvitationStatuses.pending,
    createdAt: "2026-04-05T09:00:00.000Z",
    expiresAt: "2026-04-05T10:30:00.000Z",
    lastModifiedBy: "user:owner",
    lastModifiedAt: "2026-04-05T09:00:00.000Z",
  }));
  adapter.invitations.set("invite:accepted", createWorkspaceInvitation({
    id: "invite:accepted",
    workspaceId: workspace.id,
    invitedEmail: "accepted@example.com",
    invitedByUserId: "user:owner",
    invitedRoles: [WorkspaceRoles.viewer],
    status: WorkspaceInvitationStatuses.accepted,
    createdAt: "2026-04-05T08:00:00.000Z",
    expiresAt: "2026-04-05T12:00:00.000Z",
    respondedAt: "2026-04-05T08:30:00.000Z",
    acceptedByUserIdentityId: "user:accepted",
    lastModifiedBy: "user:accepted",
    lastModifiedAt: "2026-04-05T08:30:00.000Z",
  }));

  return {
    workspaceId: workspace.id,
    secondaryWorkspaceId: workspaceBeta.id,
  };
}

describe("WorkspaceAdministrationQueryService", () => {
  it("lists only actor-scoped workspaces and exposes workspace summaries", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await service.listWorkspaces({
      actorUserIdentityId: "user:admin",
      limit: 10,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.workspaces).toHaveLength(1);
    const workspace = result.value.workspaces[0];
    expect(workspace?.id).toBe("workspace:alpha");
    expect(workspace?.membershipSummary.active).toBe(3);
    expect(workspace?.membershipSummary.pending).toBe(1);
    expect(workspace?.roleSummary.activeAssignments).toBe(3);
    expect(workspace?.invitationSummary.pending).toBe(2);
    expect(workspace?.invitationSummary.activePending).toBe(1);
    expect(workspace?.actorAccess.canAdministrate).toBe(true);
    expect(result.value.pagination.hasMore).toBe(false);
  });

  it("lists workspace memberships for admins with role summaries and pagination", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    const seeded = seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await service.listWorkspaceMemberships({
      workspaceId: seeded.workspaceId,
      actorUserIdentityId: "user:owner",
      statuses: [WorkspaceMembershipStatuses.active],
      limit: 2,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.memberships).toHaveLength(2);
    expect(result.value.pagination.hasMore).toBe(true);
    expect(result.value.workspaceMembershipSummary.total).toBe(4);
    expect(result.value.workspaceMembershipSummary.active).toBe(3);
    expect(result.value.workspaceRoleSummary.owner).toBe(1);
    expect(result.value.workspaceRoleSummary.admin).toBe(1);

    const ownerRecord = result.value.memberships.find((member) => member.userIdentityId === "user:owner");
    expect(ownerRecord?.activeRoles).toContain(WorkspaceRoles.owner);
    expect(ownerRecord?.hasAdministrativeRole).toBe(true);
    expect(ownerRecord?.isWorkspaceOwner).toBe(true);
  });

  it("rejects membership and role listing for non-admin actors", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    const seeded = seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const membershipsResult = await service.listWorkspaceMemberships({
      workspaceId: seeded.workspaceId,
      actorUserIdentityId: "user:viewer",
    });
    expect(membershipsResult.ok).toBe(false);
    if (!membershipsResult.ok) {
      expect(membershipsResult.error.code).toBe(WorkspaceAdministrationQueryErrorCodes.forbidden);
    }

    const roleAssignmentsResult = await service.listWorkspaceRoleAssignments({
      workspaceId: seeded.workspaceId,
      actorUserIdentityId: "user:viewer",
    });
    expect(roleAssignmentsResult.ok).toBe(false);
    if (!roleAssignmentsResult.ok) {
      expect(roleAssignmentsResult.error.code).toBe(WorkspaceAdministrationQueryErrorCodes.forbidden);
    }
  });

  it("lists invitations with filter and active/expired read model flags", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    const seeded = seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await service.listWorkspaceInvitations({
      workspaceId: seeded.workspaceId,
      actorUserIdentityId: "user:admin",
      statuses: [WorkspaceInvitationStatuses.pending],
      limit: 10,
      offset: 0,
      asOf: "2026-04-05T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.invitations).toHaveLength(2);
    const activeInvitation = result.value.invitations.find((invitation) => invitation.invitationId === "invite:pending");
    const expiredPendingInvitation = result.value.invitations.find((invitation) => invitation.invitationId === "invite:expired-pending");

    expect(activeInvitation?.isActive).toBe(true);
    expect(activeInvitation?.isExpiredAsOfQuery).toBe(false);
    expect(expiredPendingInvitation?.isActive).toBe(false);
    expect(expiredPendingInvitation?.isExpiredAsOfQuery).toBe(true);

    expect(result.value.workspaceInvitationSummary.total).toBe(3);
    expect(result.value.workspaceInvitationSummary.pending).toBe(2);
    expect(result.value.workspaceInvitationSummary.activePending).toBe(1);
  });

  it("lists role assignments with filtering, pagination, and stable DTO shape", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    const seeded = seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await service.listWorkspaceRoleAssignments({
      workspaceId: seeded.workspaceId,
      actorUserIdentityId: "user:owner",
      statuses: [WorkspaceRoleAssignmentStatuses.active],
      limit: 2,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.roleAssignments).toHaveLength(2);
    expect(result.value.pagination.hasMore).toBe(true);
    expect(result.value.workspaceRoleSummary.totalAssignments).toBe(4);
    expect(result.value.workspaceRoleSummary.activeAssignments).toBe(3);

    for (const roleAssignment of result.value.roleAssignments) {
      expect(typeof roleAssignment.roleAssignmentId).toBe("string");
      expect(typeof roleAssignment.isAdministrativeRole).toBe("boolean");
    }
  });

  it("returns invalid-request errors for missing required identifiers", async () => {
    const adapter = new InMemoryWorkspaceAdministrationQueryAdapter();
    seedWorkspaceAdministrationReadModel(adapter);

    const service = new WorkspaceAdministrationQueryService({
      workspaceRepository: adapter,
      membershipRepository: adapter,
      roleAssignmentRepository: adapter,
      invitationRepository: adapter,
      authorizationReadRepository: adapter,
      clock: new FixedWorkspaceAdministrationQueryClock("2026-04-05T12:00:00.000Z"),
    });

    const result = await service.listWorkspaces({
      actorUserIdentityId: "   ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(WorkspaceAdministrationQueryErrorCodes.invalidRequest);
    }
  });
});

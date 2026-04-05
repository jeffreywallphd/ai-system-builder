import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
} from "../../../../domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "../../../../shared/workspaces/WorkspaceOwnership";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteWorkspacePersistenceAdapter } from "../SqliteWorkspacePersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteWorkspacePersistenceAdapter", () => {
  it("applies workspace migrations safely and creates workspace persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-workspace-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "workspace.sqlite");

    const adapter = new SqliteWorkspacePersistenceAdapter(databasePath);
    await adapter.saveWorkspace(createWorkspace({
      id: "workspace:alpha",
      slug: "team-alpha",
      displayName: "Team Alpha",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      status: WorkspaceStatuses.active,
    }));
    adapter.dispose();

    const reopened = new SqliteWorkspacePersistenceAdapter(databasePath);
    await reopened.findWorkspaceById("workspace:alpha");
    reopened.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM workspace_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'workspace_records',
          'workspace_memberships',
          'workspace_role_assignments',
          'workspace_invitations'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "workspace_invitations",
      "workspace_memberships",
      "workspace_records",
      "workspace_role_assignments",
    ]);

    database.close();
  });

  it("supports workspace lifecycle persistence and authorization reads", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-workspace-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteWorkspacePersistenceAdapter(path.join(root, "workspace.sqlite"));

    const workspace = await adapter.saveWorkspace(createWorkspace({
      id: "workspace:alpha",
      slug: "team-alpha",
      displayName: "Team Alpha",
      description: "Alpha workspace",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      visibility: WorkspaceVisibilities.team,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    const invitation = await adapter.saveInvitation(createWorkspaceInvitation({
      id: "invite:alpha-member",
      workspaceId: workspace.id,
      invitedEmail: "member@example.com",
      invitedByUserId: "user:owner",
      invitedRoles: [WorkspaceRoles.member],
      status: WorkspaceInvitationStatuses.pending,
      createdAt: "2026-04-05T12:00:00.000Z",
      expiresAt: "2026-04-06T12:00:00.000Z",
      lastModifiedBy: "user:owner",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
    }));

    const membership = await adapter.saveMembership(createWorkspaceMembership({
      id: "membership:alpha-owner",
      workspaceId: workspace.id,
      userIdentityId: "user:owner",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    const ownerAssignment = await adapter.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: "role:alpha-owner",
      workspaceId: workspace.id,
      userIdentityId: membership.userIdentityId,
      role: WorkspaceRoles.owner,
      status: WorkspaceRoleAssignmentStatuses.active,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T12:00:00.000Z",
    }));

    const listedWorkspaces = await adapter.listWorkspaces({
      ownerUserId: "user:owner",
      memberUserIdentityId: "user:owner",
      statuses: [WorkspaceStatuses.active],
      visibility: WorkspaceVisibilities.team,
    });
    const listedMemberships = await adapter.listMemberships({
      workspaceId: workspace.id,
      statuses: [WorkspaceMembershipStatuses.active],
    });
    const listedInvitations = await adapter.listInvitations({
      workspaceId: workspace.id,
      activeOnly: true,
      statuses: [WorkspaceInvitationStatuses.pending],
    });
    const listedRoleAssignments = await adapter.listRoleAssignments({
      workspaceId: workspace.id,
      statuses: [WorkspaceRoleAssignmentStatuses.active],
      roles: [WorkspaceRoles.owner],
    });

    expect((await adapter.findWorkspaceBySlug("TEAM-ALPHA"))?.id).toBe(workspace.id);
    expect((await adapter.findInvitationById(invitation.id))?.id).toBe(invitation.id);
    expect((await adapter.findMembershipByWorkspaceAndUser(workspace.id, membership.userIdentityId))?.id).toBe(membership.id);
    expect((await adapter.findRoleAssignmentById(ownerAssignment.id))?.id).toBe(ownerAssignment.id);

    expect(listedWorkspaces).toHaveLength(1);
    expect(listedMemberships).toHaveLength(1);
    expect(listedInvitations).toHaveLength(1);
    expect(listedRoleAssignments).toHaveLength(1);
    expect(await adapter.countActiveRoleAssignments(workspace.id, WorkspaceRoles.owner)).toBe(1);

    const pendingInvitation = await adapter.findPendingInvitationByEmail({
      workspaceId: workspace.id,
      invitedEmail: "MEMBER@EXAMPLE.COM",
      asOf: "2026-04-05T13:00:00.000Z",
    });
    expect(pendingInvitation?.id).toBe(invitation.id);

    const snapshot = await adapter.getWorkspaceAuthorizationSnapshot({
      workspaceId: workspace.id,
      userIdentityId: membership.userIdentityId,
      asOf: "2026-04-05T13:00:00.000Z",
    });
    expect(snapshot?.workspace.id).toBe(workspace.id);
    expect(snapshot?.isWorkspaceOwner).toBe(true);
    expect(snapshot?.effectiveRoles).toEqual([WorkspaceRoles.owner]);

    adapter.dispose();
  });

  it("enforces uniqueness and ownership integrity constraints", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-workspace-constraints-"));
    createdRoots.push(root);
    const adapter = new SqliteWorkspacePersistenceAdapter(path.join(root, "workspace.sqlite"));

    await adapter.saveWorkspace(createWorkspace({
      id: "workspace:alpha",
      slug: "team-alpha",
      displayName: "Team Alpha",
      ownerUserId: "user:owner",
      createdBy: "user:owner",
      status: WorkspaceStatuses.active,
      visibility: WorkspaceVisibilities.private,
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    await adapter.saveMembership(createWorkspaceMembership({
      id: "membership:alpha-owner",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:owner",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    await adapter.saveMembership(createWorkspaceMembership({
      id: "membership:alpha-admin",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:admin",
      status: WorkspaceMembershipStatuses.active,
      joinedAt: "2026-04-05T12:00:00.000Z",
      createdBy: "user:owner",
      now: new Date("2026-04-05T12:00:00.000Z"),
    }));

    await adapter.saveInvitation(createWorkspaceInvitation({
      id: "invite:alpha-member",
      workspaceId: "workspace:alpha",
      invitedEmail: "member@example.com",
      invitedByUserId: "user:owner",
      invitedRoles: [WorkspaceRoles.member],
      status: WorkspaceInvitationStatuses.pending,
      createdAt: "2026-04-05T12:00:00.000Z",
      expiresAt: "2026-04-06T12:00:00.000Z",
      lastModifiedBy: "user:owner",
      lastModifiedAt: "2026-04-05T12:00:00.000Z",
    }));

    await adapter.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: "role:alpha-owner",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:owner",
      role: WorkspaceRoles.owner,
      status: WorkspaceRoleAssignmentStatuses.active,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T12:00:00.000Z",
    }));

    await expect(adapter.saveInvitation(createWorkspaceInvitation({
      id: "invite:alpha-member-2",
      workspaceId: "workspace:alpha",
      invitedEmail: "MEMBER@EXAMPLE.COM",
      invitedByUserId: "user:owner",
      invitedRoles: [WorkspaceRoles.viewer],
      status: WorkspaceInvitationStatuses.pending,
      createdAt: "2026-04-05T13:00:00.000Z",
      expiresAt: "2026-04-06T13:00:00.000Z",
      lastModifiedBy: "user:owner",
      lastModifiedAt: "2026-04-05T13:00:00.000Z",
    }))).rejects.toThrow();

    await expect(adapter.saveRoleAssignment(createWorkspaceRoleAssignment({
      id: "role:alpha-owner-2",
      workspaceId: "workspace:alpha",
      userIdentityId: "user:admin",
      role: WorkspaceRoles.owner,
      status: WorkspaceRoleAssignmentStatuses.active,
      assignedBy: "user:owner",
      assignedAt: "2026-04-05T13:00:00.000Z",
    }))).rejects.toThrow();

    adapter.dispose();
  });
});
import { describe, expect, it } from "bun:test";
import {
  WorkspaceDomainError,
  WorkspaceInvitationLifecycleTransitionError,
  WorkspaceInvitationStatuses,
  WorkspaceLifecycleTransitionError,
  WorkspaceMembershipLifecycleTransitionError,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  acceptWorkspaceInvitation,
  assertWorkspaceRoleAssignmentSetInvariants,
  createWorkspace,
  createWorkspaceInvitation,
  createWorkspaceMembership,
  createWorkspaceRoleAssignment,
  declineWorkspaceInvitation,
  expireWorkspaceInvitation,
  revokeWorkspaceRoleAssignment,
  transferWorkspaceOwnership,
  transitionWorkspaceMembershipStatus,
  transitionWorkspaceStatus,
  updateWorkspaceDetails,
} from "../WorkspaceDomain";
import {
  WorkspaceOwnershipError,
  WorkspaceVisibilities,
  createWorkspaceOwnershipMetadata,
} from "../../../shared/workspaces/WorkspaceOwnership";

describe("WorkspaceOwnership", () => {
  it("enforces owner-aligned creation metadata", () => {
    expect(() => createWorkspaceOwnershipMetadata({
      workspaceId: "workspace-1",
      ownerUserId: "user-owner",
      createdBy: "user-admin",
    })).toThrow(WorkspaceOwnershipError);
  });
});

describe("WorkspaceDomain", () => {
  it("creates a workspace with normalized ownership metadata", () => {
    const workspace = createWorkspace({
      id: "workspace-1",
      slug: "team-alpha",
      displayName: "Team Alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      visibility: WorkspaceVisibilities.private,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(workspace.slug).toBe("team-alpha");
    expect(workspace.ownership.workspaceId).toBe("workspace-1");
    expect(workspace.ownership.createdBy).toBe("user-owner");
    expect(workspace.ownership.lastModifiedBy).toBe("user-owner");
  });

  it("enforces workspace lifecycle transitions and archived visibility invariants", () => {
    const workspace = createWorkspace({
      id: "workspace-2",
      slug: "studio-admin",
      displayName: "Studio Admin",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      visibility: WorkspaceVisibilities.team,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    const suspended = transitionWorkspaceStatus(
      workspace,
      WorkspaceStatuses.suspended,
      "user-owner",
      new Date("2026-04-05T12:05:00.000Z"),
    );
    const archived = transitionWorkspaceStatus(
      suspended,
      WorkspaceStatuses.archived,
      "user-owner",
      new Date("2026-04-05T12:10:00.000Z"),
    );
    const reactivated = transitionWorkspaceStatus(
      archived,
      WorkspaceStatuses.active,
      "user-owner",
      new Date("2026-04-05T12:12:00.000Z"),
    );

    expect(archived.status).toBe(WorkspaceStatuses.archived);
    expect(reactivated.status).toBe(WorkspaceStatuses.active);
    expect(() => transitionWorkspaceStatus(
      archived,
      WorkspaceStatuses.suspended,
      "user-owner",
      new Date("2026-04-05T12:13:00.000Z"),
    )).toThrow(WorkspaceLifecycleTransitionError);
    expect(() => updateWorkspaceDetails(archived, {
      visibility: WorkspaceVisibilities.public,
      actorUserId: "user-owner",
      now: new Date("2026-04-05T12:11:00.000Z"),
    })).toThrow("Archived workspaces cannot remain public");
  });

  it("requires current owner to transfer workspace ownership", () => {
    const workspace = createWorkspace({
      id: "workspace-3",
      slug: "ops-team",
      displayName: "Ops Team",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
    });

    expect(() => transferWorkspaceOwnership(workspace, {
      newOwnerUserId: "user-next-owner",
      actorUserId: "user-admin",
    })).toThrow("Only current workspace owner");

    const transferred = transferWorkspaceOwnership(workspace, {
      newOwnerUserId: "user-next-owner",
      actorUserId: "user-owner",
      now: new Date("2026-04-05T13:00:00.000Z"),
    });
    expect(transferred.ownership.ownerUserId).toBe("user-next-owner");
    expect(transferred.ownership.lastModifiedBy).toBe("user-owner");
  });

  it("enforces workspace membership lifecycle invariants", () => {
    const membership = createWorkspaceMembership({
      id: "membership-1",
      workspaceId: "workspace-1",
      userIdentityId: "user-1",
      createdBy: "user-owner",
    });

    const activated = transitionWorkspaceMembershipStatus(membership, {
      status: WorkspaceMembershipStatuses.active,
      actorUserId: "user-owner",
      now: new Date("2026-04-05T14:00:00.000Z"),
    });
    expect(activated.joinedAt).toBe("2026-04-05T14:00:00.000Z");

    const removed = transitionWorkspaceMembershipStatus(activated, {
      status: WorkspaceMembershipStatuses.removed,
      actorUserId: "user-owner",
      now: new Date("2026-04-05T14:10:00.000Z"),
    });
    expect(removed.removedByUserId).toBe("user-owner");

    expect(() => transitionWorkspaceMembershipStatus(removed, {
      status: WorkspaceMembershipStatuses.active,
      actorUserId: "user-owner",
    })).toThrow(WorkspaceMembershipLifecycleTransitionError);
  });

  it("guards workspace role assignments with single-owner invariants", () => {
    const ownerAssignment = createWorkspaceRoleAssignment({
      id: "role-owner",
      workspaceId: "workspace-1",
      userIdentityId: "user-owner",
      role: WorkspaceRoles.owner,
      assignedBy: "user-owner",
    });
    const adminAssignment = createWorkspaceRoleAssignment({
      id: "role-admin",
      workspaceId: "workspace-1",
      userIdentityId: "user-admin",
      role: WorkspaceRoles.admin,
      assignedBy: "user-owner",
    });

    assertWorkspaceRoleAssignmentSetInvariants([ownerAssignment, adminAssignment]);
    expect(() => revokeWorkspaceRoleAssignment(ownerAssignment, {
      revokedBy: "user-owner",
      activeOwnerAssignmentCount: 1,
    })).toThrow("retain at least one active owner");

    const revokedAdmin = revokeWorkspaceRoleAssignment(adminAssignment, {
      revokedBy: "user-owner",
      activeOwnerAssignmentCount: 1,
      now: new Date("2026-04-05T15:00:00.000Z"),
    });
    expect(revokedAdmin.status).toBe(WorkspaceRoleAssignmentStatuses.revoked);

    expect(() => assertWorkspaceRoleAssignmentSetInvariants([
      ownerAssignment,
      createWorkspaceRoleAssignment({
        id: "role-owner-2",
        workspaceId: "workspace-1",
        userIdentityId: "user-owner-2",
        role: WorkspaceRoles.owner,
        assignedBy: "user-owner",
      }),
    ])).toThrow(WorkspaceDomainError);
  });

  it("enforces invitation role and lifecycle invariants", () => {
    expect(() => createWorkspaceInvitation({
      id: "invite-owner-role",
      workspaceId: "workspace-1",
      invitedEmail: "owner@example.com",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.owner],
      expiresAt: "2026-04-05T18:00:00.000Z",
    })).toThrow("cannot assign owner role");

    const invitation = createWorkspaceInvitation({
      id: "invite-1",
      workspaceId: "workspace-1",
      invitedEmail: " Member@Example.com ",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.member, WorkspaceRoles.member],
      invitationTokenHash: "1336d5d4f04047f8f9477f073b90f18f636991d2f1492f4fbe95f5cb98f40e29",
      invitationTokenHint: "token301",
      targetUserIdentityIdHint: "user-member",
      onboardingMetadata: {
        source: "domain-test",
      },
      createdAt: "2026-04-05T16:00:00.000Z",
      expiresAt: "2026-04-05T17:00:00.000Z",
    });
    expect(invitation.invitedEmail).toBe("member@example.com");
    expect(invitation.invitedRoles).toEqual([WorkspaceRoles.member]);
    expect(invitation.invitationTokenHint).toBe("token301");
    expect(invitation.targetUserIdentityIdHint).toBe("user-member");
    expect(invitation.onboardingMetadata?.source).toBe("domain-test");

    const accepted = acceptWorkspaceInvitation(invitation, {
      acceptedByUserIdentityId: "user-member",
      now: new Date("2026-04-05T16:10:00.000Z"),
    });
    expect(accepted.status).toBe(WorkspaceInvitationStatuses.accepted);
    expect(() => declineWorkspaceInvitation(accepted, {
      actorUserId: "user-member",
    })).toThrow(WorkspaceInvitationLifecycleTransitionError);

    const expiring = createWorkspaceInvitation({
      id: "invite-2",
      workspaceId: "workspace-1",
      invitedEmail: "viewer@example.com",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.viewer],
      createdAt: "2026-04-05T16:00:00.000Z",
      expiresAt: "2026-04-05T16:30:00.000Z",
    });

    expect(() => acceptWorkspaceInvitation(expiring, {
      acceptedByUserIdentityId: "user-viewer",
      now: new Date("2026-04-05T16:31:00.000Z"),
    })).toThrow("Expired invitations cannot be accepted");

    const expired = expireWorkspaceInvitation(expiring, new Date("2026-04-05T16:31:00.000Z"));
    expect(expired.status).toBe(WorkspaceInvitationStatuses.expired);

    expect(() => createWorkspaceInvitation({
      id: "invite-invalid-hash",
      workspaceId: "workspace-1",
      invitedEmail: "bad@example.com",
      invitedByUserId: "user-owner",
      invitedRoles: [WorkspaceRoles.member],
      invitationTokenHash: "not-a-hash",
      expiresAt: "2026-04-06T16:30:00.000Z",
    })).toThrow("invitationTokenHash");
  });
});

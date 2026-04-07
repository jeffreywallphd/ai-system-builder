import { describe, expect, it } from "bun:test";
import {
  WorkspaceInvitationStatuses,
  WorkspaceMembershipStatuses,
  WorkspaceRoleAssignmentStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
} from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import {
  mapWorkspaceInvitationRowToDomain,
  mapWorkspaceMembershipRowToDomain,
  mapWorkspaceRoleAssignmentRowToDomain,
  mapWorkspaceRowToDomain,
  normalizeEmailLookup,
  normalizeSlugLookup,
  type WorkspaceInvitationRow,
  type WorkspaceMembershipRow,
  type WorkspaceRoleAssignmentRow,
  type WorkspaceRow,
} from "../WorkspacePersistenceMapper";

describe("WorkspacePersistenceMapper", () => {
  it("maps workspace row to workspace domain model", () => {
    const row: WorkspaceRow = {
      workspace_id: "workspace:alpha",
      slug: "team-alpha",
      display_name: "Team Alpha",
      description: "Primary workspace",
      status: WorkspaceStatuses.active,
      owner_user_id: "user:owner",
      visibility: WorkspaceVisibilities.team,
      encryption_mode: "platform-managed",
      content_encryption_required: 1,
      key_scope: "workspace",
      allow_preview_decryption: 0,
      allow_worker_decryption: 0,
      created_by: "user:owner",
      last_modified_by: "user:owner",
      created_at: "2026-04-05T12:00:00.000Z",
      last_modified_at: "2026-04-05T12:00:00.000Z",
    };

    const mapped = mapWorkspaceRowToDomain(row);
    expect(mapped.id).toBe("workspace:alpha");
    expect(mapped.slug).toBe("team-alpha");
    expect(mapped.status).toBe(WorkspaceStatuses.active);
    expect(mapped.ownership.visibility).toBe(WorkspaceVisibilities.team);
    expect(mapped.encryptionPolicy.encryptionMode).toBe("platform-managed");
    expect(mapped.encryptionPolicy.contentEncryptionRequired).toBe(true);
  });

  it("maps membership and role assignment rows to domain contracts", () => {
    const membershipRow: WorkspaceMembershipRow = {
      membership_id: "membership:alpha-owner",
      workspace_id: "workspace:alpha",
      user_identity_id: "user:owner",
      status: WorkspaceMembershipStatuses.active,
      invited_by_user_id: null,
      invitation_id: null,
      joined_at: "2026-04-05T12:00:00.000Z",
      suspended_at: null,
      removed_at: null,
      removed_by_user_id: null,
      created_at: "2026-04-05T12:00:00.000Z",
      updated_at: "2026-04-05T12:00:00.000Z",
      created_by: "user:owner",
      last_modified_by: "user:owner",
    };

    const roleRow: WorkspaceRoleAssignmentRow = {
      role_assignment_id: "role:alpha-owner",
      workspace_id: "workspace:alpha",
      user_identity_id: "user:owner",
      role: WorkspaceRoles.owner,
      status: WorkspaceRoleAssignmentStatuses.active,
      assigned_at: "2026-04-05T12:00:00.000Z",
      assigned_by: "user:owner",
      revoked_at: null,
      revoked_by: null,
    };

    const mappedMembership = mapWorkspaceMembershipRowToDomain(membershipRow);
    const mappedRole = mapWorkspaceRoleAssignmentRowToDomain(roleRow);

    expect(mappedMembership.status).toBe(WorkspaceMembershipStatuses.active);
    expect(mappedMembership.joinedAt).toBe("2026-04-05T12:00:00.000Z");
    expect(mappedRole.role).toBe(WorkspaceRoles.owner);
    expect(mappedRole.status).toBe(WorkspaceRoleAssignmentStatuses.active);
  });

  it("maps invitation rows and normalizes lookup helpers", () => {
    const row: WorkspaceInvitationRow = {
      invitation_id: "invite:alpha-member",
      workspace_id: "workspace:alpha",
      invited_email: "member@example.com",
      invited_by_user_id: "user:owner",
      invited_roles_json: "[\"member\",\"viewer\",\"member\"]",
      invitation_token_hash: "a99e84df4126ed9f2f0968fcb8fa7f9d68ac36f0536ef66d67f5cb1586f2fd1d",
      invitation_token_hint: "abcd1234",
      target_user_identity_id_hint: "user:member",
      onboarding_metadata_json: "{\"source\":\"admin-console\"}",
      status: WorkspaceInvitationStatuses.pending,
      created_at: "2026-04-05T12:00:00.000Z",
      expires_at: "2026-04-06T12:00:00.000Z",
      responded_at: null,
      accepted_by_user_identity_id: null,
      last_modified_by: "user:owner",
      last_modified_at: "2026-04-05T12:00:00.000Z",
    };

    const mapped = mapWorkspaceInvitationRowToDomain(row);
    expect(mapped.invitedRoles).toEqual([WorkspaceRoles.member, WorkspaceRoles.viewer]);
    expect(mapped.invitationTokenHint).toBe("abcd1234");
    expect(mapped.targetUserIdentityIdHint).toBe("user:member");
    expect(mapped.onboardingMetadata?.source).toBe("admin-console");
    expect(normalizeSlugLookup(" Team-Alpha ")).toBe("team-alpha");
    expect(normalizeEmailLookup(" MEMBER@EXAMPLE.COM ")).toBe("member@example.com");
  });
});


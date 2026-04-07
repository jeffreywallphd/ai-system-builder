import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkspaceListPanel,
  WorkspaceMembershipAdministrationPanel,
  WorkspaceOperationalContextPanel,
} from "../WorkspaceAdministrationPanels";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceMembershipApiRecord,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";

const workspaceRecord: WorkspaceAdminListItemApiRecord = Object.freeze({
  workspaceId: "workspace-alpha",
  slug: "alpha",
  displayName: "Alpha Workspace",
  description: "Primary workspace",
  status: "active",
  ownerUserIdentityId: "user-owner-1",
  visibility: "team",
  createdAt: "2026-04-01T12:00:00.000Z",
  lastModifiedAt: "2026-04-02T12:00:00.000Z",
  membershipSummary: Object.freeze({ pending: 1, active: 3, suspended: 0, removed: 0, total: 4 }),
  roleSummary: Object.freeze({ owner: 1, admin: 1, member: 2, viewer: 0, activeAssignments: 4, revokedAssignments: 0, totalAssignments: 4 }),
  invitationSummary: Object.freeze({ pending: 2, accepted: 1, declined: 0, revoked: 0, expired: 0, activePending: 2, total: 3 }),
  actorAccess: Object.freeze({
    membershipStatus: "active",
    effectiveRoles: Object.freeze(["member"]),
    canAdministrate: true,
    isWorkspaceOwner: false,
    capabilities: Object.freeze({
      canManageWorkspaceSettings: false,
      canManageMembers: true,
      canManageInvitations: false,
      canManageRoles: true,
    }),
  }),
});

const membershipRecord: WorkspaceMembershipApiRecord = Object.freeze({
  membershipId: "membership-1",
  workspaceId: "workspace-alpha",
  userIdentityId: "user-1",
  status: "active",
  joinedAt: "2026-04-01T12:00:00.000Z",
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-02T12:00:00.000Z",
  createdByUserIdentityId: "user-owner-1",
  lastModifiedByUserIdentityId: "user-owner-1",
  activeRoles: Object.freeze(["member"]),
  hasAdministrativeRole: false,
  isWorkspaceOwner: false,
});

describe("WorkspaceAdministrationPanels", () => {
  it("renders workspace list rows for desktop administration", () => {
    const html = renderToStaticMarkup(
      <WorkspaceListPanel
        surface="desktop"
        workspaces={Object.freeze([workspaceRecord])}
        selectedWorkspaceId={workspaceRecord.workspaceId}
        isLoading={false}
        onSelectWorkspace={() => undefined}
      />,
    );

    expect(html).toContain("Alpha Workspace");
    expect(html).toContain("Members");
    expect(html).toContain("ui-table");
  });

  it("renders explicit partial visibility messaging for limited administrative capabilities", () => {
    const html = renderToStaticMarkup(
      <WorkspaceOperationalContextPanel
        workspace={workspaceRecord}
        capabilities={Object.freeze({
          canAdministrate: true,
          canManageWorkspaceSettings: false,
          canManageMembers: true,
          canManageInvitations: false,
          canManageRoles: true,
        })}
      />,
    );

    expect(html).toContain("Partial visibility");
    expect(html).toContain("workspace settings");
    expect(html).toContain("invitation issuance");
  });

  it("renders permission-denied state for workspace context when actor cannot administrate", () => {
    const html = renderToStaticMarkup(
      <WorkspaceOperationalContextPanel
        workspace={workspaceRecord}
        capabilities={Object.freeze({
          canAdministrate: false,
          canManageWorkspaceSettings: false,
          canManageMembers: false,
          canManageInvitations: false,
          canManageRoles: false,
        })}
      />,
    );

    expect(html).toContain("Workspace administration restricted");
    expect(html).toContain("membership and role management require owner/admin privileges");
  });

  it("renders thin-client membership administration actions and role assignment controls", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMembershipAdministrationPanel
        surface="thin-client"
        selectedWorkspaceId="workspace-alpha"
        memberships={Object.freeze([membershipRecord])}
        capabilities={Object.freeze({
          canAdministrate: true,
          canManageWorkspaceSettings: true,
          canManageMembers: true,
          canManageInvitations: true,
          canManageRoles: true,
        })}
        isMutating={false}
        onClientValidationError={() => undefined}
        onAddMember={async () => undefined}
        onSaveMembershipStatus={async () => undefined}
        onRemoveMember={async () => undefined}
        onAssignRole={async () => undefined}
        onRevokeRole={async () => undefined}
      />,
    );

    expect(html).toContain("Role assignments");
    expect(html).toContain("Add member");
    expect(html).toContain("Save status");
    expect(html).toContain("Grant admin");
  });
});

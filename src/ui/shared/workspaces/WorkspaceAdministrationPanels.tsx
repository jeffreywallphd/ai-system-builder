import { useEffect, useMemo, useState } from "react";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceMembershipApiRecord,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import type { WorkspaceAdministrationCapabilityViewModel } from "@ui/presenters/WorkspaceAdministrationCapabilitiesPresenter";
import {
  SurfaceActionButtonStrip,
  SurfaceActionList,
  SurfaceActionMenu,
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
} from "@ui/shared/actions";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { SurfaceResponsiveStatusCardGroup, SurfaceResponsiveTableContainer } from "@ui/shared/components/shell/SurfaceResponsiveConventions";
import { useSurfaceResponsiveProfile } from "@ui/shared/responsive";

export const workspaceAssignableRoleOptions = Object.freeze(["admin", "member", "viewer"] as const);
export const workspaceMembershipStatusOptions = Object.freeze(["pending", "active", "suspended", "removed"] as const);

export type WorkspaceAssignableRole = (typeof workspaceAssignableRoleOptions)[number];
export type WorkspaceMembershipStatus = (typeof workspaceMembershipStatusOptions)[number];
export type WorkspaceAdministrationSurface = "desktop" | "thin-client";

const WorkspacePermissionIds = Object.freeze({
  manageMembers: "workspace.members.manage",
  manageRoles: "workspace.roles.manage",
});

interface WorkspaceListPanelProps {
  readonly surface: WorkspaceAdministrationSurface;
  readonly workspaces: ReadonlyArray<WorkspaceAdminListItemApiRecord>;
  readonly selectedWorkspaceId?: string;
  readonly isLoading: boolean;
  readonly onSelectWorkspace: (workspaceId: string) => void;
}

export function WorkspaceListPanel({
  surface,
  workspaces,
  selectedWorkspaceId,
  isLoading,
  onSelectWorkspace,
}: WorkspaceListPanelProps): JSX.Element {
  if (surface === "thin-client") {
    return (
      <label className="ui-field">
        <span className="ui-field__label">Selected workspace</span>
        <select
          className="ui-select"
          value={selectedWorkspaceId}
          onChange={(event) => onSelectWorkspace(event.target.value)}
        >
          {workspaces.length < 1 ? <option value="">No workspaces available</option> : null}
          {workspaces.map((workspace) => (
            <option key={workspace.workspaceId} value={workspace.workspaceId}>
              {workspace.displayName} ({workspace.slug})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <>
      {workspaces.length < 1 ? <p className="ui-text-secondary">{isLoading ? "Loading workspaces..." : "No workspaces found."}</p> : null}
      {workspaces.length > 0 ? (
        <SurfaceResponsiveTableContainer>
          <div className="ui-table-wrapper">
            <table className="ui-table ui-responsive-table__table">
              <thead>
                <tr>
                  <th scope="col">Workspace</th>
                  <th scope="col">Status</th>
                  <th scope="col">Members</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr
                    key={workspace.workspaceId}
                    className={workspace.workspaceId === selectedWorkspaceId ? "ui-workspace-admin-page__table-row--selected" : undefined}
                  >
                    <td data-label="Workspace">
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm ui-workspace-admin-page__select-button"
                        onClick={() => onSelectWorkspace(workspace.workspaceId)}
                      >
                        {workspace.displayName}
                      </button>
                      <div className="ui-text-secondary ui-text-small">{workspace.slug}</div>
                    </td>
                    <td data-label="Status">{workspace.status}</td>
                    <td data-label="Members">{workspace.membershipSummary.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceResponsiveTableContainer>
      ) : null}
    </>
  );
}

interface WorkspaceOperationalContextPanelProps {
  readonly workspace?: WorkspaceAdminListItemApiRecord;
  readonly capabilities: WorkspaceAdministrationCapabilityViewModel;
}

export function WorkspaceOperationalContextPanel({
  workspace,
  capabilities,
}: WorkspaceOperationalContextPanelProps): JSX.Element {
  if (!workspace) {
    return <p className="ui-text-secondary">Select a workspace to view workspace-scoped operational context.</p>;
  }

  const limitedCapabilities = toLimitedCapabilities(capabilities);
  const hasPartialVisibility = capabilities.canAdministrate && limitedCapabilities.length > 0;

  return (
    <div className="ui-stack ui-stack--sm">
      {!capabilities.canAdministrate ? (
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Workspace administration restricted",
            message: "This workspace is visible, but membership and role management require owner/admin privileges.",
          })}
        />
      ) : null}
      {hasPartialVisibility ? (
        <p className="ui-workspace-admin-shared__partial-visibility" role="status">
          Partial visibility: you can administer this workspace, but these operations are limited: {limitedCapabilities.join(", ")}.
        </p>
      ) : null}
      <div className="ui-workspace-admin-shared__detail-grid">
        <div>
          <strong>Workspace</strong>
          <div className="ui-text-secondary">{workspace.displayName}</div>
          <div className="ui-text-secondary ui-text-small">{workspace.slug}</div>
        </div>
        <div>
          <strong>Lifecycle</strong>
          <div className="ui-text-secondary">{workspace.status}</div>
        </div>
        <div>
          <strong>Visibility</strong>
          <div className="ui-text-secondary">{workspace.visibility}</div>
        </div>
        <div>
          <strong>Owner</strong>
          <div className="ui-text-secondary">{workspace.ownerUserIdentityId}</div>
        </div>
        <div>
          <strong>Your membership</strong>
          <div className="ui-text-secondary">{workspace.actorAccess.membershipStatus ?? "none"}</div>
        </div>
        <div>
          <strong>Your effective roles</strong>
          <div className="ui-text-secondary">{workspace.actorAccess.effectiveRoles.join(", ") || "none"}</div>
        </div>
      </div>
      <SurfaceResponsiveStatusCardGroup className="ui-workspace-admin-shared__summary-grid">
        <div className="ui-card ui-workspace-admin-shared__summary-card">
          <strong>{workspace.membershipSummary.total}</strong>
          <span>members</span>
        </div>
        <div className="ui-card ui-workspace-admin-shared__summary-card">
          <strong>{workspace.roleSummary.activeAssignments}</strong>
          <span>active roles</span>
        </div>
        <div className="ui-card ui-workspace-admin-shared__summary-card">
          <strong>{workspace.invitationSummary.pending}</strong>
          <span>pending invites</span>
        </div>
      </SurfaceResponsiveStatusCardGroup>
    </div>
  );
}

interface WorkspaceMembershipAdministrationPanelProps {
  readonly surface: WorkspaceAdministrationSurface;
  readonly selectedWorkspaceId?: string;
  readonly memberships: ReadonlyArray<WorkspaceMembershipApiRecord>;
  readonly capabilities: WorkspaceAdministrationCapabilityViewModel;
  readonly isMutating: boolean;
  readonly onClientValidationError: (message: string) => void;
  readonly onAddMember: (
    input: {
      readonly targetUserIdentityId: string;
      readonly roles: ReadonlyArray<WorkspaceAssignableRole>;
    },
  ) => Promise<void>;
  readonly onSaveMembershipStatus: (
    input: {
      readonly targetUserIdentityId: string;
      readonly status: WorkspaceMembershipStatus;
    },
  ) => Promise<void>;
  readonly onRemoveMember: (targetUserIdentityId: string) => Promise<void>;
  readonly onAssignRole: (
    input: {
      readonly targetUserIdentityId: string;
      readonly role: WorkspaceAssignableRole;
    },
  ) => Promise<void>;
  readonly onRevokeRole: (
    input: {
      readonly targetUserIdentityId: string;
      readonly role: WorkspaceAssignableRole;
    },
  ) => Promise<void>;
}

export function WorkspaceMembershipAdministrationPanel({
  surface,
  selectedWorkspaceId,
  memberships,
  capabilities,
  isMutating,
  onClientValidationError,
  onAddMember,
  onSaveMembershipStatus,
  onRemoveMember,
  onAssignRole,
  onRevokeRole,
}: WorkspaceMembershipAdministrationPanelProps): JSX.Element {
  const responsiveProfile = useSurfaceResponsiveProfile();
  const [membershipDrafts, setMembershipDrafts] = useState<Readonly<Record<string, WorkspaceMembershipStatus>>>(Object.freeze({}));
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRolesCsv, setNewMemberRolesCsv] = useState("member");
  const [roleTargetUserId, setRoleTargetUserId] = useState("");
  const [roleValue, setRoleValue] = useState<WorkspaceAssignableRole>("member");

  useEffect(() => {
    setMembershipDrafts(
      Object.freeze(
        memberships.reduce<Record<string, WorkspaceMembershipStatus>>((drafts, membership) => {
          drafts[membership.userIdentityId] = membership.status;
          return drafts;
        }, {}),
      ),
    );
  }, [memberships]);

  const actorPermissionIds = useMemo(
    () => toActorPermissionIds(capabilities),
    [capabilities],
  );

  const addMemberActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([{
      id: "workspace-members-add",
      label: isMutating ? "Saving..." : "Add member",
      scope: "page",
      tone: "primary",
      requiredPermissions: Object.freeze([WorkspacePermissionIds.manageMembers]),
      availability: () => {
        if (isMutating) {
          return Object.freeze({ disabled: true, disabledReason: "A membership operation is already running." });
        }
        if (!selectedWorkspaceId) {
          return Object.freeze({ disabled: true, disabledReason: "Select a workspace before adding members." });
        }
        return Object.freeze({});
      },
      onInvoke: async () => {
        const targetUserIdentityId = newMemberUserId.trim();
        if (!targetUserIdentityId) {
          onClientValidationError("Target user identity id is required.");
          return;
        }
        const parsedRoles = parseWorkspaceRoleCsv(newMemberRolesCsv);
        if (!parsedRoles.ok) {
          onClientValidationError(parsedRoles.message);
          return;
        }
        await onAddMember({
          targetUserIdentityId,
          roles: parsedRoles.roles,
        });
      },
    } satisfies SurfaceActionDescriptor]),
    [isMutating, newMemberRolesCsv, newMemberUserId, onAddMember, onClientValidationError, selectedWorkspaceId],
  );

  const roleActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: "workspace-roles-assign",
        label: "Assign role",
        scope: "bulk",
        tone: "secondary",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageRoles]),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A role operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before assigning roles." });
          }
          if (!roleTargetUserId.trim()) {
            return Object.freeze({ disabled: true, disabledReason: "Enter a target user identity id." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onAssignRole({
            targetUserIdentityId: roleTargetUserId.trim(),
            role: roleValue,
          });
        },
      } satisfies SurfaceActionDescriptor,
      {
        id: "workspace-roles-revoke",
        label: "Revoke role",
        scope: "bulk",
        tone: "danger",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageRoles]),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A role operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before revoking roles." });
          }
          if (!roleTargetUserId.trim()) {
            return Object.freeze({ disabled: true, disabledReason: "Enter a target user identity id." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onRevokeRole({
            targetUserIdentityId: roleTargetUserId.trim(),
            role: roleValue,
          });
        },
      } satisfies SurfaceActionDescriptor,
    ]),
    [isMutating, onAssignRole, onRevokeRole, roleTargetUserId, roleValue, selectedWorkspaceId],
  );

  const roleActionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      meta: Object.freeze({ selectedWorkspaceId, isMutating }),
    }),
    [actorPermissionIds, isMutating, selectedWorkspaceId, surface],
  );

  return (
    <div className="ui-stack ui-stack--sm">
      <div className="ui-workspace-admin-page__field-grid">
        <label className="ui-field">
          <span className="ui-field__label">User identity ID</span>
          <input
            className="ui-input"
            value={newMemberUserId}
            onChange={(event) => setNewMemberUserId(event.target.value)}
            disabled={isMutating}
          />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Roles (CSV)</span>
          <input
            className="ui-input"
            value={newMemberRolesCsv}
            onChange={(event) => setNewMemberRolesCsv(event.target.value)}
            disabled={isMutating}
          />
        </label>
      </div>
      <SurfaceActionButtonStrip
        actions={addMemberActions}
        context={roleActionContext}
        scope="page"
      />

      {memberships.length < 1 ? <p className="ui-text-secondary">No memberships to review.</p> : null}
      {memberships.length > 0 ? (
        surface === "desktop"
          ? (
            <SurfaceResponsiveTableContainer>
              <div className="ui-table-wrapper">
                <table className="ui-table ui-responsive-table__table">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Status</th>
                      <th scope="col">Roles</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((membership) => (
                      <tr key={membership.membershipId}>
                        <td data-label="User">{membership.userIdentityId}</td>
                        <td data-label="Status">
                          <select
                            className="ui-select ui-select--sm"
                            value={membershipDrafts[membership.userIdentityId] ?? membership.status}
                            disabled={isMutating}
                            onChange={(event) => {
                              const nextStatus = event.target.value as WorkspaceMembershipStatus;
                              setMembershipDrafts((current) => Object.freeze({
                                ...current,
                                [membership.userIdentityId]: nextStatus,
                              }));
                            }}
                          >
                            {workspaceMembershipStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                        <td data-label="Roles">{membership.activeRoles.join(", ") || "none"}</td>
                        <td data-label="Actions">
                          <WorkspaceMemberRowActions
                            surface={surface}
                            actorPermissionIds={actorPermissionIds}
                            isMutating={isMutating}
                            selectedWorkspaceId={selectedWorkspaceId}
                            membership={membership}
                            draftStatus={membershipDrafts[membership.userIdentityId] ?? membership.status}
                            onSaveMembershipStatus={onSaveMembershipStatus}
                            onRemoveMember={onRemoveMember}
                            onAssignRole={onAssignRole}
                            onRevokeRole={onRevokeRole}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceResponsiveTableContainer>
          )
          : (
            <div className="ui-stack ui-stack--xs">
              {memberships.map((membership) => (
                <article key={membership.membershipId} className="ui-workspace-admin-shared__member-card">
                  <div className="ui-stack ui-stack--2xs">
                    <strong>{membership.userIdentityId}</strong>
                    <span className="ui-text-secondary ui-text-small">
                      status: {membership.status} | roles: {membership.activeRoles.join(", ") || "none"}
                    </span>
                  </div>
                  <div className="ui-workspace-admin-shared__member-actions">
                    <select
                      className="ui-select ui-select--sm"
                      value={membershipDrafts[membership.userIdentityId] ?? membership.status}
                      disabled={isMutating}
                      onChange={(event) => {
                        const nextStatus = event.target.value as WorkspaceMembershipStatus;
                        setMembershipDrafts((current) => Object.freeze({
                          ...current,
                          [membership.userIdentityId]: nextStatus,
                        }));
                      }}
                    >
                      {workspaceMembershipStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <WorkspaceMemberRowActions
                      surface={surface}
                      actorPermissionIds={actorPermissionIds}
                      isMutating={isMutating}
                      selectedWorkspaceId={selectedWorkspaceId}
                      membership={membership}
                      draftStatus={membershipDrafts[membership.userIdentityId] ?? membership.status}
                      onSaveMembershipStatus={onSaveMembershipStatus}
                      onRemoveMember={onRemoveMember}
                      onAssignRole={onAssignRole}
                      onRevokeRole={onRevokeRole}
                    />
                  </div>
                </article>
              ))}
            </div>
          )
      ) : null}

      <section className="ui-card ui-workspace-admin-shared__role-assignment">
        <div className="ui-card__header">
          <h3 className="ui-card__title">Role assignments</h3>
          <p className="ui-card__subtitle">Assign or revoke roles for the selected workspace membership.</p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-workspace-admin-shared__role-form">
            <label className="ui-field">
              <span className="ui-field__label">User identity ID</span>
              <input
                className="ui-input"
                value={roleTargetUserId}
                onChange={(event) => setRoleTargetUserId(event.target.value)}
                disabled={isMutating}
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Role</span>
              <select
                className="ui-select"
                value={roleValue}
                onChange={(event) => setRoleValue(event.target.value as WorkspaceAssignableRole)}
                disabled={isMutating}
              >
                {workspaceAssignableRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
          </div>
          <SurfaceActionButtonStrip
            actions={roleActions}
            context={roleActionContext}
            scope="bulk"
            responsiveProfile={responsiveProfile}
          />
        </div>
      </section>
    </div>
  );
}

interface WorkspaceMemberRowActionsProps {
  readonly surface: WorkspaceAdministrationSurface;
  readonly actorPermissionIds: ReadonlyArray<string>;
  readonly selectedWorkspaceId?: string;
  readonly isMutating: boolean;
  readonly membership: WorkspaceMembershipApiRecord;
  readonly draftStatus: WorkspaceMembershipStatus;
  readonly onSaveMembershipStatus: (
    input: {
      readonly targetUserIdentityId: string;
      readonly status: WorkspaceMembershipStatus;
    },
  ) => Promise<void>;
  readonly onRemoveMember: (targetUserIdentityId: string) => Promise<void>;
  readonly onAssignRole: (
    input: {
      readonly targetUserIdentityId: string;
      readonly role: WorkspaceAssignableRole;
    },
  ) => Promise<void>;
  readonly onRevokeRole: (
    input: {
      readonly targetUserIdentityId: string;
      readonly role: WorkspaceAssignableRole;
    },
  ) => Promise<void>;
}

function WorkspaceMemberRowActions({
  surface,
  actorPermissionIds,
  selectedWorkspaceId,
  isMutating,
  membership,
  draftStatus,
  onSaveMembershipStatus,
  onRemoveMember,
  onAssignRole,
  onRevokeRole,
}: WorkspaceMemberRowActionsProps): JSX.Element {
  const rowActionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      resource: membership,
      selection: Object.freeze({ selectedWorkspaceId }),
      meta: Object.freeze({ isMutating, draftStatus }),
    }),
    [actorPermissionIds, draftStatus, isMutating, membership, selectedWorkspaceId, surface],
  );

  const rowActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: `workspace-members-status-save:${membership.membershipId}`,
        label: "Save status",
        scope: "row",
        tone: "secondary",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageMembers]),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A membership operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before changing member status." });
          }
          if (draftStatus === membership.status) {
            return Object.freeze({ disabled: true, disabledReason: "Membership status is unchanged." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onSaveMembershipStatus({
            targetUserIdentityId: membership.userIdentityId,
            status: draftStatus,
          });
        },
      } satisfies SurfaceActionDescriptor,
      {
        id: `workspace-members-remove:${membership.membershipId}`,
        label: "Remove",
        scope: "row",
        tone: "danger",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageMembers]),
        confirmation: Object.freeze({
          title: "Remove workspace member?",
          message: `Remove ${membership.userIdentityId} from this workspace.`,
          confirmLabel: "Remove member",
          cancelLabel: "Cancel",
          tone: "danger",
        }),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A membership operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before removing a member." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onRemoveMember(membership.userIdentityId);
        },
      } satisfies SurfaceActionDescriptor,
      {
        id: `workspace-members-grant-admin:${membership.membershipId}`,
        label: "Grant admin",
        scope: "row",
        tone: "secondary",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageRoles]),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A role operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before role changes." });
          }
          if (membership.activeRoles.includes("admin") || membership.activeRoles.includes("owner")) {
            return Object.freeze({ disabled: true, disabledReason: "This member already has administrative access." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onAssignRole({
            targetUserIdentityId: membership.userIdentityId,
            role: "admin",
          });
        },
      } satisfies SurfaceActionDescriptor,
      {
        id: `workspace-members-revoke-admin:${membership.membershipId}`,
        label: "Revoke admin",
        scope: "row",
        tone: "danger",
        requiredPermissions: Object.freeze([WorkspacePermissionIds.manageRoles]),
        availability: () => {
          if (isMutating) {
            return Object.freeze({ disabled: true, disabledReason: "A role operation is already running." });
          }
          if (!selectedWorkspaceId) {
            return Object.freeze({ disabled: true, disabledReason: "Select a workspace before role changes." });
          }
          if (membership.activeRoles.includes("owner")) {
            return Object.freeze({ disabled: true, disabledReason: "Owner role mutation requires ownership transfer." });
          }
          if (!membership.activeRoles.includes("admin")) {
            return Object.freeze({ disabled: true, disabledReason: "This member does not have an admin role." });
          }
          return Object.freeze({});
        },
        onInvoke: async () => {
          await onRevokeRole({
            targetUserIdentityId: membership.userIdentityId,
            role: "admin",
          });
        },
      } satisfies SurfaceActionDescriptor,
    ]),
    [
      draftStatus,
      isMutating,
      membership.activeRoles,
      membership.membershipId,
      membership.status,
      membership.userIdentityId,
      onAssignRole,
      onRemoveMember,
      onRevokeRole,
      onSaveMembershipStatus,
      selectedWorkspaceId,
    ],
  );

  return surface === "desktop"
    ? (
      <SurfaceActionMenu
        triggerLabel="Actions"
        actions={rowActions}
        context={rowActionContext}
        scope="row"
      />
    )
    : (
      <SurfaceActionList
        actions={rowActions}
        context={rowActionContext}
        scope="row"
      />
    );
}

function toActorPermissionIds(
  capabilities: WorkspaceAdministrationCapabilityViewModel,
): ReadonlyArray<string> {
  const permissions: Array<string> = [];
  if (capabilities.canManageMembers) {
    permissions.push(WorkspacePermissionIds.manageMembers);
  }
  if (capabilities.canManageRoles) {
    permissions.push(WorkspacePermissionIds.manageRoles);
  }
  return Object.freeze(permissions);
}

function toLimitedCapabilities(
  capabilities: WorkspaceAdministrationCapabilityViewModel,
): ReadonlyArray<string> {
  const limitations: Array<string> = [];
  if (!capabilities.canManageWorkspaceSettings) {
    limitations.push("workspace settings");
  }
  if (!capabilities.canManageMembers) {
    limitations.push("membership status");
  }
  if (!capabilities.canManageInvitations) {
    limitations.push("invitation issuance");
  }
  if (!capabilities.canManageRoles) {
    limitations.push("role assignment");
  }
  return Object.freeze(limitations);
}

function parseWorkspaceRoleCsv(
  value: string,
): { readonly ok: true; readonly roles: ReadonlyArray<WorkspaceAssignableRole> } | { readonly ok: false; readonly message: string } {
  const roles = [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0))];
  if (roles.length === 0) {
    return Object.freeze({ ok: false, message: "At least one role is required." });
  }
  const invalidRoles = roles.filter((role) => !workspaceAssignableRoleOptions.includes(role as WorkspaceAssignableRole));
  if (invalidRoles.length > 0) {
    return Object.freeze({ ok: false, message: `Unsupported role values: ${invalidRoles.join(", ")}.` });
  }
  return Object.freeze({ ok: true, roles: roles as Array<WorkspaceAssignableRole> });
}

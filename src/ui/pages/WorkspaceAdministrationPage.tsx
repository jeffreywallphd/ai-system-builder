import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceInvitationApiRecord,
  WorkspaceMembershipApiRecord,
  WorkspaceRoleAssignmentApiRecord,
} from "../../infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { presentWorkspaceAdministrationCapabilities } from "../presenters/WorkspaceAdministrationCapabilitiesPresenter";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { WorkspaceAdministrationService } from "../services/WorkspaceAdministrationService";
import { IdentityAuthSessionStore } from "../shared/identity/IdentityAuthSessionStore";

const roleOptions = Object.freeze(["admin", "member", "viewer"] as const);
const membershipStatusOptions = Object.freeze(["pending", "active", "suspended", "removed"] as const);

export default function WorkspaceAdministrationPage(): JSX.Element {
  const service = useMemo(() => new WorkspaceAdministrationService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [workspaces, setWorkspaces] = useState<ReadonlyArray<WorkspaceAdminListItemApiRecord>>(Object.freeze([]));
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [memberships, setMemberships] = useState<ReadonlyArray<WorkspaceMembershipApiRecord>>(Object.freeze([]));
  const [invitations, setInvitations] = useState<ReadonlyArray<WorkspaceInvitationApiRecord>>(Object.freeze([]));
  const [roles, setRoles] = useState<ReadonlyArray<WorkspaceRoleAssignmentApiRecord>>(Object.freeze([]));
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const [createSlug, setCreateSlug] = useState("");
  const [createName, setCreateName] = useState("");
  const [workspaceDisplayName, setWorkspaceDisplayName] = useState("");
  const [workspaceVisibility, setWorkspaceVisibility] = useState<"private" | "team" | "public">("private");
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRolesCsv, setNewMemberRolesCsv] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRolesCsv, setInviteRolesCsv] = useState("member");
  const [roleTargetUserId, setRoleTargetUserId] = useState("");
  const [roleValue, setRoleValue] = useState<"admin" | "member" | "viewer">("member");

  const selectedWorkspace = workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId);
  const workspaceCapabilities = presentWorkspaceAdministrationCapabilities(selectedWorkspace);

  useEffect(() => {
    if (!selectedWorkspace) {
      setWorkspaceDisplayName("");
      setWorkspaceVisibility("private");
      return;
    }
    setWorkspaceDisplayName(selectedWorkspace.displayName);
    setWorkspaceVisibility(selectedWorkspace.visibility);
  }, [selectedWorkspace]);

  const refresh = async (preferredWorkspaceId?: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const workspaceResponse = await service.listWorkspaces({ limit: 200 }, sessionToken);
      if (!workspaceResponse.ok || !workspaceResponse.data) {
        setErrorMessage(workspaceResponse.error?.message ?? "Unable to load workspaces.");
        return;
      }
      setWorkspaces(workspaceResponse.data.workspaces);
      const workspaceId = preferredWorkspaceId
        ?? (selectedWorkspaceId && workspaceResponse.data.workspaces.some((item) => item.workspaceId === selectedWorkspaceId)
          ? selectedWorkspaceId
          : workspaceResponse.data.workspaces[0]?.workspaceId);
      setSelectedWorkspaceId(workspaceId);
      if (!workspaceId) {
        setMemberships(Object.freeze([]));
        setInvitations(Object.freeze([]));
        setRoles(Object.freeze([]));
        return;
      }
      const [members, invites, roleAssignments] = await Promise.all([
        service.listWorkspaceMemberships({ workspaceId, limit: 200 }, sessionToken),
        service.listWorkspaceInvitations({ workspaceId, limit: 200 }, sessionToken),
        service.listWorkspaceRoleAssignments({ workspaceId, limit: 200 }, sessionToken),
      ]);
      if (!members.ok || !members.data) {
        setErrorMessage(members.error?.message ?? "Unable to load workspace members.");
        return;
      }
      if (!invites.ok || !invites.data) {
        setErrorMessage(invites.error?.message ?? "Unable to load workspace invitations.");
        return;
      }
      if (!roleAssignments.ok || !roleAssignments.data) {
        setErrorMessage(roleAssignments.error?.message ?? "Unable to load workspace roles.");
        return;
      }
      setMemberships(members.data.memberships);
      setInvitations(invites.data.invitations);
      setRoles(roleAssignments.data.roleAssignments);
    } catch {
      setErrorMessage("Workspace administration request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh();
  }, [sessionToken]);

  const runMutation = async (action: () => Promise<void>): Promise<void> => {
    setIsMutating(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      await action();
    } finally {
      setIsMutating(false);
    }
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-workspace-admin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Workspace administration</h1>
            <p className="ui-card__subtitle">Sign in with an authenticated admin-capable account before managing workspaces.</p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-workspace-admin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workspace administration</h1>
          <p className="ui-page__subtitle">Create workspaces, manage members, issue invitations, and update workspace settings.</p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading} onClick={() => { void refresh(); }}>Refresh</button>
        </div>
      </div>

      {errorMessage ? <p className="ui-workspace-admin-page__alert ui-workspace-admin-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-workspace-admin-page__alert ui-workspace-admin-page__alert--success" role="status">{statusMessage}</p> : null}

      <div className="ui-workspace-admin-page__grid">
        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Create workspace</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <label className="ui-field"><span className="ui-field__label">Slug</span><input className="ui-input" value={createSlug} onChange={(event) => setCreateSlug(event.target.value)} /></label>
            <label className="ui-field"><span className="ui-field__label">Display name</span><input className="ui-input" value={createName} onChange={(event) => setCreateName(event.target.value)} /></label>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={isMutating} onClick={() => { void runMutation(async () => { const slug = createSlug.trim(); const displayName = createName.trim(); if (!slug || !displayName) { setErrorMessage("Workspace slug and display name are required."); return; } if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setErrorMessage("Workspace slug must use lowercase letters, numbers, and hyphens."); return; } const response = await service.createWorkspace({ slug, displayName, visibility: "private", status: "active" }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to create workspace."); return; } setCreateSlug(""); setCreateName(""); setStatusMessage(`Workspace "${response.data.workspace.displayName}" created.`); await refresh(response.data.workspace.workspaceId); }); }}>{isMutating ? "Saving..." : "Create workspace"}</button>
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Workspaces</h2></div>
          <div className="ui-card__body">
            {workspaces.length === 0 ? <p className="ui-text-secondary">{isLoading ? "Loading workspaces..." : "No workspaces found."}</p> : (
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead><tr><th scope="col">Workspace</th><th scope="col">Status</th><th scope="col">Members</th></tr></thead>
                  <tbody>{workspaces.map((workspace) => <tr key={workspace.workspaceId} className={workspace.workspaceId === selectedWorkspaceId ? "ui-workspace-admin-page__table-row--selected" : undefined}><td><button type="button" className="ui-button ui-button--ghost ui-button--sm ui-workspace-admin-page__select-button" onClick={() => { void refresh(workspace.workspaceId); }}>{workspace.displayName}</button><div className="ui-text-secondary ui-text-small">{workspace.slug}</div></td><td>{workspace.status}</td><td>{workspace.membershipSummary.total}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Workspace settings</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {!selectedWorkspace ? <p className="ui-text-secondary">Select a workspace to manage its settings.</p> : (
              <>
                <label className="ui-field"><span className="ui-field__label">Display name</span><input className="ui-input" value={workspaceDisplayName} disabled={!workspaceCapabilities.canManageWorkspaceSettings} onChange={(event) => setWorkspaceDisplayName(event.target.value)} /></label>
                <label className="ui-field"><span className="ui-field__label">Visibility</span><select className="ui-select" value={workspaceVisibility} disabled={!workspaceCapabilities.canManageWorkspaceSettings} onChange={(event) => setWorkspaceVisibility(event.target.value as typeof workspaceVisibility)}><option value="private">private</option><option value="team">team</option><option value="public">public</option></select></label>
                <div className="ui-page__actions">
                  <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageWorkspaceSettings || isMutating} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const displayName = workspaceDisplayName.trim(); if (!displayName) { setErrorMessage("Workspace display name is required."); return; } const response = await service.updateWorkspace({ workspaceId: selectedWorkspaceId, displayName, visibility: workspaceVisibility }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to update workspace."); return; } setStatusMessage(response.data.changed ? "Workspace settings updated." : "Workspace settings were already up to date."); await refresh(selectedWorkspaceId); }); }}>Save settings</button>
                  <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageWorkspaceSettings || isMutating} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const response = await service.transitionWorkspaceLifecycle({ workspaceId: selectedWorkspaceId, action: "suspend" }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to suspend workspace."); return; } setStatusMessage("Workspace suspended."); await refresh(selectedWorkspaceId); }); }}>Suspend</button>
                  <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageWorkspaceSettings || isMutating} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const response = await service.transitionWorkspaceLifecycle({ workspaceId: selectedWorkspaceId, action: "activate" }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to activate workspace."); return; } setStatusMessage("Workspace activated."); await refresh(selectedWorkspaceId); }); }}>Activate</button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="ui-workspace-admin-page__grid ui-workspace-admin-page__grid--details">
        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Members</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-workspace-admin-page__field-grid">
              <label className="ui-field"><span className="ui-field__label">User identity ID</span><input className="ui-input" value={newMemberUserId} onChange={(event) => setNewMemberUserId(event.target.value)} /></label>
              <label className="ui-field"><span className="ui-field__label">Roles (CSV)</span><input className="ui-input" value={newMemberRolesCsv} onChange={(event) => setNewMemberRolesCsv(event.target.value)} /></label>
            </div>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageMembers || isMutating} onClick={() => { void runMutation(async () => { if (!selectedWorkspaceId) { return; } const targetUserIdentityId = newMemberUserId.trim(); if (!targetUserIdentityId) { setErrorMessage("Target user identity id is required."); return; } const parsedRoles = parseRoleCsv(newMemberRolesCsv); if (!parsedRoles.ok) { setErrorMessage(parsedRoles.message); return; } const response = await service.addWorkspaceMember({ workspaceId: selectedWorkspaceId, targetUserIdentityId, initialStatus: "active", roles: parsedRoles.roles }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to add workspace member."); return; } setStatusMessage(`Added member "${targetUserIdentityId}".`); setNewMemberUserId(""); setNewMemberRolesCsv("member"); await refresh(selectedWorkspaceId); }); }}>{isMutating ? "Saving..." : "Add member"}</button>
            {memberships.length === 0 ? <p className="ui-text-secondary">No members found.</p> : <div className="ui-table-wrapper"><table className="ui-table"><thead><tr><th scope="col">User</th><th scope="col">Status</th><th scope="col">Roles</th><th scope="col">Actions</th></tr></thead><tbody>{memberships.map((membership) => <tr key={membership.membershipId}><td>{membership.userIdentityId}</td><td><select className="ui-select ui-select--sm" defaultValue={membership.status} disabled={!workspaceCapabilities.canManageMembers || isMutating} onChange={(event) => { if (!selectedWorkspaceId) { return; } const nextStatus = event.target.value as WorkspaceMembershipApiRecord["status"]; if (!membershipStatusOptions.includes(nextStatus)) { return; } void runMutation(async () => { const response = await service.changeWorkspaceMembershipStatus({ workspaceId: selectedWorkspaceId, targetUserIdentityId: membership.userIdentityId, status: nextStatus }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to change membership status."); return; } await refresh(selectedWorkspaceId); }); }}>{membershipStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td>{membership.activeRoles.join(", ") || "none"}</td><td><button type="button" className="ui-button ui-button--danger ui-button--sm" disabled={!workspaceCapabilities.canManageMembers || isMutating} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const response = await service.removeWorkspaceMember({ workspaceId: selectedWorkspaceId, targetUserIdentityId: membership.userIdentityId }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to remove workspace member."); return; } await refresh(selectedWorkspaceId); }); }}>Remove</button></td></tr>)}</tbody></table></div>}
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Invitations</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-workspace-admin-page__field-grid">
              <label className="ui-field"><span className="ui-field__label">Invite email</span><input className="ui-input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
              <label className="ui-field"><span className="ui-field__label">Roles (CSV)</span><input className="ui-input" value={inviteRolesCsv} onChange={(event) => setInviteRolesCsv(event.target.value)} /></label>
            </div>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating} onClick={() => { void runMutation(async () => { if (!selectedWorkspaceId) { return; } const invitedEmail = inviteEmail.trim(); if (!invitedEmail) { setErrorMessage("Invitation email is required."); return; } const parsedRoles = parseRoleCsv(inviteRolesCsv); if (!parsedRoles.ok) { setErrorMessage(parsedRoles.message); return; } const response = await service.issueWorkspaceInvitation({ workspaceId: selectedWorkspaceId, invitedEmail, invitedRoles: parsedRoles.roles, expiresInMs: 14 * 24 * 60 * 60 * 1000 }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to issue workspace invitation."); return; } setStatusMessage(`Invitation issued for ${response.data.invitation.invitedEmail}.`); setInviteEmail(""); setInviteRolesCsv("member"); await refresh(selectedWorkspaceId); }); }}>{isMutating ? "Saving..." : "Issue invitation"}</button>
            {invitations.length === 0 ? <p className="ui-text-secondary">No invitations found.</p> : <div className="ui-table-wrapper"><table className="ui-table"><thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Roles</th><th scope="col">Actions</th></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.invitationId}><td>{invitation.invitedEmail}</td><td>{invitation.status}</td><td>{invitation.invitedRoles.join(", ")}</td><td><button type="button" className="ui-button ui-button--danger ui-button--sm" disabled={!workspaceCapabilities.canManageInvitations || isMutating || invitation.status !== "pending"} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const response = await service.cancelWorkspaceInvitation({ workspaceId: selectedWorkspaceId, invitationId: invitation.invitationId }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to cancel invitation."); return; } await refresh(selectedWorkspaceId); }); }}>Cancel</button></td></tr>)}</tbody></table></div>}
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Roles</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-workspace-admin-page__field-grid">
              <label className="ui-field"><span className="ui-field__label">User identity ID</span><input className="ui-input" value={roleTargetUserId} onChange={(event) => setRoleTargetUserId(event.target.value)} /></label>
              <label className="ui-field"><span className="ui-field__label">Role</span><select className="ui-select" value={roleValue} onChange={(event) => setRoleValue(event.target.value as typeof roleValue)}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
            </div>
            <div className="ui-page__actions">
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageRoles || isMutating} onClick={() => { void runMutation(async () => { if (!selectedWorkspaceId || !roleTargetUserId.trim()) { setErrorMessage("Target user identity id is required."); return; } const response = await service.assignWorkspaceRole({ workspaceId: selectedWorkspaceId, targetUserIdentityId: roleTargetUserId.trim(), role: roleValue }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to assign role."); return; } await refresh(selectedWorkspaceId); }); }}>Assign role</button>
              <button type="button" className="ui-button ui-button--danger ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageRoles || isMutating} onClick={() => { void runMutation(async () => { if (!selectedWorkspaceId || !roleTargetUserId.trim()) { setErrorMessage("Target user identity id is required."); return; } const response = await service.revokeWorkspaceRole({ workspaceId: selectedWorkspaceId, targetUserIdentityId: roleTargetUserId.trim(), role: roleValue }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to revoke role."); return; } await refresh(selectedWorkspaceId); }); }}>Revoke role</button>
            </div>
            {roles.length === 0 ? <p className="ui-text-secondary">No role assignments found.</p> : <div className="ui-table-wrapper"><table className="ui-table"><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th></tr></thead><tbody>{roles.map((assignment) => <tr key={assignment.roleAssignmentId}><td>{assignment.userIdentityId}</td><td>{assignment.role}</td><td>{assignment.status}</td></tr>)}</tbody></table></div>}
          </div>
        </section>
      </div>
    </section>
  );
}

function parseRoleCsv(
  value: string,
): { readonly ok: true; readonly roles: ReadonlyArray<"admin" | "member" | "viewer"> } | { readonly ok: false; readonly message: string } {
  const roles = [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0))];
  if (roles.length === 0) {
    return Object.freeze({ ok: false, message: "At least one role is required." });
  }
  const invalidRoles = roles.filter((role) => !roleOptions.includes(role as "admin" | "member" | "viewer"));
  if (invalidRoles.length > 0) {
    return Object.freeze({ ok: false, message: `Unsupported role values: ${invalidRoles.join(", ")}.` });
  }
  return Object.freeze({ ok: true, roles: roles as Array<"admin" | "member" | "viewer"> });
}

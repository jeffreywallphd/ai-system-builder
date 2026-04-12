import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceInvitationApiRecord,
  WorkspaceMembershipApiRecord,
  WorkspaceRoleAssignmentApiRecord,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { presentWorkspaceAdministrationCapabilities } from "../presenters/WorkspaceAdministrationCapabilitiesPresenter";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { WorkspaceAdministrationService } from "../services/WorkspaceAdministrationService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";
import { SurfaceStatePanel } from "../shared/components/presentation-state";
import {
  WorkspaceListPanel,
  WorkspaceMembershipAdministrationPanel,
  WorkspaceOperationalContextPanel,
  type WorkspaceAssignableRole,
} from "@ui/shared/workspaces/WorkspaceAdministrationPanels";

interface WorkspaceAdministrationPageProps {
  readonly service?: WorkspaceAdministrationService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

const invitationRoleOptions = Object.freeze(["admin", "member", "viewer"] as const);

export default function WorkspaceAdministrationPage(props: WorkspaceAdministrationPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new WorkspaceAdministrationService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRolesCsv, setInviteRolesCsv] = useState("member");

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

  const refreshWorkspaceDetails = async (workspaceId: string): Promise<boolean> => {
    const [members, invites, roleAssignments] = await Promise.all([
      service.listWorkspaceMemberships({ workspaceId, limit: 200 }, sessionToken as string),
      service.listWorkspaceInvitations({ workspaceId, limit: 200 }, sessionToken as string),
      service.listWorkspaceRoleAssignments({ workspaceId, limit: 200 }, sessionToken as string),
    ]);
    if (!members.ok || !members.data) {
      setErrorMessage(members.error?.message ?? "Unable to load workspace members.");
      return false;
    }
    if (!invites.ok || !invites.data) {
      setErrorMessage(invites.error?.message ?? "Unable to load workspace invitations.");
      return false;
    }
    if (!roleAssignments.ok || !roleAssignments.data) {
      setErrorMessage(roleAssignments.error?.message ?? "Unable to load workspace roles.");
      return false;
    }
    setMemberships(members.data.memberships);
    setInvitations(invites.data.invitations);
    setRoles(roleAssignments.data.roleAssignments);
    return true;
  };

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
      await refreshWorkspaceDetails(workspaceId);
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
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Workspace administration",
            message: "Sign in with an authenticated admin-capable account before managing workspaces.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-workspace-admin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workspace administration</h1>
          <p className="ui-page__subtitle">
            Create workspaces, manage membership and role assignments, and review workspace-scoped operational context.
          </p>
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
            <WorkspaceListPanel
              surface="desktop"
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              isLoading={isLoading}
              onSelectWorkspace={(workspaceId) => {
                void refresh(workspaceId);
              }}
            />
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Workspace context</h2></div>
          <div className="ui-card__body">
            <WorkspaceOperationalContextPanel workspace={selectedWorkspace} capabilities={workspaceCapabilities} />
          </div>
        </section>
      </div>

      <div className="ui-workspace-admin-page__grid ui-workspace-admin-page__grid--details">
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

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Membership administration</h2></div>
          <div className="ui-card__body">
            <WorkspaceMembershipAdministrationPanel
              surface="desktop"
              selectedWorkspaceId={selectedWorkspaceId}
              memberships={memberships}
              capabilities={workspaceCapabilities}
              isMutating={isMutating}
              onClientValidationError={setErrorMessage}
              onAddMember={async (input) => {
                if (!selectedWorkspaceId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.addWorkspaceMember({
                    workspaceId: selectedWorkspaceId,
                    targetUserIdentityId: input.targetUserIdentityId,
                    initialStatus: "active",
                    roles: input.roles,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to add workspace member.");
                    return;
                  }
                  setStatusMessage(`Added member "${input.targetUserIdentityId}".`);
                  await refreshWorkspaceDetails(selectedWorkspaceId);
                });
              }}
              onSaveMembershipStatus={async (input) => {
                if (!selectedWorkspaceId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.changeWorkspaceMembershipStatus({
                    workspaceId: selectedWorkspaceId,
                    targetUserIdentityId: input.targetUserIdentityId,
                    status: input.status,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to change membership status.");
                    return;
                  }
                  setStatusMessage(`Updated ${input.targetUserIdentityId} to ${input.status}.`);
                  await refreshWorkspaceDetails(selectedWorkspaceId);
                });
              }}
              onRemoveMember={async (targetUserIdentityId) => {
                if (!selectedWorkspaceId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.removeWorkspaceMember({
                    workspaceId: selectedWorkspaceId,
                    targetUserIdentityId,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to remove workspace member.");
                    return;
                  }
                  setStatusMessage(`Removed ${targetUserIdentityId} from workspace.`);
                  await refreshWorkspaceDetails(selectedWorkspaceId);
                });
              }}
              onAssignRole={async (input) => {
                if (!selectedWorkspaceId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.assignWorkspaceRole({
                    workspaceId: selectedWorkspaceId,
                    targetUserIdentityId: input.targetUserIdentityId,
                    role: input.role,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to assign role.");
                    return;
                  }
                  setStatusMessage(`Assigned ${input.role} role to ${input.targetUserIdentityId}.`);
                  await refreshWorkspaceDetails(selectedWorkspaceId);
                });
              }}
              onRevokeRole={async (input) => {
                if (!selectedWorkspaceId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.revokeWorkspaceRole({
                    workspaceId: selectedWorkspaceId,
                    targetUserIdentityId: input.targetUserIdentityId,
                    role: input.role,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to revoke role.");
                    return;
                  }
                  setStatusMessage(`Revoked ${input.role} role from ${input.targetUserIdentityId}.`);
                  await refreshWorkspaceDetails(selectedWorkspaceId);
                });
              }}
            />
          </div>
        </section>

        <section className="ui-card ui-workspace-admin-page__card">
          <div className="ui-card__header"><h2 className="ui-card__title">Invitations</h2></div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-workspace-admin-page__field-grid">
              <label className="ui-field"><span className="ui-field__label">Invite email</span><input className="ui-input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
              <label className="ui-field"><span className="ui-field__label">Roles (CSV)</span><input className="ui-input" value={inviteRolesCsv} onChange={(event) => setInviteRolesCsv(event.target.value)} /></label>
            </div>
            <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating} onClick={() => { void runMutation(async () => { if (!selectedWorkspaceId) { return; } const invitedEmail = inviteEmail.trim(); if (!invitedEmail) { setErrorMessage("Invitation email is required."); return; } const parsedRoles = parseInvitationRoleCsv(inviteRolesCsv); if (!parsedRoles.ok) { setErrorMessage(parsedRoles.message); return; } const response = await service.issueWorkspaceInvitation({ workspaceId: selectedWorkspaceId, invitedEmail, invitedRoles: parsedRoles.roles, expiresInMs: 14 * 24 * 60 * 60 * 1000 }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to issue workspace invitation."); return; } setStatusMessage(`Invitation issued for ${response.data.invitation.invitedEmail}.`); setInviteEmail(""); setInviteRolesCsv("member"); await refreshWorkspaceDetails(selectedWorkspaceId); }); }}>{isMutating ? "Saving..." : "Issue invitation"}</button>
            {invitations.length === 0 ? <p className="ui-text-secondary">No invitations found.</p> : <div className="ui-table-wrapper"><table className="ui-table"><thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Roles</th><th scope="col">Actions</th></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.invitationId}><td>{invitation.invitedEmail}</td><td>{invitation.status}</td><td>{invitation.invitedRoles.join(", ")}</td><td><button type="button" className="ui-button ui-button--danger ui-button--sm" disabled={!workspaceCapabilities.canManageInvitations || isMutating || invitation.status !== "pending"} onClick={() => { if (!selectedWorkspaceId) { return; } void runMutation(async () => { const response = await service.cancelWorkspaceInvitation({ workspaceId: selectedWorkspaceId, invitationId: invitation.invitationId }, sessionToken); if (!response.ok || !response.data) { setErrorMessage(response.error?.message ?? "Unable to cancel invitation."); return; } setStatusMessage(`Cancelled invite for ${invitation.invitedEmail}.`); await refreshWorkspaceDetails(selectedWorkspaceId); }); }}>Cancel</button></td></tr>)}</tbody></table></div>}
          </div>
        </section>
      </div>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Role assignment state</h2>
          <p className="ui-card__subtitle">Current active and revoked role records for the selected workspace.</p>
        </div>
        <div className="ui-card__body">
          {roles.length === 0 ? <p className="ui-text-secondary">No role assignments found.</p> : <div className="ui-table-wrapper"><table className="ui-table"><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th></tr></thead><tbody>{roles.map((assignment) => <tr key={assignment.roleAssignmentId}><td>{assignment.userIdentityId}</td><td>{assignment.role}</td><td>{assignment.status}</td></tr>)}</tbody></table></div>}
        </div>
      </section>
    </section>
  );
}

export function parseInvitationRoleCsv(
  value: string,
): { readonly ok: true; readonly roles: ReadonlyArray<WorkspaceAssignableRole> } | { readonly ok: false; readonly message: string } {
  const roles = [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0))];
  if (roles.length === 0) {
    return Object.freeze({ ok: false, message: "At least one role is required." });
  }
  const invalidRoles = roles.filter((role) => !invitationRoleOptions.includes(role as WorkspaceAssignableRole));
  if (invalidRoles.length > 0) {
    return Object.freeze({ ok: false, message: `Unsupported role values: ${invalidRoles.join(", ")}.` });
  }
  return Object.freeze({ ok: true, roles: roles as Array<WorkspaceAssignableRole> });
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceInvitationApiRecord,
  WorkspaceMembershipApiRecord,
} from "../../src/infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { presentWorkspaceAdministrationCapabilities } from "../presenters/WorkspaceAdministrationCapabilitiesPresenter";
import { WorkspaceAdministrationService } from "../services/WorkspaceAdministrationService";
import { IdentityAuthSessionStore } from "../shared/identity/IdentityAuthSessionStore";
import { buildWorkspaceInvitationAcceptPath } from "../web/workspaces/WorkspaceThinClientRoutes";

const invitationRoleOptions = Object.freeze(["admin", "member", "viewer"] as const);
const membershipStatusOptions = Object.freeze(["pending", "active", "suspended", "removed"] as const);

export default function WorkspaceMembershipThinClientPage(): JSX.Element {
  const service = useMemo(() => new WorkspaceAdministrationService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [workspaces, setWorkspaces] = useState<ReadonlyArray<WorkspaceAdminListItemApiRecord>>(Object.freeze([]));
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [memberships, setMemberships] = useState<ReadonlyArray<WorkspaceMembershipApiRecord>>(Object.freeze([]));
  const [invitations, setInvitations] = useState<ReadonlyArray<WorkspaceInvitationApiRecord>>(Object.freeze([]));
  const [membershipDrafts, setMembershipDrafts] = useState<Readonly<Record<string, WorkspaceMembershipApiRecord["status"]>>>(Object.freeze({}));
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof invitationRoleOptions)[number]>("member");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [latestInvitationPath, setLatestInvitationPath] = useState<string>();

  const selectedWorkspace = workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId);
  const workspaceCapabilities = presentWorkspaceAdministrationCapabilities(selectedWorkspace);

  const refreshWorkspaceDetails = async (
    workspaceId: string,
    workspaceList = workspaces,
  ): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    const workspace = workspaceList.find((entry) => entry.workspaceId === workspaceId);
    if (!presentWorkspaceAdministrationCapabilities(workspace).canAdministrate) {
      setMemberships(Object.freeze([]));
      setInvitations(Object.freeze([]));
      setMembershipDrafts(Object.freeze({}));
      return;
    }

    const [membersResponse, invitationsResponse] = await Promise.all([
      service.listWorkspaceMemberships({ workspaceId, limit: 150 }, sessionToken),
      service.listWorkspaceInvitations({ workspaceId, limit: 150, asOf: new Date().toISOString() }, sessionToken),
    ]);

    if (!membersResponse.ok || !membersResponse.data) {
      setErrorMessage(membersResponse.error?.message ?? "Unable to load workspace memberships.");
      return;
    }
    if (!invitationsResponse.ok || !invitationsResponse.data) {
      setErrorMessage(invitationsResponse.error?.message ?? "Unable to load workspace invitations.");
      return;
    }

    setMemberships(membersResponse.data.memberships);
    setInvitations(invitationsResponse.data.invitations);
    setMembershipDrafts(
      Object.freeze(
        membersResponse.data.memberships.reduce<Record<string, WorkspaceMembershipApiRecord["status"]>>((current, membership) => {
          current[membership.userIdentityId] = membership.status;
          return current;
        }, {}),
      ),
    );
  };

  const refresh = async (preferredWorkspaceId?: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const workspaceResponse = await service.listWorkspaces({ limit: 100 }, sessionToken);
      if (!workspaceResponse.ok || !workspaceResponse.data) {
        setErrorMessage(workspaceResponse.error?.message ?? "Unable to load workspaces.");
        return;
      }

      const fetchedWorkspaces = workspaceResponse.data.workspaces;
      setWorkspaces(fetchedWorkspaces);
      const workspaceId = preferredWorkspaceId
        ?? (selectedWorkspaceId && fetchedWorkspaces.some((entry) => entry.workspaceId === selectedWorkspaceId)
          ? selectedWorkspaceId
          : fetchedWorkspaces[0]?.workspaceId);
      setSelectedWorkspaceId(workspaceId);

      if (!workspaceId) {
        setMemberships(Object.freeze([]));
        setInvitations(Object.freeze([]));
        setMembershipDrafts(Object.freeze({}));
        return;
      }

      await refreshWorkspaceDetails(workspaceId, fetchedWorkspaces);
    } catch {
      setErrorMessage("Workspace membership request failed.");
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
    setLatestInvitationPath(undefined);
    try {
      await action();
    } finally {
      setIsMutating(false);
    }
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-workspace-thin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Workspace memberships</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated account before managing workspace memberships and invitations.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-workspace-thin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workspace memberships</h1>
          <p className="ui-page__subtitle">
            Lightweight workspace member and invitation operations for web and mobile surfaces.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.workspaceAdmin}>Full administration</Link>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading} onClick={() => { void refresh(); }}>
            Refresh
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-workspace-thin-page__alert ui-workspace-thin-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-workspace-thin-page__alert ui-workspace-thin-page__alert--success" role="status">{statusMessage}</p> : null}
      {latestInvitationPath ? (
        <p className="ui-workspace-thin-page__alert ui-workspace-thin-page__alert--success">
          Share invite path: <Link to={latestInvitationPath}>{latestInvitationPath}</Link>
        </p>
      ) : null}

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Workspace</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <label className="ui-field">
            <span className="ui-field__label">Selected workspace</span>
            <select
              className="ui-select"
              value={selectedWorkspaceId}
              onChange={(event) => {
                const nextWorkspaceId = event.target.value || undefined;
                setSelectedWorkspaceId(nextWorkspaceId);
                if (nextWorkspaceId) {
                  void refreshWorkspaceDetails(nextWorkspaceId);
                } else {
                  setMemberships(Object.freeze([]));
                  setInvitations(Object.freeze([]));
                  setMembershipDrafts(Object.freeze({}));
                }
              }}
            >
              {workspaces.length === 0 ? <option value="">No workspaces available</option> : null}
              {workspaces.map((workspace) => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>
                  {workspace.displayName} ({workspace.slug})
                </option>
              ))}
            </select>
          </label>

          {selectedWorkspace ? (
            <div className="ui-workspace-thin-page__summary-grid">
              <div className="ui-card ui-workspace-thin-page__summary-card">
                <strong>{selectedWorkspace.membershipSummary.total}</strong>
                <span>members</span>
              </div>
              <div className="ui-card ui-workspace-thin-page__summary-card">
                <strong>{selectedWorkspace.invitationSummary.pending}</strong>
                <span>pending invites</span>
              </div>
              <div className="ui-card ui-workspace-thin-page__summary-card">
                <strong>{selectedWorkspace.roleSummary.activeAssignments}</strong>
                <span>active roles</span>
              </div>
            </div>
          ) : null}

          {!workspaceCapabilities.canAdministrate && selectedWorkspace ? (
            <p className="ui-text-secondary">
              You have read access only in this workspace. Member and invitation updates require owner/admin role access.
            </p>
          ) : null}
        </div>
      </section>

      <div className="ui-workspace-thin-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Membership review</h2>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {memberships.length === 0 ? <p className="ui-text-secondary">No memberships to review.</p> : null}
            {memberships.map((membership) => (
              <article key={membership.membershipId} className="ui-workspace-thin-page__list-card">
                <div className="ui-stack ui-stack--2xs">
                  <strong>{membership.userIdentityId}</strong>
                  <span className="ui-text-secondary ui-text-small">
                    status: {membership.status} | roles: {membership.activeRoles.join(", ") || "none"}
                  </span>
                </div>
                <div className="ui-workspace-thin-page__list-card-actions">
                  <select
                    className="ui-select ui-select--sm"
                    value={membershipDrafts[membership.userIdentityId] ?? membership.status}
                    disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageMembers || isMutating}
                    onChange={(event) => {
                      const nextStatus = event.target.value as WorkspaceMembershipApiRecord["status"];
                      setMembershipDrafts((current) => Object.freeze({
                        ...current,
                        [membership.userIdentityId]: nextStatus,
                      }));
                    }}
                  >
                    {membershipStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageMembers || isMutating}
                    onClick={() => {
                      if (!selectedWorkspaceId) {
                        return;
                      }
                      const nextStatus = membershipDrafts[membership.userIdentityId] ?? membership.status;
                      void runMutation(async () => {
                        const response = await service.changeWorkspaceMembershipStatus({
                          workspaceId: selectedWorkspaceId,
                          targetUserIdentityId: membership.userIdentityId,
                          status: nextStatus,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to update membership status.");
                          return;
                        }
                        setStatusMessage(`Updated ${membership.userIdentityId} to ${nextStatus}.`);
                        await refreshWorkspaceDetails(selectedWorkspaceId);
                      });
                    }}
                  >
                    Save status
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--danger ui-button--sm"
                    disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageMembers || isMutating}
                    onClick={() => {
                      if (!selectedWorkspaceId) {
                        return;
                      }
                      void runMutation(async () => {
                        const response = await service.removeWorkspaceMember({
                          workspaceId: selectedWorkspaceId,
                          targetUserIdentityId: membership.userIdentityId,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to remove workspace member.");
                          return;
                        }
                        setStatusMessage(`Removed ${membership.userIdentityId} from workspace.`);
                        await refreshWorkspaceDetails(selectedWorkspaceId);
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Invitation status</h2>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <div className="ui-workspace-thin-page__invite-row">
              <label className="ui-field">
                <span className="ui-field__label">Invite email</span>
                <input
                  className="ui-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating}
                />
              </label>
              <label className="ui-field">
                <span className="ui-field__label">Role</span>
                <select
                  className="ui-select"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as (typeof invitationRoleOptions)[number])}
                  disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating}
                >
                  {invitationRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating}
                onClick={() => {
                  if (!selectedWorkspaceId) {
                    return;
                  }
                  void runMutation(async () => {
                    const invitedEmail = inviteEmail.trim();
                    if (!invitedEmail) {
                      setErrorMessage("Invitation email is required.");
                      return;
                    }
                    const response = await service.issueWorkspaceInvitation({
                      workspaceId: selectedWorkspaceId,
                      invitedEmail,
                      invitedRoles: [inviteRole],
                      expiresInMs: 14 * 24 * 60 * 60 * 1000,
                    }, sessionToken);
                    if (!response.ok || !response.data) {
                      setErrorMessage(response.error?.message ?? "Unable to issue workspace invitation.");
                      return;
                    }
                    setInviteEmail("");
                    setStatusMessage(`Invitation issued for ${response.data.invitation.invitedEmail}.`);
                    setLatestInvitationPath(
                      buildWorkspaceInvitationAcceptPath(selectedWorkspaceId, response.data.invitationToken),
                    );
                    await refreshWorkspaceDetails(selectedWorkspaceId);
                  });
                }}
              >
                Issue invite
              </button>
            </div>

            {invitations.length === 0 ? <p className="ui-text-secondary">No invitations found.</p> : null}
            {invitations.map((invitation) => (
              <article key={invitation.invitationId} className="ui-workspace-thin-page__list-card">
                <div className="ui-stack ui-stack--2xs">
                  <strong>{invitation.invitedEmail}</strong>
                  <span className="ui-text-secondary ui-text-small">
                    status: {invitation.status} | roles: {invitation.invitedRoles.join(", ")}
                  </span>
                  <span className="ui-text-secondary ui-text-small">expires: {formatCompactDateTime(invitation.expiresAt)}</span>
                </div>
                <div className="ui-workspace-thin-page__list-card-actions">
                  <button
                    type="button"
                    className="ui-button ui-button--danger ui-button--sm"
                    disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating || invitation.status !== "pending"}
                    onClick={() => {
                      if (!selectedWorkspaceId) {
                        return;
                      }
                      void runMutation(async () => {
                        const response = await service.cancelWorkspaceInvitation({
                          workspaceId: selectedWorkspaceId,
                          invitationId: invitation.invitationId,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to cancel invitation.");
                          return;
                        }
                        setStatusMessage(`Cancelled invite for ${invitation.invitedEmail}.`);
                        await refreshWorkspaceDetails(selectedWorkspaceId);
                      });
                    }}
                  >
                    Cancel invite
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function formatCompactDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

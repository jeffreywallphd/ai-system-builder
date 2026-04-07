import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  WorkspaceAdminListItemApiRecord,
  WorkspaceInvitationApiRecord,
  WorkspaceMembershipApiRecord,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { presentWorkspaceAdministrationCapabilities } from "../presenters/WorkspaceAdministrationCapabilitiesPresenter";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { WorkspaceAdministrationService } from "../services/WorkspaceAdministrationService";
import {
  IdentityAuthSessionCoordinator,
  IdentitySessionBootstrapStatus,
} from "@shared/identity/IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";
import { buildWorkspaceInvitationAcceptPath } from "../web/workspaces/WorkspaceThinClientRoutes";
import { SurfaceStatePanel } from "../shared/components/presentation-state";
import {
  WorkspaceListPanel,
  WorkspaceMembershipAdministrationPanel,
  WorkspaceOperationalContextPanel,
  workspaceAssignableRoleOptions,
  type WorkspaceAssignableRole,
} from "@ui/shared/workspaces/WorkspaceAdministrationPanels";

interface WorkspaceMembershipThinClientPageProps {
  readonly service?: WorkspaceAdministrationService;
  readonly authService?: IdentityAuthService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function WorkspaceMembershipThinClientPage(props: WorkspaceMembershipThinClientPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new WorkspaceAdministrationService(), [props.service]);
  const authService = useMemo(() => props.authService ?? new IdentityAuthService(), [props.authService]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const sessionCoordinator = useMemo(
    () => new IdentityAuthSessionCoordinator(sessionStore, authService),
    [authService, sessionStore],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspaceId")?.trim() || undefined;
  const [session, setSession] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [workspaces, setWorkspaces] = useState<ReadonlyArray<WorkspaceAdminListItemApiRecord>>(Object.freeze([]));
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => requestedWorkspaceId ?? session?.workspaceContext?.resolvedWorkspaceId);
  const [memberships, setMemberships] = useState<ReadonlyArray<WorkspaceMembershipApiRecord>>(Object.freeze([]));
  const [invitations, setInvitations] = useState<ReadonlyArray<WorkspaceInvitationApiRecord>>(Object.freeze([]));
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceAssignableRole>("member");
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
          : requestedWorkspaceId && fetchedWorkspaces.some((entry) => entry.workspaceId === requestedWorkspaceId)
            ? requestedWorkspaceId
            : fetchedWorkspaces[0]?.workspaceId);
      setSelectedWorkspaceId(workspaceId);

      if (!workspaceId) {
        setMemberships(Object.freeze([]));
        setInvitations(Object.freeze([]));
        return;
      }

      await refreshWorkspaceDetails(workspaceId, fetchedWorkspaces);
    } catch {
      setErrorMessage("Workspace membership request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectWorkspace = (nextWorkspaceId: string): void => {
    const normalizedWorkspaceId = nextWorkspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    setSelectedWorkspaceId(normalizedWorkspaceId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("workspaceId", normalizedWorkspaceId);
      return next;
    }, { replace: true });

    void sessionCoordinator.refreshIfAuthenticated({ workspaceId: normalizedWorkspaceId }).then((result) => {
      if (result.status === IdentitySessionBootstrapStatus.authenticated) {
        setSession(result.session);
      }
    });
    void refreshWorkspaceDetails(normalizedWorkspaceId);
  };

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh();
  }, [requestedWorkspaceId, sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let cancelled = false;
    const syncSessionContext = async (): Promise<void> => {
      const result = await sessionCoordinator.bootstrap({ workspaceId: requestedWorkspaceId });
      if (cancelled) {
        return;
      }
      if (result.status === IdentitySessionBootstrapStatus.authenticated) {
        setSession(result.session);
        const resolvedWorkspaceId = result.session.workspaceContext?.resolvedWorkspaceId;
        if (resolvedWorkspaceId && !selectedWorkspaceId) {
          setSelectedWorkspaceId(resolvedWorkspaceId);
        }
      }
    };

    void syncSessionContext();
    return () => {
      cancelled = true;
    };
  }, [requestedWorkspaceId, selectedWorkspaceId, sessionCoordinator, sessionToken]);

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
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Workspace memberships",
            message: "Sign in with an authenticated account before managing workspace memberships and invitations.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-workspace-thin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workspace memberships</h1>
          <p className="ui-page__subtitle">
            Lightweight workspace member, role, and invitation operations for web and mobile-responsive admin-lite surfaces.
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
          <WorkspaceListPanel
            surface="thin-client"
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            isLoading={isLoading}
            onSelectWorkspace={selectWorkspace}
          />
          <WorkspaceOperationalContextPanel workspace={selectedWorkspace} capabilities={workspaceCapabilities} />
        </div>
      </section>

      <div className="ui-workspace-thin-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Membership management</h2>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <WorkspaceMembershipAdministrationPanel
              surface="thin-client"
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
                  setStatusMessage(`Added member ${input.targetUserIdentityId}.`);
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
                    setErrorMessage(response.error?.message ?? "Unable to update membership status.");
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
                  onChange={(event) => setInviteRole(event.target.value as WorkspaceAssignableRole)}
                  disabled={!selectedWorkspaceId || !workspaceCapabilities.canManageInvitations || isMutating}
                >
                  {workspaceAssignableRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
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

import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { WorkspaceAdministrationService } from "../services/WorkspaceAdministrationService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

export default function WorkspaceInvitationOnboardingPage(): JSX.Element {
  const { workspaceId, invitationToken } = useParams<{ workspaceId: string; invitationToken: string }>();
  const service = useMemo(() => new WorkspaceAdministrationService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const location = useLocation();

  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;
  const [tokenValue, setTokenValue] = useState(invitationToken ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [acceptResult, setAcceptResult] = useState<{
    readonly invitationStatus: string;
    readonly membershipStatus?: string;
    readonly roleNames: string;
  }>();

  const isAuthenticated = Boolean(sessionToken && session && !sessionStore.isSessionExpired(session));
  const normalizedWorkspaceId = workspaceId?.trim();

  const submitAcceptance = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    if (!isAuthenticated || !sessionToken || !normalizedWorkspaceId) {
      return;
    }

    const normalizedToken = tokenValue.trim();
    if (!normalizedToken) {
      setErrorMessage("Invitation token is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await service.acceptWorkspaceInvitationOnboarding({
        workspaceId: normalizedWorkspaceId,
        invitationToken: normalizedToken,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setErrorMessage(response.error?.message ?? "Unable to accept this invitation.");
        return;
      }

      setAcceptResult(
        Object.freeze({
          invitationStatus: response.data.invitation.status,
          membershipStatus: response.data.membership?.status,
          roleNames: response.data.createdRoleAssignments.map((assignment) => assignment.role).join(", "),
        }),
      );
      setStatusMessage("Workspace invitation accepted.");
    } catch {
      setErrorMessage("Workspace onboarding request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!normalizedWorkspaceId) {
    return (
      <section className="ui-page ui-workspace-thin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Workspace invitation</h1>
            <p className="ui-card__subtitle">The invitation link is missing a workspace id.</p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.settings}>Open settings</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="ui-page ui-workspace-thin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Workspace invitation</h1>
            <p className="ui-card__subtitle">
              Sign in before accepting this workspace invitation.
            </p>
          </div>
          <div className="ui-card__body ui-page__actions">
            <Link
              className="ui-button ui-button--primary"
              to={ROUTE_PATHS.login}
              state={{ from: location.pathname }}
            >
              Go to sign in
            </Link>
            <Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.register}>Create account</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-workspace-thin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Workspace invitation</h1>
          <p className="ui-page__subtitle">Accept your invitation to join workspace {normalizedWorkspaceId}.</p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.workspaceThinMembership}>Open memberships</Link>
        </div>
      </div>

      {errorMessage ? <p className="ui-workspace-thin-page__alert ui-workspace-thin-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-workspace-thin-page__alert ui-workspace-thin-page__alert--success" role="status">{statusMessage}</p> : null}

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Accept invitation</h2>
        </div>
        <form className="ui-card__body ui-stack ui-stack--sm" onSubmit={(event) => void submitAcceptance(event)}>
          <label className="ui-field">
            <span className="ui-field__label">Invitation token</span>
            <input
              className="ui-input"
              value={tokenValue}
              onChange={(event) => setTokenValue(event.target.value)}
              placeholder="Paste invitation token"
            />
          </label>
          <button type="submit" className="ui-button ui-button--primary ui-button--sm" disabled={isSubmitting}>
            {isSubmitting ? "Accepting..." : "Accept invitation"}
          </button>

          {acceptResult ? (
            <div className="ui-workspace-thin-page__result">
              <p className="ui-text-secondary ui-text-small">invitation status: {acceptResult.invitationStatus}</p>
              <p className="ui-text-secondary ui-text-small">membership status: {acceptResult.membershipStatus ?? "n/a"}</p>
              <p className="ui-text-secondary ui-text-small">roles: {acceptResult.roleNames || "none"}</p>
            </div>
          ) : null}
        </form>
      </section>
    </section>
  );
}


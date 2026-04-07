import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthorizationWorkspaceSharingReportApiResponse } from "@infrastructure/api/authorization/sdk/PublicAuthorizationManagementApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { AuthorizationManagementService } from "../services/AuthorizationManagementService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

interface AuthorizationReportingPageProps {
  readonly service?: AuthorizationManagementService;
  readonly sessionStore?: IdentityAuthSessionStore;
}

export default function AuthorizationReportingPage(props: AuthorizationReportingPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new AuthorizationManagementService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;
  const [workspaceId, setWorkspaceId] = useState("workspace-1");
  const [includeRevokedRoleAssignments, setIncludeRevokedRoleAssignments] = useState(true);
  const [includeRevokedSharingGrants, setIncludeRevokedSharingGrants] = useState(true);
  const [report, setReport] = useState<AuthorizationWorkspaceSharingReportApiResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadReport = async (): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      setErrorMessage("Workspace id is required.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const response = await service.readWorkspaceSharingReport({
        workspaceId: normalizedWorkspaceId,
        includeRevokedRoleAssignments,
        includeRevokedSharingGrants,
        recentSharingMutationsLimit: 25,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setReport(undefined);
        setErrorMessage(response.error?.message ?? "Unable to load authorization reporting.");
        return;
      }
      setReport(response.data);
    } catch {
      setReport(undefined);
      setErrorMessage("Unable to load authorization reporting.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-authorization-reporting-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Authorization reporting</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated admin-capable account before reviewing authorization and sharing posture.
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
    <section className="ui-page ui-authorization-reporting-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Authorization reporting</h1>
          <p className="ui-page__subtitle">
            Review workspace role assignment posture, unusual visibility patterns, and recent sharing mutations.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading} onClick={() => { void loadReport(); }}>
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-authorization-reporting-page__alert ui-authorization-reporting-page__alert--error" role="alert">{errorMessage}</p> : null}

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Report query</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-authorization-reporting-page__field-grid">
            <label className="ui-field">
              <span className="ui-field__label">Workspace id</span>
              <input className="ui-input" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} />
            </label>
          </div>
          <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor="authorization-reporting-include-revoked-roles">
            <input
              id="authorization-reporting-include-revoked-roles"
              className="ui-checkbox"
              type="checkbox"
              checked={includeRevokedRoleAssignments}
              onChange={(event) => setIncludeRevokedRoleAssignments(event.target.checked)}
            />
            <span className="ui-field__hint">Include revoked role assignments</span>
          </label>
          <label className="ui-row ui-row--sm ui-settings-page__checkbox" htmlFor="authorization-reporting-include-revoked-grants">
            <input
              id="authorization-reporting-include-revoked-grants"
              className="ui-checkbox"
              type="checkbox"
              checked={includeRevokedSharingGrants}
              onChange={(event) => setIncludeRevokedSharingGrants(event.target.checked)}
            />
            <span className="ui-field__hint">Include revoked sharing grants in mutation history</span>
          </label>
          <button type="button" className="ui-button ui-button--primary ui-button--sm" disabled={isLoading} onClick={() => { void loadReport(); }}>
            {isLoading ? "Loading..." : "Load report"}
          </button>
        </div>
      </section>

      {report ? (
        <>
          <section className="ui-card">
            <div className="ui-card__header">
              <h2 className="ui-card__title">Workspace visibility posture</h2>
              <p className="ui-card__subtitle">As of {formatDate(report.asOf)}.</p>
            </div>
            <div className="ui-card__body">
              <dl className="ui-meta-grid">
                <div className="ui-meta-item"><dt className="ui-meta-label">Private</dt><dd className="ui-meta-value">{report.resourceVisibilityDistribution.private}</dd></div>
                <div className="ui-meta-item"><dt className="ui-meta-label">Workspace</dt><dd className="ui-meta-value">{report.resourceVisibilityDistribution.workspace}</dd></div>
                <div className="ui-meta-item"><dt className="ui-meta-label">Shared</dt><dd className="ui-meta-value">{report.resourceVisibilityDistribution.shared}</dd></div>
                <div className="ui-meta-item"><dt className="ui-meta-label">Published</dt><dd className="ui-meta-value">{report.resourceVisibilityDistribution.published}</dd></div>
                <div className="ui-meta-item"><dt className="ui-meta-label">Total resources</dt><dd className="ui-meta-value">{report.resourceVisibilityDistribution.total}</dd></div>
              </dl>
            </div>
          </section>

          <section className="ui-card">
            <div className="ui-card__header">
              <h2 className="ui-card__title">Role assignments</h2>
            </div>
            <div className="ui-card__body">
              {report.roleAssignments.length === 0 ? <p className="ui-text-secondary">No role assignments found for this workspace.</p> : (
                <div className="ui-table-wrapper">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">User</th>
                        <th scope="col">Role</th>
                        <th scope="col">Status</th>
                        <th scope="col">Scope</th>
                        <th scope="col">Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.roleAssignments.map((assignment) => (
                        <tr key={assignment.roleAssignmentId}>
                          <td>{assignment.actorUserIdentityId}</td>
                          <td>{assignment.roleKey}</td>
                          <td>{assignment.status}</td>
                          <td>{assignment.scope}</td>
                          <td>{formatDate(assignment.assignedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="ui-card">
            <div className="ui-card__header">
              <h2 className="ui-card__title">Unusual visibility patterns</h2>
            </div>
            <div className="ui-card__body">
              {report.unusualVisibilityPatterns.length === 0 ? <p className="ui-text-secondary">No unusual visibility patterns detected.</p> : (
                <div className="ui-table-wrapper">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">Resource</th>
                        <th scope="col">Visibility</th>
                        <th scope="col">Sharing policy</th>
                        <th scope="col">Active grants</th>
                        <th scope="col">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.unusualVisibilityPatterns.map((pattern) => (
                        <tr key={`${pattern.resource.resourceFamily}:${pattern.resource.resourceType}:${pattern.resource.resourceId}`}>
                          <td>{`${pattern.resource.resourceFamily}/${pattern.resource.resourceType}/${pattern.resource.resourceId}`}</td>
                          <td>{pattern.visibility}</td>
                          <td>{pattern.sharingPolicyMode}</td>
                          <td>{pattern.activeSharingGrantCount}</td>
                          <td>{pattern.reasonCodes.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="ui-card">
            <div className="ui-card__header">
              <h2 className="ui-card__title">Recent sharing mutations</h2>
            </div>
            <div className="ui-card__body">
              {report.recentSharingMutations.length === 0 ? <p className="ui-text-secondary">No sharing mutations found.</p> : (
                <div className="ui-table-wrapper">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Mutation</th>
                        <th scope="col">Resource</th>
                        <th scope="col">Target</th>
                        <th scope="col">Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recentSharingMutations.map((mutation) => (
                        <tr key={`${mutation.grantId}:${mutation.mutationType}:${mutation.occurredAt}`}>
                          <td>{formatDate(mutation.occurredAt)}</td>
                          <td>{mutation.mutationType}</td>
                          <td>{`${mutation.resource.resourceFamily}/${mutation.resource.resourceType}/${mutation.resource.resourceId}`}</td>
                          <td>{formatSharingTarget(mutation.target)}</td>
                          <td>{mutation.actorUserIdentityId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

function formatSharingTarget(
  target: AuthorizationWorkspaceSharingReportApiResponse["recentSharingMutations"][number]["target"],
): string {
  if (target.kind === "user") {
    return `user:${target.userId}`;
  }
  if (target.kind === "workspace-role") {
    return `workspace-role:${target.workspaceId}:${target.roleKey}`;
  }
  if (target.kind === "workspace") {
    return `workspace:${target.workspaceId}`;
  }
  return "public";
}


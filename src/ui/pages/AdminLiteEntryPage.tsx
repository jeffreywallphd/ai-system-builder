import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ThinClientOperationalSurfaceFrame from "@ui/web/shell/ThinClientOperationalSurfaceFrame";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@ui/shared/identity/IdentityAuthSessionStore";
import { UiSurfaceKeys } from "@ui/shared/navigation/SurfaceNavigationMetadata";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { listSettingsShortcutRouteMetadata } from "@ui/routes/SurfaceRouteMetadataCatalog";
import { resolveNavigationAvailabilityContextForSession } from "@ui/routes/SurfaceRouteAccessPolicy";

const adminLiteRouteKeys = new Set([
  "authorization-sharing-thin",
  "workspace-thin-membership",
  "node-enrollment-review",
  "node-inventory",
  "trusted-devices",
  "governance-review-thin",
]);

const adminLiteRouteOrder = Object.freeze([
  "node-enrollment-review",
  "node-inventory",
  "workspace-thin-membership",
  "authorization-sharing-thin",
  "governance-review-thin",
  "trusted-devices",
]);

const adminLiteWorkflowSummaries = Object.freeze({
  "node-enrollment-review": Object.freeze({
    description: "Approve or reject pending node enrollments from constrained operational surfaces.",
    tags: Object.freeze(["Approvals", "Operational trust"]),
  }),
  "node-inventory": Object.freeze({
    description: "Review trusted-node operational and presence status without desktop-only disable actions.",
    tags: Object.freeze(["Status review", "Node trust"]),
  }),
  "workspace-thin-membership": Object.freeze({
    description: "Review memberships and apply limited status changes for selected workspace members.",
    tags: Object.freeze(["Limited membership", "Workspace"]),
  }),
  "authorization-sharing-thin": Object.freeze({
    description: "Inspect and adjust sharing posture for allowed resources from thin-client sessions.",
    tags: Object.freeze(["Policy inspection", "Sharing"]),
  }),
  "governance-review-thin": Object.freeze({
    description: "Inspect thin-safe governance and audit events with redacted policy context.",
    tags: Object.freeze(["Policy inspection", "Audit visibility"]),
  }),
  "trusted-devices": Object.freeze({
    description: "Review active device trust and revoke personal trusted devices when needed.",
    tags: Object.freeze(["Session trust", "Self-service"]),
  }),
} as const);

const desktopOnlyWorkflows = Object.freeze([
  "Security and policy configuration",
  "Deployment profile and policy administration",
  "Identity administration and account lifecycle controls",
  "Storage instance administration",
  "Secret metadata administration",
  "Node trust revocation/disable operations",
  "Full membership role assignment and member removal",
]);

interface AdminLiteEntryPageProps {
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function AdminLiteEntryPage(props: AdminLiteEntryPageProps = {}): JSX.Element {
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());

  if (!session || !session.sessionToken || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Admin lite",
            message: "Sign in with an authenticated thin-client workspace session before using admin-lite workflows.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  const accessContext = resolveNavigationAvailabilityContextForSession(session, {
    preferredSurface: UiSurfaceKeys.adminLite,
    strict: true,
  });
  const routes = listSettingsShortcutRouteMetadata(accessContext)
    .filter((route) => adminLiteRouteKeys.has(route.key))
    .sort((left, right) => (
      adminLiteRouteOrder.indexOf(left.key) - adminLiteRouteOrder.indexOf(right.key)
    ));

  const content = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Thin-client admin-lite workflows</h2>
        <p className="ui-card__subtitle">
          Use bounded lightweight administration workflows for approvals, status review, limited membership actions, and policy inspection.
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--md">
        {routes.length < 1 ? (
          <SurfaceStatePanel
            state={Object.freeze({
              kind: "permission-denied",
              title: "No admin-lite workflows available",
              message: "Your current workspace role or capability scope does not include any thin administration actions.",
            })}
          />
        ) : (
          <div className="ui-admin-lite-entry__workflow-grid">
            {routes.map((route) => {
              const summary = adminLiteWorkflowSummaries[route.key as keyof typeof adminLiteWorkflowSummaries];
              return (
                <article key={route.key} className="ui-admin-lite-entry__workflow-card">
                  <div className="ui-stack ui-stack--2xs">
                    <h3 className="ui-card__title">{route.title}</h3>
                    <p className="ui-text-secondary">{summary?.description ?? "Open lightweight thin-client administration workflow."}</p>
                    <div className="ui-admin-lite-entry__workflow-tags">
                      {(summary?.tags ?? Object.freeze(["Admin-lite"])).map((tag) => <span key={tag} className="ui-badge ui-badge--neutral">{tag}</span>)}
                    </div>
                  </div>
                  <Link className="ui-button ui-button--secondary ui-button--sm" to={route.path}>Open workflow</Link>
                </article>
              );
            })}
          </div>
        )}
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--ghost ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
        </div>
      </div>
    </section>
  );

  const detail = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Escalation path</h2>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <p className="ui-text-secondary">Desktop-only administration capabilities:</p>
        <ul className="ui-admin-lite-entry__desktop-scope-list">
          {desktopOnlyWorkflows.map((workflow) => <li key={workflow}>{workflow}</li>)}
        </ul>
        <p className="ui-text-secondary">Need one of these workflows? Open desktop administration.</p>
        <Link className="ui-button ui-button--ghost ui-button--sm" to={ROUTE_PATHS.adminShell}>Open desktop administration</Link>
      </div>
    </section>
  );

  return (
    <ThinClientOperationalSurfaceFrame
      title="Admin lite"
      subtitle="Mobile and thin-client administration entry points for lightweight operations."
      navigation={null}
      content={content}
      detail={detail}
    />
  );
}

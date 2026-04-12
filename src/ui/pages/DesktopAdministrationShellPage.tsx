import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DesktopAdminSurfaceFrame from "@ui/desktop/shell/DesktopAdminSurfaceFrame";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";
import { UiSurfaceKeys } from "@ui/shared/navigation/SurfaceNavigationMetadata";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { listSettingsShortcutRouteMetadata } from "@ui/routes/SurfaceRouteMetadataCatalog";
import { resolveNavigationAvailabilityContextForSession } from "@ui/routes/SurfaceRouteAccessPolicy";

export default function DesktopAdministrationShellPage(): JSX.Element {
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());

  if (!session || !session.sessionToken || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Administration",
            message: "Sign in with a desktop administrative session before opening administration workflows.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  const accessContext = resolveNavigationAvailabilityContextForSession(session, {
    preferredSurface: UiSurfaceKeys.desktopAdmin,
    strict: true,
  });
  const adminRoutes = listSettingsShortcutRouteMetadata(accessContext)
    .filter((route) => route.key !== "admin-shell" && route.key !== "admin-lite-shell");
  const workspaceId = session.workspaceContext?.resolvedWorkspaceId
    ?? session.workspaceContext?.requestedWorkspaceId
    ?? session.initialCapabilityState?.workspaceId;

  const navigation = (
    <div className="ui-stack ui-stack--sm">
      {adminRoutes.map((route) => (
        <Link key={route.key} className="ui-button ui-button--secondary ui-button--sm" to={route.path}>
          {route.title}
        </Link>
      ))}
    </div>
  );

  const content = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Desktop administration workflows</h2>
        <p className="ui-card__subtitle">
          Use one administration frame to access trust, workspace, identity, security, and policy workflows without scattered entry points.
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <p className="ui-text-secondary">
          Authorized routes are projected from centralized navigation metadata with strict role/capability checks.
        </p>
        <p className="ui-text-secondary">
          Thin-client operators can use lightweight administration at <Link to={ROUTE_PATHS.adminLiteShell}>Admin lite entry</Link>.
        </p>
      </div>
    </section>
  );

  const detail = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Session scope</h2>
      </div>
      <div className="ui-card__body ui-stack ui-stack--2xs">
        <div><strong>User:</strong> <span className="ui-text-secondary">{session.username}</span></div>
        <div><strong>Workspace:</strong> <span className="ui-text-secondary">{workspaceId ?? "None selected"}</span></div>
        <div><strong>Surface:</strong> <span className="ui-text-secondary">desktop-admin</span></div>
      </div>
    </section>
  );

  return (
    <DesktopAdminSurfaceFrame
      title="Administration"
      subtitle="Production desktop administration shell for security, workspace, node, and policy operations."
      navigation={navigation}
      content={content}
      detail={detail}
    />
  );
}

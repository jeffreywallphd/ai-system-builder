import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ThinClientOperationalSurfaceFrame from "@ui/web/shell/ThinClientOperationalSurfaceFrame";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";
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
]);

export default function AdminLiteEntryPage(): JSX.Element {
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
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
    .filter((route) => adminLiteRouteKeys.has(route.key));

  const content = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Thin-client admin-lite workflows</h2>
        <p className="ui-card__subtitle">
          Lightweight policy, trust, and membership administration entry points for constrained surfaces.
        </p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--sm">
        {routes.map((route) => (
          <Link key={route.key} className="ui-button ui-button--secondary ui-button--sm" to={route.path}>
            {route.title}
          </Link>
        ))}
      </div>
    </section>
  );

  const detail = (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">Escalation path</h2>
      </div>
      <div className="ui-card__body ui-stack ui-stack--2xs">
        <p className="ui-text-secondary">Need full administration workflows? Open desktop administration.</p>
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

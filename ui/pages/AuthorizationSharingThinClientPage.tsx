import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AuthorizationResourceFamily } from "../../src/domain/authorization/AuthorizationPermissionCatalog";
import AuthorizationSharingManagementPanel from "../components/authorization/AuthorizationSharingManagementPanel";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import type { AuthorizationManagementService } from "../services/AuthorizationManagementService";
import { IdentityAuthSessionStore } from "../shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "../shared/identity/IdentityAuthSessionStore";
import { buildAuthorizationSharingDesktopPath } from "../web/authorization/AuthorizationSharingRoutes";

interface AuthorizationSharingThinClientPageProps {
  readonly service?: AuthorizationManagementService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function AuthorizationSharingThinClientPage(props: AuthorizationSharingThinClientPageProps = {}): JSX.Element {
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const [searchParams] = useSearchParams();
  const sessionToken = session?.sessionToken;

  const resourceFamily = parseResourceFamily(searchParams.get("resourceFamily")) ?? "asset";
  const resourceType = (searchParams.get("resourceType") ?? "asset").trim() || "asset";
  const resourceId = (searchParams.get("resourceId") ?? "").trim();
  const workspaceId = (searchParams.get("workspaceId") ?? "").trim();
  const desktopPath = resourceId
    ? buildAuthorizationSharingDesktopPath({
      resourceFamily,
      resourceType,
      resourceId,
      workspaceId: workspaceId || undefined,
    })
    : ROUTE_PATHS.authorizationSharing;

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-authorization-thin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Sharing access review</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated account before reviewing sharing and visibility access.
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
    <section className="ui-page ui-authorization-thin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Sharing access review</h1>
          <p className="ui-page__subtitle">
            Compact sharing controls for web and mobile surfaces.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={desktopPath}>
            Open full desktop view
          </Link>
        </div>
      </div>

      <AuthorizationSharingManagementPanel
        sessionToken={sessionToken}
        service={props.service}
        compact
        initialResource={resourceId ? Object.freeze({
          resourceFamily,
          resourceType,
          resourceId,
          workspaceId: workspaceId || undefined,
        }) : undefined}
      />
    </section>
  );
}

function parseResourceFamily(value: string | null): AuthorizationResourceFamily | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  const options = new Set<AuthorizationResourceFamily>([
    "asset",
    "system",
    "workflow",
    "template",
    "run",
    "queue",
    "log",
    "storage-instance",
    "secret-metadata",
    "artifact",
  ]);
  return options.has(normalized as AuthorizationResourceFamily) ? normalized as AuthorizationResourceFamily : undefined;
}

import type { AuthorizationResourceFamily } from "../../../domain/authorization/AuthorizationPermissionCatalog";
import { ROUTE_PATHS } from "../../routes/RouteConfig";

export function buildAuthorizationSharingThinClientPath(resource: {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
}): string {
  const query = new URLSearchParams();
  query.set("resourceFamily", resource.resourceFamily);
  query.set("resourceType", resource.resourceType);
  query.set("resourceId", resource.resourceId);
  if (resource.workspaceId) {
    query.set("workspaceId", resource.workspaceId);
  }

  return `${ROUTE_PATHS.authorizationSharingThin}?${query.toString()}`;
}

export function buildAuthorizationSharingDesktopPath(resource: {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly workspaceId?: string;
}): string {
  const query = new URLSearchParams();
  query.set("resourceFamily", resource.resourceFamily);
  query.set("resourceType", resource.resourceType);
  query.set("resourceId", resource.resourceId);
  if (resource.workspaceId) {
    query.set("workspaceId", resource.workspaceId);
  }

  return `${ROUTE_PATHS.authorizationSharing}?${query.toString()}`;
}

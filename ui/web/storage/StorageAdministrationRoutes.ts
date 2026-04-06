import { ROUTE_PATHS } from "../../routes/RouteConfig";

export function buildStorageAdministrationPath(request: {
  readonly workspaceId: string;
  readonly storageInstanceId?: string;
}): string {
  const query = new URLSearchParams();
  query.set("workspaceId", request.workspaceId);
  if (request.storageInstanceId) {
    query.set("storageInstanceId", request.storageInstanceId);
  }
  return `${ROUTE_PATHS.storageAdmin}?${query.toString()}`;
}

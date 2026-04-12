export function doesPathMatchRoutePrefix(path: string, routePrefix: string): boolean {
  if (!path || !routePrefix) {
    return false;
  }
  if (!path.startsWith(routePrefix)) {
    return false;
  }
  if (path.length === routePrefix.length) {
    return true;
  }
  return path[routePrefix.length] === "/";
}

export function doesPathMatchRoutePrefix(path: string, routePrefix: string): boolean {
  if (!path || !routePrefix) {
    return false;
  }
  if (routePrefix.includes("{") && routePrefix.includes("}")) {
    const pathSegments = path.split("/").filter((segment) => segment.length > 0);
    const prefixSegments = routePrefix.split("/").filter((segment) => segment.length > 0);
    if (pathSegments.length < prefixSegments.length) {
      return false;
    }
    for (let index = 0; index < prefixSegments.length; index += 1) {
      const prefixSegment = prefixSegments[index]!;
      const pathSegment = pathSegments[index]!;
      const isPlaceholder = prefixSegment.startsWith("{") && prefixSegment.endsWith("}");
      if (isPlaceholder) {
        if (!pathSegment) {
          return false;
        }
        continue;
      }
      if (prefixSegment !== pathSegment) {
        return false;
      }
    }
    return true;
  }
  if (!path.startsWith(routePrefix)) {
    return false;
  }
  if (path.length === routePrefix.length) {
    return true;
  }
  return path[routePrefix.length] === "/";
}

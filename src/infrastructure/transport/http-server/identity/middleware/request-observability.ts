import type { IdentityHttpRouteRegistrySnapshotDto } from "../dto/IdentityHttpRouteRegistryDtos";

export interface IdentityHttpRouteCompositionLogDetails {
  readonly routeFamilyIds: ReadonlyArray<string>;
  readonly routePrefixes: ReadonlyArray<string>;
  readonly routeFamilies: ReadonlyArray<{
    readonly routeFamilyId: string;
    readonly domain: string;
    readonly routePrefixes: ReadonlyArray<string>;
  }>;
}

export function buildIdentityHttpRouteCompositionLogDetails(
  routeRegistrySnapshot: IdentityHttpRouteRegistrySnapshotDto,
): IdentityHttpRouteCompositionLogDetails {
  return Object.freeze({
    routeFamilyIds: Object.freeze(routeRegistrySnapshot.routeFamilies.map((family) => family.routeFamilyId)),
    routePrefixes: Object.freeze(routeRegistrySnapshot.routePrefixes.map((entry) => entry.routePrefix)),
    routeFamilies: Object.freeze(routeRegistrySnapshot.routeFamilies.map((family) => Object.freeze({
      routeFamilyId: family.routeFamilyId,
      domain: family.domain,
      routePrefixes: family.routePrefixes,
    }))),
  });
}

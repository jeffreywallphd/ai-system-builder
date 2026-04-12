import type {
  AuthoritativeApiRouteDomain,
  AuthoritativeApiRouteFamilyRegistration,
} from "../../AuthoritativeApiRouteRegistration";

export interface IdentityHttpRegisteredRoutePrefixDto {
  readonly routeFamilyId: string;
  readonly routePrefix: string;
}

export interface IdentityHttpRouteFamilySummaryDto {
  readonly routeFamilyId: string;
  readonly domain: AuthoritativeApiRouteDomain;
  readonly description: string;
  readonly routePrefixes: ReadonlyArray<string>;
}

export interface IdentityHttpRouteRegistrySnapshotDto {
  readonly routeFamilies: ReadonlyArray<IdentityHttpRouteFamilySummaryDto>;
  readonly routePrefixes: ReadonlyArray<IdentityHttpRegisteredRoutePrefixDto>;
}

export function toIdentityHttpRouteFamilySummaryDto(
  routeFamily: AuthoritativeApiRouteFamilyRegistration,
): IdentityHttpRouteFamilySummaryDto {
  return Object.freeze({
    routeFamilyId: routeFamily.routeFamilyId,
    domain: routeFamily.domain,
    description: routeFamily.description,
    routePrefixes: routeFamily.routePrefixes,
  });
}

import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const AssetManagementAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "asset-management",
  domain: AuthoritativeApiRouteDomains.assets,
  description: "Asset registration, ingestion, discovery, and lifecycle endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/assets",
    "/api/v1/generated-results",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.assetManagement,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


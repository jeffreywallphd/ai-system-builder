import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const ImageAssetManagementAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "image-asset-management",
  domain: AuthoritativeApiRouteDomains.assets,
  description: "Image asset ingestion, metadata, and protected original-content APIs.",
  routePrefixes: Object.freeze([
    "/api/v1/image-assets",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.imageAssetManagement,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

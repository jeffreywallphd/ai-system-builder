import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const AuthorizationAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "authorization-management",
  domain: AuthoritativeApiRouteDomains.authorization,
  description: "Authorization policy visibility and sharing management endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/authorization",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.authorizationManagement,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


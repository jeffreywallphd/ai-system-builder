import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const IdentityAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "identity-auth",
  domain: AuthoritativeApiRouteDomains.identity,
  description: "Identity session and account lifecycle endpoints for desktop and thin clients.",
  routePrefixes: Object.freeze([
    "/api/v1/identity",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.identityAuth,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const RuntimeAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "system-runtime",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative runtime run-read and queue-read endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.systemRuntime,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

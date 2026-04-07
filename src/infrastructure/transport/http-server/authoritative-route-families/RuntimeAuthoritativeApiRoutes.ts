import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const RuntimeAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "system-runtime",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative runtime run control, queue control, and runtime read endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.systemRuntime,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const RunSubmissionAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "run-submission",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative run submission endpoint surface.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime/runs/start",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.runSubmission,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const RunReadAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "run-read",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative run read endpoints for list/detail/lifecycle visibility.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime/runs",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.runRead,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

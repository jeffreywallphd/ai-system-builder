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
  description: "Authoritative run and queue operational visibility read endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime/runs",
    "/api/v1/runtime/queue",
    "/api/v1/runtime/execution",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.runRead,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const RunMutationAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "run-mutation",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative run mutation endpoints for cancellation/retry orchestration intents.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime/runs/{runId}/cancel",
    "/api/v1/runtime/runs/{runId}/retry",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.runMutation,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const RunExecutionUpdateAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "run-execution-update",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative node-ingested run execution heartbeat/progress/lifecycle update endpoint.",
  routePrefixes: Object.freeze([
    "/api/v1/runtime/runs/{runId}/lifecycle",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.nodeTrust,
    AuthoritativeApiRouteBackendKeys.runExecutionUpdate,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const ImageRunAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "image-run-api",
  domain: AuthoritativeApiRouteDomains.runtime,
  description: "Authoritative image-run submission, query/list, and cancellation endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/image-systems",
    "/api/v1/image-runs",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.runSubmission,
    AuthoritativeApiRouteBackendKeys.runRead,
    AuthoritativeApiRouteBackendKeys.runMutation,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

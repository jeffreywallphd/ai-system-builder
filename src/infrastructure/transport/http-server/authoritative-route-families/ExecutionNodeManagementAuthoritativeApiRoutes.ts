import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const ExecutionNodeManagementAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "execution-node-management",
  domain: AuthoritativeApiRouteDomains.nodes,
  description: "Execution-node inventory, availability control, readiness, and eligibility endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/execution-nodes",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.executionNodeManagement,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

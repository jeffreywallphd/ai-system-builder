import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const DeploymentPolicyReadAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "deployment-policy-read",
  domain: AuthoritativeApiRouteDomains.deployment,
  description: "Authoritative deployment-policy administration read endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/deployment/policy/state",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.deploymentPolicyRead,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const DeploymentPolicyWriteAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "deployment-policy-write",
  domain: AuthoritativeApiRouteDomains.deployment,
  description: "Authoritative deployment-policy administration write endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/deployment/policy/active-profile",
    "/api/v1/deployment/policy/overrides",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

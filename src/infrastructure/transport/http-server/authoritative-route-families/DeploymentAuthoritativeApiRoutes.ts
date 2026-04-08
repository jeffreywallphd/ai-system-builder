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
    "/api/v1/deployment/policy",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.deploymentPolicyRead,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

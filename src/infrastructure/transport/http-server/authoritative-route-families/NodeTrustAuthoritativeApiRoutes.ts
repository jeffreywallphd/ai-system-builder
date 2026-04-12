import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const NodeTrustAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "node-trust",
  domain: AuthoritativeApiRouteDomains.nodes,
  description: "Node enrollment, trust, and runtime trust material endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/nodes",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.nodeTrust,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


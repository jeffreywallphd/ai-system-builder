import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const AuditLedgerAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "audit-ledger",
  domain: AuthoritativeApiRouteDomains.audit,
  description: "Authoritative governance and administrative audit ledger query/detail endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/audit",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.auditLedger,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


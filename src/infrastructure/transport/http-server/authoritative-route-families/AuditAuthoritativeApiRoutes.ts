import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const AuditLedgerAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "audit-ledger",
  domain: AuthoritativeApiRouteDomains.audit,
  description: "Authoritative audit ledger query/detail and governance projection endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/audit",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.auditLedger,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


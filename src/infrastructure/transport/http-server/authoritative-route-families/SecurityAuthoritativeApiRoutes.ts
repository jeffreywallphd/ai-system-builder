import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const SecurityCertificateAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "security-certificate-operations",
  domain: AuthoritativeApiRouteDomains.security,
  description: "Certificate authority and issued certificate operation endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/security/certificates",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.certificateOperations,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const SecuritySecretMetadataAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "security-secret-metadata",
  domain: AuthoritativeApiRouteDomains.security,
  description: "Secret metadata, diagnostics, and maintenance endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/security/secrets",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.secretMetadata,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


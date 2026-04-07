import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const StorageManagementAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "storage-management",
  domain: AuthoritativeApiRouteDomains.storage,
  description: "Storage instance provisioning and policy-aligned administration endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/storage",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.storageManagement,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;


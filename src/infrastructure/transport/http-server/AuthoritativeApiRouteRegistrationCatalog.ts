import {
  type AuthoritativeApiRouteBackendKey,
  type AuthoritativeApiRouteFamilyRegistration,
  type AuthoritativeApiRouteRegistrationPlan,
} from "./AuthoritativeApiRouteRegistration";
import { AssetManagementAuthoritativeApiRouteFamily } from "./authoritative-route-families/AssetAuthoritativeApiRoutes";
import { AuthorizationAuthoritativeApiRouteFamily } from "./authoritative-route-families/AuthorizationAuthoritativeApiRoutes";
import { IdentityAuthoritativeApiRouteFamily } from "./authoritative-route-families/IdentityAuthoritativeApiRoutes";
import { NodeTrustAuthoritativeApiRouteFamily } from "./authoritative-route-families/NodeTrustAuthoritativeApiRoutes";
import {
  SecurityCertificateAuthoritativeApiRouteFamily,
  SecuritySecretMetadataAuthoritativeApiRouteFamily,
} from "./authoritative-route-families/SecurityAuthoritativeApiRoutes";
import { StorageManagementAuthoritativeApiRouteFamily } from "./authoritative-route-families/StorageAuthoritativeApiRoutes";
import {
  RunSubmissionAuthoritativeApiRouteFamily,
  RuntimeAuthoritativeApiRouteFamily,
} from "./authoritative-route-families/RuntimeAuthoritativeApiRoutes";
import {
  WorkspaceAdministrationAuthoritativeApiRouteFamily,
  WorkspaceInvitationAuthoritativeApiRouteFamily,
} from "./authoritative-route-families/WorkspaceAuthoritativeApiRoutes";

export class AuthoritativeApiRouteRegistrationError extends Error {}

const RouteFamilies = Object.freeze<ReadonlyArray<AuthoritativeApiRouteFamilyRegistration>>([
  IdentityAuthoritativeApiRouteFamily,
  WorkspaceInvitationAuthoritativeApiRouteFamily,
  WorkspaceAdministrationAuthoritativeApiRouteFamily,
  AuthorizationAuthoritativeApiRouteFamily,
  NodeTrustAuthoritativeApiRouteFamily,
  SecurityCertificateAuthoritativeApiRouteFamily,
  SecuritySecretMetadataAuthoritativeApiRouteFamily,
  StorageManagementAuthoritativeApiRouteFamily,
  AssetManagementAuthoritativeApiRouteFamily,
  RunSubmissionAuthoritativeApiRouteFamily,
  RuntimeAuthoritativeApiRouteFamily,
]);

export function composeAuthoritativeApiRouteRegistrationPlan(input: {
  readonly backendAvailability: Readonly<Record<AuthoritativeApiRouteBackendKey, boolean>>;
}): AuthoritativeApiRouteRegistrationPlan {
  const selected = RouteFamilies.filter((family) => family.requiredBackendKeys.every(
    (backendKey) => input.backendAvailability[backendKey],
  ));
  const prefixes = Array.from(new Set(selected.flatMap((family) => family.routePrefixes)));

  return Object.freeze({
    registeredRouteFamilies: Object.freeze(selected),
    registeredRoutePrefixes: Object.freeze(prefixes),
    backendAvailability: input.backendAvailability,
  });
}

export function assertAuthoritativeApiRouteFamilyCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
  requiredRouteFamilyIds: ReadonlyArray<string>,
): void {
  const selected = new Set(plan.registeredRouteFamilies.map((family) => family.routeFamilyId));
  for (const requiredRouteFamilyId of requiredRouteFamilyIds) {
    if (!selected.has(requiredRouteFamilyId)) {
      throw new AuthoritativeApiRouteRegistrationError(
        `Authoritative API route composition is missing required route family '${requiredRouteFamilyId}'.`,
      );
    }
  }
}


import {
  AuthoritativeApiRouteBackendKeys,
  type AuthoritativeApiRouteRegistrationPlan,
} from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import {
  assertAuthoritativeApiRouteFamilyCoverage,
  composeAuthoritativeApiRouteRegistrationPlan,
} from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog";

export const AuthMinimalServerRequiredRouteFamilyIds = Object.freeze([
  "identity-auth",
]);

export function composeAuthMinimalServerApiRouteRegistrationPlan(): AuthoritativeApiRouteRegistrationPlan {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
      [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
      [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: false,
      [AuthoritativeApiRouteBackendKeys.auditLedger]: false,
      [AuthoritativeApiRouteBackendKeys.nodeTrust]: false,
      [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: false,
      [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
      [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
      [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
      [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: false,
      [AuthoritativeApiRouteBackendKeys.runRead]: false,
      [AuthoritativeApiRouteBackendKeys.runMutation]: false,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: false,
    }),
  });
}

export function assertAuthMinimalServerApiRouteRegistrationCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
): void {
  assertAuthoritativeApiRouteFamilyCoverage(plan, AuthMinimalServerRequiredRouteFamilyIds);
}

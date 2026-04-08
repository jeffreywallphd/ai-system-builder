import {
  AuthoritativeApiRouteBackendKeys,
  type AuthoritativeApiRouteRegistrationPlan,
} from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import {
  assertAuthoritativeApiRouteFamilyCoverage,
  composeAuthoritativeApiRouteRegistrationPlan,
} from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog";

export const AuthoritativeServerApiRouteRegistrationPlanArtifactKey =
  "artifact:host:server:authoritative:api-route-registration-plan";

export const AuthoritativeServerRequiredRouteFamilyIds = Object.freeze([
  "identity-auth",
  "workspace-invitations",
  "workspace-administration",
  "authorization-management",
  "deployment-policy-read",
  "audit-ledger",
  "node-trust",
  "security-certificate-operations",
  "security-secret-metadata",
  "storage-management",
  "asset-management",
  "run-submission",
  "run-read",
  "run-mutation",
  "run-execution-update",
]);

export function composeAuthoritativeServerApiRouteRegistrationPlan(): AuthoritativeApiRouteRegistrationPlan {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: true,
      [AuthoritativeApiRouteBackendKeys.authorizationManagement]: true,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: true,
      [AuthoritativeApiRouteBackendKeys.auditLedger]: true,
      [AuthoritativeApiRouteBackendKeys.nodeTrust]: true,
      [AuthoritativeApiRouteBackendKeys.certificateOperations]: true,
      [AuthoritativeApiRouteBackendKeys.secretMetadata]: true,
      [AuthoritativeApiRouteBackendKeys.storageManagement]: true,
      [AuthoritativeApiRouteBackendKeys.assetManagement]: true,
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
      [AuthoritativeApiRouteBackendKeys.runRead]: true,
      [AuthoritativeApiRouteBackendKeys.runMutation]: true,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: true,
    }),
  });
}

export function assertAuthoritativeServerApiRouteRegistrationCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
): void {
  assertAuthoritativeApiRouteFamilyCoverage(plan, AuthoritativeServerRequiredRouteFamilyIds);
}


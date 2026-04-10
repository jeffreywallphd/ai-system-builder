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
  "deployment-policy-write",
  "audit-ledger",
  "node-trust",
  "execution-node-management",
  "security-certificate-operations",
  "security-secret-metadata",
  "storage-management",
  "asset-management",
  "image-asset-management",
  "run-submission",
  "run-read",
  "run-mutation",
  "image-run-api",
  "run-execution-update",
]);

export const AuthMinimalServerRequiredRouteFamilyIds = Object.freeze([
  "identity-auth",
]);

export function composeAuthoritativeServerApiRouteRegistrationPlan(): AuthoritativeApiRouteRegistrationPlan {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: true,
      [AuthoritativeApiRouteBackendKeys.authorizationManagement]: true,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: true,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: true,
      [AuthoritativeApiRouteBackendKeys.auditLedger]: true,
      [AuthoritativeApiRouteBackendKeys.nodeTrust]: true,
      [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: true,
      [AuthoritativeApiRouteBackendKeys.certificateOperations]: true,
      [AuthoritativeApiRouteBackendKeys.secretMetadata]: true,
      [AuthoritativeApiRouteBackendKeys.storageManagement]: true,
      [AuthoritativeApiRouteBackendKeys.assetManagement]: true,
      [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: true,
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
      [AuthoritativeApiRouteBackendKeys.runRead]: true,
      [AuthoritativeApiRouteBackendKeys.runMutation]: true,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: true,
    }),
  });
}

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

export function assertAuthoritativeServerApiRouteRegistrationCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
): void {
  assertAuthoritativeApiRouteFamilyCoverage(plan, AuthoritativeServerRequiredRouteFamilyIds);
}

export function assertAuthMinimalServerApiRouteRegistrationCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
): void {
  assertAuthoritativeApiRouteFamilyCoverage(plan, AuthMinimalServerRequiredRouteFamilyIds);
}


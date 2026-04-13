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

export interface ComposeAuthoritativeServerApiRouteRegistrationPlanOptions {
  readonly includeRuntimeRouteFamilies?: boolean;
}

export function composeAuthoritativeServerApiRouteRegistrationPlan(
  options?: ComposeAuthoritativeServerApiRouteRegistrationPlanOptions,
): AuthoritativeApiRouteRegistrationPlan {
  const includeRuntimeRouteFamilies = options?.includeRuntimeRouteFamilies ?? false;

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
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: includeRuntimeRouteFamilies,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
      [AuthoritativeApiRouteBackendKeys.runRead]: true,
      [AuthoritativeApiRouteBackendKeys.runMutation]: true,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: true,
    }),
  });
}

export function composeDesktopAuthoritativeServerApiRouteRegistrationPlan(): AuthoritativeApiRouteRegistrationPlan {
  return composeAuthoritativeServerApiRouteRegistrationPlan({
    includeRuntimeRouteFamilies: true,
  });
}

export function assertAuthoritativeServerApiRouteRegistrationCoverage(
  plan: AuthoritativeApiRouteRegistrationPlan,
): void {
  assertAuthoritativeApiRouteFamilyCoverage(plan, AuthoritativeServerRequiredRouteFamilyIds);
}


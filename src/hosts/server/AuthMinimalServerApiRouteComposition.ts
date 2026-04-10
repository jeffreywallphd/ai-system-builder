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

export const AuthMinimalServerForbiddenRouteFamilyIds = Object.freeze([
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
  "system-runtime",
  "run-submission",
  "run-read",
  "run-mutation",
  "image-run-api",
  "run-execution-update",
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
  const selectedRouteFamilyIds = new Set(plan.registeredRouteFamilies.map((family) => family.routeFamilyId));
  const unexpectedRouteFamilyIds = [...selectedRouteFamilyIds]
    .filter((routeFamilyId) => !AuthMinimalServerRequiredRouteFamilyIds.includes(routeFamilyId))
    .sort();
  if (unexpectedRouteFamilyIds.length > 0) {
    throw new Error(
      `Auth-minimal startup route scope expanded unexpectedly: ${unexpectedRouteFamilyIds.join(", ")}.`,
    );
  }
  const forbiddenRouteFamilyIds = AuthMinimalServerForbiddenRouteFamilyIds
    .filter((routeFamilyId) => selectedRouteFamilyIds.has(routeFamilyId));
  if (forbiddenRouteFamilyIds.length > 0) {
    throw new Error(
      `Auth-minimal startup route scope includes forbidden families: ${forbiddenRouteFamilyIds.join(", ")}.`,
    );
  }
}

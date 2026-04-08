import { describe, expect, it } from "bun:test";
import { AuthoritativeApiRouteBackendKeys } from "../AuthoritativeApiRouteRegistration";
import {
  AuthoritativeApiRouteRegistrationError,
  assertAuthoritativeApiRouteFamilyCoverage,
  composeAuthoritativeApiRouteRegistrationPlan,
} from "../AuthoritativeApiRouteRegistrationCatalog";

describe("AuthoritativeApiRouteRegistrationCatalog", () => {
  it("composes route families by authoritative domain from backend availability", () => {
    const plan = composeAuthoritativeApiRouteRegistrationPlan({
      backendAvailability: Object.freeze({
        [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
        [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: true,
        [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: true,
        [AuthoritativeApiRouteBackendKeys.authorizationManagement]: true,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: true,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: true,
        [AuthoritativeApiRouteBackendKeys.auditLedger]: false,
        [AuthoritativeApiRouteBackendKeys.nodeTrust]: true,
        [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: false,
        [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
        [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
        [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
        [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
        [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: false,
        [AuthoritativeApiRouteBackendKeys.systemRuntime]: true,
        [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
        [AuthoritativeApiRouteBackendKeys.runRead]: true,
        [AuthoritativeApiRouteBackendKeys.runMutation]: true,
        [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: true,
      }),
    });

    const selectedRouteFamilyIds = new Set(plan.registeredRouteFamilies.map((family) => family.routeFamilyId));
    const selectedDomains = new Set(plan.registeredRouteFamilies.map((family) => family.domain));

    expect(selectedRouteFamilyIds.has("identity-auth")).toBeTrue();
    expect(selectedRouteFamilyIds.has("workspace-invitations")).toBeTrue();
    expect(selectedRouteFamilyIds.has("workspace-administration")).toBeTrue();
    expect(selectedRouteFamilyIds.has("authorization-management")).toBeTrue();
    expect(selectedRouteFamilyIds.has("deployment-policy-read")).toBeTrue();
    expect(selectedRouteFamilyIds.has("deployment-policy-write")).toBeTrue();
    expect(selectedRouteFamilyIds.has("system-runtime")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-submission")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-read")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-mutation")).toBeTrue();
    expect(selectedRouteFamilyIds.has("image-run-api")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-execution-update")).toBeTrue();
    expect(selectedRouteFamilyIds.has("node-trust")).toBeFalse();
    expect(selectedDomains.has("identity")).toBeTrue();
    expect(selectedDomains.has("workspaces")).toBeTrue();
    expect(selectedDomains.has("authorization")).toBeTrue();
    expect(selectedDomains.has("deployment")).toBeTrue();
    expect(selectedDomains.has("runtime")).toBeTrue();
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/identity");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/workspaces");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/runtime");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/runtime/queue");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/image-systems");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/image-runs");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/deployment/policy");
  });

  it("throws when required route family coverage is missing", () => {
    const plan = composeAuthoritativeApiRouteRegistrationPlan({
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

    expect(() => assertAuthoritativeApiRouteFamilyCoverage(plan, ["identity-auth"])).not.toThrow();
    expect(() => assertAuthoritativeApiRouteFamilyCoverage(plan, ["workspace-administration"]))
      .toThrow(AuthoritativeApiRouteRegistrationError);
  });

  it("registers audit-ledger route family when audit backend is available", () => {
    const plan = composeAuthoritativeApiRouteRegistrationPlan({
      backendAvailability: Object.freeze({
        [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
        [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
        [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
        [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: false,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: false,
        [AuthoritativeApiRouteBackendKeys.auditLedger]: true,
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

    expect(plan.registeredRouteFamilies.map((family) => family.routeFamilyId)).toContain("audit-ledger");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/audit");
  });

  it("registers execution-node-management route family when backend is available", () => {
    const plan = composeAuthoritativeApiRouteRegistrationPlan({
      backendAvailability: Object.freeze({
        [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
        [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
        [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
        [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: false,
        [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: false,
        [AuthoritativeApiRouteBackendKeys.auditLedger]: false,
        [AuthoritativeApiRouteBackendKeys.nodeTrust]: false,
        [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: true,
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

    expect(plan.registeredRouteFamilies.map((family) => family.routeFamilyId)).toContain("execution-node-management");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/execution-nodes");
  });
});


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
        [AuthoritativeApiRouteBackendKeys.nodeTrust]: true,
        [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
        [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
        [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
        [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
        [AuthoritativeApiRouteBackendKeys.systemRuntime]: true,
        [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
        [AuthoritativeApiRouteBackendKeys.runRead]: true,
        [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: true,
      }),
    });

    const selectedRouteFamilyIds = new Set(plan.registeredRouteFamilies.map((family) => family.routeFamilyId));
    const selectedDomains = new Set(plan.registeredRouteFamilies.map((family) => family.domain));

    expect(selectedRouteFamilyIds.has("identity-auth")).toBeTrue();
    expect(selectedRouteFamilyIds.has("workspace-invitations")).toBeTrue();
    expect(selectedRouteFamilyIds.has("workspace-administration")).toBeTrue();
    expect(selectedRouteFamilyIds.has("authorization-management")).toBeTrue();
    expect(selectedRouteFamilyIds.has("system-runtime")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-submission")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-read")).toBeTrue();
    expect(selectedRouteFamilyIds.has("run-execution-update")).toBeTrue();
    expect(selectedRouteFamilyIds.has("node-trust")).toBeFalse();
    expect(selectedDomains.has("identity")).toBeTrue();
    expect(selectedDomains.has("workspaces")).toBeTrue();
    expect(selectedDomains.has("authorization")).toBeTrue();
    expect(selectedDomains.has("runtime")).toBeTrue();
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/identity");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/workspaces");
    expect(plan.registeredRoutePrefixes).toContain("/api/v1/runtime");
  });

  it("throws when required route family coverage is missing", () => {
    const plan = composeAuthoritativeApiRouteRegistrationPlan({
      backendAvailability: Object.freeze({
        [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
        [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
        [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
        [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
        [AuthoritativeApiRouteBackendKeys.nodeTrust]: false,
        [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
        [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
        [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
        [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
        [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
        [AuthoritativeApiRouteBackendKeys.runSubmission]: false,
        [AuthoritativeApiRouteBackendKeys.runRead]: false,
        [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: false,
      }),
    });

    expect(() => assertAuthoritativeApiRouteFamilyCoverage(plan, ["identity-auth"])).not.toThrow();
    expect(() => assertAuthoritativeApiRouteFamilyCoverage(plan, ["workspace-administration"]))
      .toThrow(AuthoritativeApiRouteRegistrationError);
  });
});


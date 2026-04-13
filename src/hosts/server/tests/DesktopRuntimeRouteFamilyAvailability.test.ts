import { describe, expect, it } from "bun:test";
import { AuthoritativeApiRouteBackendKeys } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import { composeAuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog";
import { createDefaultAuthoritativeServerCapabilityActivationService } from "../AuthoritativeServerCapabilityActivation";
import { createAuthoritativeServerRouteFamilyAvailabilityService } from "../DesktopRuntimeRouteFamilyAvailability";

function createRoutePlan() {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: false,
      [AuthoritativeApiRouteBackendKeys.workspaceAdministration]: false,
      [AuthoritativeApiRouteBackendKeys.authorizationManagement]: false,
      [AuthoritativeApiRouteBackendKeys.auditLedger]: false,
      [AuthoritativeApiRouteBackendKeys.nodeTrust]: false,
      [AuthoritativeApiRouteBackendKeys.executionNodeManagement]: false,
      [AuthoritativeApiRouteBackendKeys.certificateOperations]: false,
      [AuthoritativeApiRouteBackendKeys.secretMetadata]: false,
      [AuthoritativeApiRouteBackendKeys.storageManagement]: false,
      [AuthoritativeApiRouteBackendKeys.assetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.imageAssetManagement]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyRead]: false,
      [AuthoritativeApiRouteBackendKeys.deploymentPolicyWrite]: false,
      [AuthoritativeApiRouteBackendKeys.systemRuntime]: false,
      [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
      [AuthoritativeApiRouteBackendKeys.runRead]: false,
      [AuthoritativeApiRouteBackendKeys.runMutation]: false,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: false,
    }),
  });
}

describe("DesktopRuntimeRouteFamilyAvailability", () => {
  it("preserves capability activation semantics when no desktop runtime lifecycle provider is supplied", () => {
    const activation = createDefaultAuthoritativeServerCapabilityActivationService({
      routeRegistrationPlan: createRoutePlan(),
    });
    const availability = createAuthoritativeServerRouteFamilyAvailabilityService({
      capabilityActivation: activation,
    });

    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      routeFamilyId: "run-submission",
      capabilityId: "deferred-runtime-features",
      state: "pending",
      available: false,
    });
  });

  it("derives deferred runtime route-family availability from desktop runtime lifecycle capability phases", () => {
    const activation = createDefaultAuthoritativeServerCapabilityActivationService({
      routeRegistrationPlan: createRoutePlan(),
    });
    let capabilityPhase: "pre-login" | "warming" | "failed" | "ready" = "pre-login";
    const availability = createAuthoritativeServerRouteFamilyAvailabilityService({
      capabilityActivation: activation,
      runtimeStatusProvider: {
        getStatus: () => Object.freeze({ capabilityPhase }),
      },
    });

    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "pre-login",
      available: false,
    });
    expect(availability.isRouteFamilyAvailable("run-submission")).toBeFalse();

    capabilityPhase = "warming";
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "warming",
      available: false,
    });

    capabilityPhase = "failed";
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "failed",
      available: false,
    });

    capabilityPhase = "ready";
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "ready",
      available: true,
    });
    expect(availability.isRouteFamilyAvailable("run-submission")).toBeTrue();
    expect(availability.resolveRouteFamilyAvailability("identity-auth").available).toBeTrue();
  });
});

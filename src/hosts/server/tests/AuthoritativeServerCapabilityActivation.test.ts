import { describe, expect, it } from "bun:test";
import {
  AuthoritativeServerCapabilityActivationStates,
  AuthoritativeServerCapabilityIds,
  createDefaultAuthoritativeServerCapabilityActivationService,
} from "../AuthoritativeServerCapabilityActivation";
import { composeAuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog";
import { AuthoritativeApiRouteBackendKeys } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";

function composeRouteRegistrationPlan() {
  return composeAuthoritativeApiRouteRegistrationPlan({
    backendAvailability: Object.freeze({
      [AuthoritativeApiRouteBackendKeys.identityAuth]: true,
      [AuthoritativeApiRouteBackendKeys.workspaceInvitation]: true,
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
      [AuthoritativeApiRouteBackendKeys.runSubmission]: true,
      [AuthoritativeApiRouteBackendKeys.runRead]: false,
      [AuthoritativeApiRouteBackendKeys.runMutation]: false,
      [AuthoritativeApiRouteBackendKeys.runExecutionUpdate]: false,
    }),
  });
}

describe("AuthoritativeServerCapabilityActivation", () => {
  it("registers identity bootstrap as available and deferred runtime capabilities as pending", () => {
    const activation = createDefaultAuthoritativeServerCapabilityActivationService({
      routeRegistrationPlan: composeRouteRegistrationPlan(),
    });

    const snapshot = activation.getSnapshot();
    const identityCapability = snapshot.capabilities.find((capability) => (
      capability.capabilityId === AuthoritativeServerCapabilityIds.identityBootstrap
    ));
    const deferredCapability = snapshot.capabilities.find((capability) => (
      capability.capabilityId === AuthoritativeServerCapabilityIds.deferredRuntimeFeatures
    ));

    expect(identityCapability?.state).toBe(AuthoritativeServerCapabilityActivationStates.available);
    expect(deferredCapability?.state).toBe(AuthoritativeServerCapabilityActivationStates.pending);
    expect(activation.isRouteFamilyAvailable("identity-auth")).toBeTrue();
    expect(activation.isRouteFamilyAvailable("run-submission")).toBeFalse();
  });

  it("activates deferred runtime capability routes without mutating identity bootstrap availability", () => {
    const activation = createDefaultAuthoritativeServerCapabilityActivationService({
      routeRegistrationPlan: composeRouteRegistrationPlan(),
    });

    const activatedSnapshot = activation.activateCapabilities({
      capabilityIds: [AuthoritativeServerCapabilityIds.deferredRuntimeFeatures],
      reason: "desktop-post-login-warmup",
      activatedAt: "2026-04-13T12:00:00.000Z",
    });

    const deferredCapability = activatedSnapshot.capabilities.find((capability) => (
      capability.capabilityId === AuthoritativeServerCapabilityIds.deferredRuntimeFeatures
    ));
    expect(deferredCapability?.state).toBe(AuthoritativeServerCapabilityActivationStates.available);
    expect(activation.isRouteFamilyAvailable("identity-auth")).toBeTrue();
    expect(activation.isRouteFamilyAvailable("run-submission")).toBeTrue();
    expect(activatedSnapshot.transitions).toEqual([{
      capabilityId: AuthoritativeServerCapabilityIds.deferredRuntimeFeatures,
      from: AuthoritativeServerCapabilityActivationStates.pending,
      to: AuthoritativeServerCapabilityActivationStates.available,
      occurredAt: "2026-04-13T12:00:00.000Z",
      reason: "desktop-post-login-warmup",
    }]);
  });
});


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
    let runtimeStatus = Object.freeze({
      capabilityPhase: "pre-login" as const,
      transport: Object.freeze({
        phase: "available" as const,
        updatedAt: "2026-04-13T10:00:00.000Z",
      }),
      activationMode: "auth-success-warmup" as const,
      triggerSource: "explicit-login" as const,
      unavailableReason: "pre-login" as const,
      failure: undefined as {
        readonly message: string;
        readonly failedAt: string;
        readonly retryable: boolean;
      } | undefined,
      activationStages: Object.freeze([Object.freeze({
        stageId: "python-runtime-resolution",
        state: "pending",
        blockingReadiness: true,
        detail: "Python runtime resolution has not started.",
      })]),
    });
    const availability = createAuthoritativeServerRouteFamilyAvailabilityService({
      capabilityActivation: activation,
      runtimeStatusProvider: {
        getStatus: () => runtimeStatus,
      },
    });

    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "pre-login",
      available: false,
      runtimeLifecycle: {
        capabilityPhase: "pre-login",
        transportPhase: "available",
        activationStages: [Object.freeze({
          stageId: "python-runtime-resolution",
          state: "pending",
          blockingReadiness: true,
          detail: "Python runtime resolution has not started.",
        })],
      },
    });
    expect(availability.isRouteFamilyAvailable("run-submission")).toBeFalse();

    runtimeStatus = Object.freeze({
      ...runtimeStatus,
      capabilityPhase: "warming",
      unavailableReason: undefined,
    });
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "warming",
      available: false,
    });

    runtimeStatus = Object.freeze({
      ...runtimeStatus,
      capabilityPhase: "failed",
      failure: Object.freeze({
        message: "runtime-failed",
        failedAt: "2026-04-13T10:00:02.000Z",
        retryable: true,
      }),
    });
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "failed",
      available: false,
      runtimeLifecycle: {
        hasFailure: true,
        failureRetryable: true,
      },
    });

    runtimeStatus = Object.freeze({
      ...runtimeStatus,
      capabilityPhase: "ready",
      failure: undefined,
    });
    expect(availability.resolveRouteFamilyAvailability("run-submission")).toMatchObject({
      state: "ready",
      available: true,
    });
    expect(availability.isRouteFamilyAvailable("run-submission")).toBeTrue();
    expect(availability.resolveRouteFamilyAvailability("identity-auth").available).toBeTrue();
  });
});

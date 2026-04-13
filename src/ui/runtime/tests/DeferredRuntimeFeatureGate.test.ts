import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../electron/shared/DesktopContracts";
import {
  buildDeferredRuntimeGateState,
  isDeferredRuntimeGatePath,
  isDeferredRuntimeUnavailableError,
} from "../DeferredRuntimeFeatureGate";

function createStatus(overrides: Partial<DesktopPostLoginRuntimeStatus>): DesktopPostLoginRuntimeStatus {
  const updatedAt = overrides.updatedAt ?? "2026-04-10T12:00:00.000Z";
  const state = overrides.state ?? "pre-login";
  return {
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: overrides.capabilityPhase ?? state,
    unavailableReason: "pre-login",
    updatedAt,
    transport: {
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    },
    ...overrides,
  } as const;
}

describe("DeferredRuntimeFeatureGate", () => {
  it("flags deferred feature route paths and skips non-feature paths", () => {
    expect(isDeferredRuntimeGatePath("/build")).toBeTrue();
    expect(isDeferredRuntimeGatePath("/explore/registry")).toBeTrue();
    expect(isDeferredRuntimeGatePath("/run")).toBeTrue();
    expect(isDeferredRuntimeGatePath("/assets/library")).toBeTrue();
    expect(isDeferredRuntimeGatePath("/workflows/flow-1")).toBeTrue();
    expect(isDeferredRuntimeGatePath("/studio-shell/workflow")).toBeTrue();

    expect(isDeferredRuntimeGatePath("/")).toBeFalse();
    expect(isDeferredRuntimeGatePath("/settings")).toBeFalse();
    expect(isDeferredRuntimeGatePath("/auth/login")).toBeFalse();
  });

  it("maps warming status to a loading presentation state", () => {
    const state = buildDeferredRuntimeGateState(createStatus({
      state: "warming",
      capabilityPhase: "warming",
      updatedAt: "2026-04-10T12:00:00.000Z",
      triggerSource: "feature-demand",
    }));
    expect(state?.kind).toBe("loading");
    expect(state?.title).toContain("Getting your tools ready");
    expect(state?.details).toContain("runtime=warming");
  });

  it("maps failed status to retryable error presentation", () => {
    const state = buildDeferredRuntimeGateState(createStatus({
      state: "failed",
      capabilityPhase: "failed",
      updatedAt: "2026-04-10T12:00:00.000Z",
      failure: {
        message: "service supervisor startup timed out",
        failedAt: "2026-04-10T12:00:00.000Z",
        retryable: true,
      },
    }));
    expect(state?.kind).toBe("error");
    expect(state?.retryable).toBeTrue();
    expect(state?.title).toContain("could not finish startup");
    expect(state?.details).toContain("runtime=failed");
    expect(state?.details).toContain("service supervisor startup timed out");
  });

  it("maps pre-login unavailable status to sign-in guidance", () => {
    const state = buildDeferredRuntimeGateState(createStatus({
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: "pre-login",
      updatedAt: "2026-04-10T12:00:00.000Z",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "running",
          updatedAt: "2026-04-10T12:00:00.000Z",
          blockingReadiness: true,
          detail: "Resolving python runtime",
        },
      ],
    }));
    expect(state?.kind).toBe("disconnected");
    expect(state?.title).toContain("Sign in");
    expect(state?.details).toContain("reason=pre-login");
    expect(state?.details).toContain("stage=python-runtime-resolution:running");
  });

  it("treats ready or absent status as pass-through", () => {
    expect(buildDeferredRuntimeGateState(undefined)).toBeUndefined();
    expect(buildDeferredRuntimeGateState(createStatus({
      state: "ready",
      capabilityPhase: "ready",
      updatedAt: "2026-04-10T12:00:00.000Z",
    }))).toBeUndefined();
  });

  it("detects deferred runtime unavailable preload errors", () => {
    expect(isDeferredRuntimeUnavailableError({ code: "AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE" })).toBeTrue();
    expect(isDeferredRuntimeUnavailableError({ code: "different-code" })).toBeFalse();
    expect(isDeferredRuntimeUnavailableError(new Error("no code"))).toBeFalse();
  });
});

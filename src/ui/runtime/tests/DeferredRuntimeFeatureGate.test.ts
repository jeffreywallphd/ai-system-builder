import { describe, expect, it } from "bun:test";
import {
  buildDeferredRuntimeGateState,
  isDeferredRuntimeGatePath,
  isDeferredRuntimeUnavailableError,
} from "../DeferredRuntimeFeatureGate";

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
    const state = buildDeferredRuntimeGateState({
      state: "warming",
      updatedAt: "2026-04-10T12:00:00.000Z",
      triggerSource: "feature-demand",
    });
    expect(state?.kind).toBe("loading");
    expect(state?.title).toContain("Preparing feature services");
    expect(state?.details).toContain("runtime=warming");
  });

  it("maps failed status to retryable error presentation", () => {
    const state = buildDeferredRuntimeGateState({
      state: "failed",
      updatedAt: "2026-04-10T12:00:00.000Z",
      failure: {
        message: "service supervisor startup timed out",
        failedAt: "2026-04-10T12:00:00.000Z",
        retryable: true,
      },
    });
    expect(state?.kind).toBe("error");
    expect(state?.retryable).toBeTrue();
    expect(state?.details).toContain("runtime=failed");
    expect(state?.details).toContain("service supervisor startup timed out");
  });

  it("treats ready or absent status as pass-through", () => {
    expect(buildDeferredRuntimeGateState(undefined)).toBeUndefined();
    expect(buildDeferredRuntimeGateState({
      state: "ready",
      updatedAt: "2026-04-10T12:00:00.000Z",
    })).toBeUndefined();
  });

  it("detects deferred runtime unavailable preload errors", () => {
    expect(isDeferredRuntimeUnavailableError({ code: "AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE" })).toBeTrue();
    expect(isDeferredRuntimeUnavailableError({ code: "different-code" })).toBeFalse();
    expect(isDeferredRuntimeUnavailableError(new Error("no code"))).toBeFalse();
  });
});

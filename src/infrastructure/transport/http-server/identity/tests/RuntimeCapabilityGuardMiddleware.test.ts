import { describe, expect, it } from "bun:test";
import { evaluateRuntimeCapabilityGuard } from "../middleware/runtime-capability-guard";

describe("runtime capability guard middleware", () => {
  it("returns canonical warming responses for pending runtime route-family availability", () => {
    const decision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/runtime/runs/start",
      requestId: "request-1",
      routeFamilyId: "run-submission",
      checkedAt: "2026-04-13T12:00:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "run-submission",
        capabilityId: "deferred-runtime-features",
        state: "pending",
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.state).toBe("warming");
    expect(decision.response?.endpoint).toBe("/api/v1/runtime/runs/start");
    expect(decision.response?.runtime.blockingReasons[0]?.code).toBe("capability-warmup-in-progress");
  });

  it("returns canonical failed responses for failed runtime route-family availability", () => {
    const decision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/runtime/runs/run-1/status",
      requestId: "request-2",
      routeFamilyId: "run-read",
      checkedAt: "2026-04-13T12:01:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "run-read",
        capabilityId: "deferred-runtime-features",
        state: "failed",
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.state).toBe("failed");
    if (decision.response?.runtime.state === "failed") {
      expect(decision.response.runtime.failure.code).toBe("runtime-capability-activation-failed");
    }
  });

  it("does not block non-runtime route families", () => {
    const decision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/identity/session",
      requestId: "request-3",
      routeFamilyId: "identity-auth",
      availability: Object.freeze({
        routeFamilyId: "identity-auth",
        capabilityId: "identity-bootstrap",
        state: "pending",
        available: false,
      }),
    });

    expect(decision.blocked).toBeFalse();
    expect(decision.response).toBeUndefined();
  });
});

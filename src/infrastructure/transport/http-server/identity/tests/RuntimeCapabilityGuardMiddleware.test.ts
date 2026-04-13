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
        runtimeLifecycle: Object.freeze({
          capabilityPhase: "warming",
          activationStages: Object.freeze([Object.freeze({
            stageId: "python-runtime-resolution",
            state: "running",
            blockingReadiness: true,
            detail: "Resolving desktop Python runtime.",
          })]),
        }),
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.state).toBe("warming");
    expect(decision.response?.endpoint).toBe("/api/v1/runtime/runs/start");
    expect(decision.response?.runtime.blockingReasons[0]?.code).toBe("capability-warmup-in-progress");
    expect(decision.response?.runtime.blockingReasons[0]?.message).toBe("Resolving desktop Python runtime.");
    expect(decision.response?.runtime.diagnostics?.blockingDependencyCategory).toBe("capability-activation");
    expect(decision.response?.runtime.diagnostics?.blockingActivationStageId).toBe("python-runtime-resolution");
    expect(decision.response?.runtime.diagnostics?.blockingActivationStageState).toBe("running");
    expect(decision.response?.runtime.diagnostics?.lifecyclePhase).toBe("pending");
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
        runtimeLifecycle: Object.freeze({
          capabilityPhase: "failed",
          activationStages: Object.freeze([Object.freeze({
            stageId: "python-runtime-resolution",
            state: "blocked",
            blockingReadiness: true,
            detail: "Desktop Python runtime resolution failed.",
            errorMessage: "python executable not found",
          })]),
        }),
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.state).toBe("failed");
    if (decision.response?.runtime.state === "failed") {
      expect(decision.response.runtime.failure.code).toBe("runtime-capability-activation-failed");
      expect(decision.response.runtime.failure.message).toContain("python executable not found");
      expect(decision.response.runtime.diagnostics?.blockingDependencyCategory).toBe("capability-activation");
      expect(decision.response.runtime.diagnostics?.blockingActivationStageId).toBe("python-runtime-resolution");
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

  it("guards system-runtime and image-run-api route families with structured unavailable payloads", () => {
    const systemRuntimeDecision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/runtime/queue/runtime-queue:1/dequeue",
      requestId: "request-4",
      routeFamilyId: "system-runtime",
      checkedAt: "2026-04-13T12:02:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "system-runtime",
        capabilityId: "deferred-runtime-features",
        state: "pre-login",
        available: false,
      }),
    });
    expect(systemRuntimeDecision.blocked).toBeTrue();
    expect(systemRuntimeDecision.response?.runtime.state).toBe("unavailable");
    expect(systemRuntimeDecision.response?.runtime.blockingReasons[0]?.code).toBe("authentication-required");
    expect(systemRuntimeDecision.response?.runtime.diagnostics?.blockingDependencyCategory).toBe("authentication");

    const imageRunDecision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/image-systems/system-1/runs",
      requestId: "request-5",
      routeFamilyId: "image-run-api",
      checkedAt: "2026-04-13T12:03:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "image-run-api",
        capabilityId: "deferred-runtime-features",
        state: "warming",
        available: false,
      }),
    });
    expect(imageRunDecision.blocked).toBeTrue();
    expect(imageRunDecision.response?.runtime.state).toBe("warming");
    expect(imageRunDecision.response?.runtime.blockingReasons[0]?.code).toBe("capability-warmup-in-progress");
  });

  it("classifies control-plane transport failures as transport blocking diagnostics", () => {
    const decision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/runtime/runs/start",
      requestId: "request-transport-failure",
      routeFamilyId: "run-submission",
      checkedAt: "2026-04-13T12:04:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "run-submission",
        capabilityId: "deferred-runtime-features",
        state: "failed",
        runtimeLifecycle: Object.freeze({
          capabilityPhase: "failed",
          transportPhase: "failed",
          hasFailure: true,
          failureRetryable: true,
        }),
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.diagnostics?.blockingDependencyCategory).toBe("control-plane-transport");
    expect(decision.response?.runtime.diagnostics?.transportPhase).toBe("failed");
  });

  it("classifies runtime supervisor failures when lifecycle reports a capability failure", () => {
    const decision = evaluateRuntimeCapabilityGuard({
      endpoint: "/api/v1/runtime/runs/start",
      requestId: "request-supervisor-failure",
      routeFamilyId: "run-submission",
      checkedAt: "2026-04-13T12:05:00.000Z",
      availability: Object.freeze({
        routeFamilyId: "run-submission",
        capabilityId: "deferred-runtime-features",
        state: "failed",
        runtimeLifecycle: Object.freeze({
          capabilityPhase: "failed",
          transportPhase: "available",
          hasFailure: true,
          failureRetryable: true,
        }),
        available: false,
      }),
    });

    expect(decision.blocked).toBeTrue();
    expect(decision.response?.runtime.state).toBe("failed");
    expect(decision.response?.runtime.diagnostics?.blockingDependencyCategory).toBe("runtime-supervisor");
  });
});

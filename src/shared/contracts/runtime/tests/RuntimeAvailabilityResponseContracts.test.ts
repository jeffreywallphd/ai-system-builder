import { describe, expect, it } from "bun:test";
import {
  RuntimeAvailabilityBlockingDependencyCategories,
  RuntimeAvailabilityBlockingReasonCodes,
  RuntimeAvailabilityResponseContractError,
  RuntimeAvailabilityStates,
  createRuntimeFailedResponseContract,
  createRuntimeGuardedEndpointUnavailableResponseContract,
  createRuntimeReadyResponseContract,
  createRuntimeUnavailableResponseContract,
  createRuntimeWarmingResponseContract,
  isRuntimeAvailabilityReady,
  isRuntimeAvailabilityUnavailable,
} from "../RuntimeAvailabilityResponseContracts";

describe("RuntimeAvailabilityResponseContracts", () => {
  it("defines canonical runtime lifecycle availability states", () => {
    expect(RuntimeAvailabilityStates.unavailable).toBe("unavailable");
    expect(RuntimeAvailabilityStates.warming).toBe("warming");
    expect(RuntimeAvailabilityStates.ready).toBe("ready");
    expect(RuntimeAvailabilityStates.failed).toBe("failed");
  });

  it("builds explicit warming and ready contracts with canonical defaults", () => {
    const warming = createRuntimeWarmingResponseContract({
      checkedAt: "2026-04-13T10:00:00.000Z",
      warmupStartedAt: "2026-04-13T09:59:00.000Z",
    });
    expect(warming.retryable).toBeTrue();
    expect(warming.blockingReasons[0]?.code).toBe(RuntimeAvailabilityBlockingReasonCodes.capabilityWarmupInProgress);
    expect(isRuntimeAvailabilityUnavailable(warming)).toBeTrue();

    const ready = createRuntimeReadyResponseContract({
      checkedAt: "2026-04-13T10:01:00.000Z",
      readyAt: "2026-04-13T10:01:00.000Z",
    });
    expect(ready.blockingReasons).toEqual([]);
    expect(isRuntimeAvailabilityReady(ready)).toBeTrue();
    expect(isRuntimeAvailabilityUnavailable(ready)).toBeFalse();
  });

  it("builds unavailable and failed contracts with machine-readable retry metadata", () => {
    const unavailable = createRuntimeUnavailableResponseContract({
      checkedAt: "2026-04-13T10:02:00.000Z",
      blockingReasons: [Object.freeze({
        code: RuntimeAvailabilityBlockingReasonCodes.authenticationRequired,
        message: "User authentication is required before runtime activation.",
        retryable: true,
      })],
      retryable: true,
    });

    expect(unavailable.state).toBe(RuntimeAvailabilityStates.unavailable);
    expect(unavailable.retryable).toBeTrue();

    const failed = createRuntimeFailedResponseContract({
      checkedAt: "2026-04-13T10:03:00.000Z",
      diagnostics: {
        lifecycleState: RuntimeAvailabilityStates.failed,
        blockingDependencyCategory: RuntimeAvailabilityBlockingDependencyCategories.runtimeSupervisor,
        retryable: true,
        summary: "The runtime supervisor reported a deferred activation failure.",
        capabilityId: "deferred-runtime-features",
        routeFamilyId: "run-read",
      },
      failure: {
        code: "runtime-bootstrap-timeout",
        message: "Timed out while waiting for runtime bootstrap readiness.",
        failedAt: "2026-04-13T10:03:00.000Z",
        retryable: true,
        retryAfterMs: 5000,
      },
    });

    expect(failed.state).toBe(RuntimeAvailabilityStates.failed);
    expect(failed.failure.retryAfterMs).toBe(5000);
    expect(failed.blockingReasons[0]?.code).toBe(RuntimeAvailabilityBlockingReasonCodes.runtimeInitializationFailed);
    expect(failed.diagnostics?.blockingDependencyCategory).toBe("runtime-supervisor");
    expect(failed.diagnostics?.summary).toBe("The runtime supervisor reported a deferred activation failure.");
  });

  it("builds guarded endpoint unavailable responses and rejects invalid payloads", () => {
    const guarded = createRuntimeGuardedEndpointUnavailableResponseContract({
      endpoint: "/api/v1/runtime/runs/start",
      runtime: createRuntimeWarmingResponseContract({
        checkedAt: "2026-04-13T10:05:00.000Z",
      }),
      blockedAt: "2026-04-13T10:05:00.000Z",
      requestId: " request-1 ",
    });

    expect(guarded.requestId).toBe("request-1");
    expect(guarded.runtime.state).toBe(RuntimeAvailabilityStates.warming);

    expect(() => createRuntimeFailedResponseContract({
      failure: {
        code: "",
        message: "missing code",
        failedAt: "2026-04-13T10:05:00.000Z",
        retryable: false,
      },
    })).toThrow(RuntimeAvailabilityResponseContractError);
  });
});

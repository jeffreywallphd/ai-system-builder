import { describe, expect, it } from "bun:test";
import { BoundedExternalRetryPolicy, InMemoryRequestReplayGuard } from "../ExternalRetryPolicy";

describe("ExternalRetryPolicy", () => {
  it("classifies only internal transport failures as retryable", () => {
    const policy = new BoundedExternalRetryPolicy(3);
    expect(policy.classify({ code: "internal", message: "timeout" }).shouldRetry).toBeTrue();
    expect(policy.classify({ code: "unauthorized", message: "bad token" }).shouldRetry).toBeFalse();
    expect(policy.classify({ code: "invalid-request", message: "bad payload" }).shouldRetry).toBeFalse();
    expect(policy.classify({ code: "quota-exceeded", message: "quota" }).shouldRetry).toBeFalse();
    expect(policy.classify({ code: "rate-limit-exceeded", message: "rate" }).shouldRetry).toBeFalse();
  });

  it("stores and returns replayed start responses by bounded identity", () => {
    const guard = new InMemoryRequestReplayGuard<{ executionId: string }>();
    const key = {
      operation: "start-execution" as const,
      idempotencyKey: "idem-1",
      callerId: "caller-a",
      tenantId: "tenant-a",
      requestSource: "external-api" as const,
    };
    guard.remember(key, { ok: true, data: { executionId: "exec-1" } });

    const replayed = guard.get(key);
    expect(replayed?.ok).toBeTrue();
    expect(replayed?.data?.executionId).toBe("exec-1");
  });
});

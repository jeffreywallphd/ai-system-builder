import { describe, expect, it } from "bun:test";
import { RuntimeRateLimitEvaluator } from "../RuntimeRateLimitEvaluator";

describe("RuntimeRateLimitEvaluator", () => {
  it("allows requests below caller/tenant/source-operation limits", () => {
    const evaluator = new RuntimeRateLimitEvaluator({
      maxRequestsPerCallerPerWindow: 2,
      maxRequestsPerTenantPerWindow: 3,
      maxRequestsPerSourceOperationPerWindow: 3,
      windowMs: 10_000,
    });

    const first = evaluator.evaluate({
      callerContext: { callerKind: "user", callerId: "caller-a" },
      tenantId: "tenant-a",
      requestSource: "external-api",
      operation: "start-execution",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const second = evaluator.evaluate({
      callerContext: { callerKind: "user", callerId: "caller-a" },
      tenantId: "tenant-a",
      requestSource: "external-api",
      operation: "start-execution",
      now: new Date("2026-01-01T00:00:01.000Z"),
    });

    expect(first.allowed).toBeTrue();
    expect(second.allowed).toBeTrue();
  });

  it("denies requests once per-caller window budget is exceeded", () => {
    const evaluator = new RuntimeRateLimitEvaluator({
      maxRequestsPerCallerPerWindow: 1,
      maxRequestsPerTenantPerWindow: 10,
      maxRequestsPerSourceOperationPerWindow: 10,
      windowMs: 60_000,
    });

    evaluator.evaluate({
      callerContext: { callerKind: "user", callerId: "caller-a" },
      tenantId: "tenant-a",
      requestSource: "external-api",
      operation: "start-execution",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const denied = evaluator.evaluate({
      callerContext: { callerKind: "user", callerId: "caller-a" },
      tenantId: "tenant-a",
      requestSource: "external-api",
      operation: "start-execution",
      now: new Date("2026-01-01T00:00:00.100Z"),
    });

    expect(denied.allowed).toBeFalse();
    expect(denied.reasonCode).toBe("caller-window-exceeded");
  });
});

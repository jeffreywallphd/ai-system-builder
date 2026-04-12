import { describe, expect, it } from "bun:test";
import { ExecutionQuotaEvaluator } from "../ExecutionQuotaEvaluator";

describe("ExecutionQuotaEvaluator", () => {
  it("allows execution under quota and blocks when concurrent quota is exceeded", () => {
    const evaluator = new ExecutionQuotaEvaluator({
      maxConcurrentExecutionsPerCaller: 1,
      maxExecutionsPerWindow: 5,
      windowMs: 60_000,
    });

    const first = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-1" },
      now: new Date("2026-03-28T10:00:00.000Z"),
    });
    expect(first.decision.allowed).toBeTrue();

    const blocked = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-1" },
      now: new Date("2026-03-28T10:00:01.000Z"),
    });
    expect(blocked.decision.allowed).toBeFalse();
    expect(blocked.decision.reasonCode).toBe("quota-concurrent-executions-exceeded");

    first.reservation?.release();
    const allowedAfterRelease = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-1" },
      now: new Date("2026-03-28T10:00:02.000Z"),
    });
    expect(allowedAfterRelease.decision.allowed).toBeTrue();
  });

  it("applies bounded window limits predictably for rapid repeated requests", () => {
    const evaluator = new ExecutionQuotaEvaluator({
      maxConcurrentExecutionsPerCaller: 3,
      maxExecutionsPerWindow: 2,
      windowMs: 5_000,
    });

    const at = (iso: string) => new Date(iso);
    const one = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-2" },
      now: at("2026-03-28T10:00:00.000Z"),
    });
    one.reservation?.release();

    const two = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-2" },
      now: at("2026-03-28T10:00:01.000Z"),
    });
    two.reservation?.release();

    const blocked = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-2" },
      now: at("2026-03-28T10:00:02.000Z"),
    });
    expect(blocked.decision.allowed).toBeFalse();
    expect(blocked.decision.reasonCode).toBe("quota-window-executions-exceeded");

    const allowedAfterWindow = evaluator.reserveExecution({
      callerContext: { callerKind: "user", callerId: "user-2" },
      now: at("2026-03-28T10:00:07.500Z"),
    });
    expect(allowedAfterWindow.decision.allowed).toBeTrue();
  });
});

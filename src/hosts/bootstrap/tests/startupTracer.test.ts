import { describe, expect, it } from "bun:test";
import { createStartupTracer, type StartupSpanLogger } from "../startupTracer";

class CapturingLogger implements StartupSpanLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly warnEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(payload: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(payload);
  }

  public error(payload: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(payload);
  }

  public warn(payload: Readonly<Record<string, unknown>>): void {
    this.warnEvents.push(payload);
  }
}

describe("startupTracer", () => {
  it("records nested span hierarchy and duration for completed spans", () => {
    const logger = new CapturingLogger();
    let now = 100;
    const tracer = createStartupTracer({
      logger,
      traceId: "trace-startup-1",
      startupReason: "authoritative-server-entrypoint-startup",
      clock: () => now,
    });

    const root = tracer.startSpan("authoritative-startup");
    now = 125;
    const dependencies = root.startChild("dependencies", {
      metadata: {
        phase: "service-plan",
        authToken: "secret-token-value",
      },
    });
    now = 145;
    const routeComposition = dependencies.startChild("route-composition", {
      metadata: {
        nested: {
          token: "Bearer abc123",
          descriptor: "ok",
        },
      },
    });
    now = 165;
    routeComposition.complete();
    now = 205;
    dependencies.complete({
      metadata: {
        routeFamilies: 12,
      },
    });
    now = 250;
    root.complete();

    expect(logger.errorEvents).toHaveLength(0);
    expect(logger.infoEvents).toHaveLength(3);

    const grandChildEvent = logger.infoEvents[0];
    expect(grandChildEvent?.event).toBe("startup.span.completed");
    expect(grandChildEvent?.spanName).toBe("route-composition");
    expect(grandChildEvent?.spanDepth).toBe(2);
    expect(grandChildEvent?.spanHierarchy).toEqual([
      "authoritative-startup",
      "dependencies",
      "route-composition",
    ]);
    expect((grandChildEvent?.metadata as Record<string, unknown>)?.nested).toEqual({
      token: "[REDACTED]",
      descriptor: "ok",
    });
    expect(grandChildEvent?.durationMs).toBe(20);
    expect(grandChildEvent?.slow).toBe(false);
    expect(grandChildEvent?.slowWarning).toBe(false);

    const childEvent = logger.infoEvents[1];
    expect(childEvent?.event).toBe("startup.span.completed");
    expect(childEvent?.traceId).toBe("trace-startup-1");
    expect(childEvent?.startupCorrelationId).toBe("trace-startup-1");
    expect(childEvent?.spanName).toBe("dependencies");
    expect(childEvent?.spanDepth).toBe(1);
    expect(childEvent?.spanHierarchy).toEqual(["authoritative-startup", "dependencies"]);
    expect(childEvent?.spanHierarchyPath).toBe("authoritative-startup > dependencies");
    expect(childEvent?.durationMs).toBe(80);
    expect(childEvent?.slow).toBe(false);
    expect(childEvent?.slowWarning).toBe(false);
    expect((childEvent?.metadata as Record<string, unknown>)?.phase).toBe("service-plan");
    expect((childEvent?.metadata as Record<string, unknown>)?.authToken).toBe("[REDACTED]");
    expect((childEvent?.metadata as Record<string, unknown>)?.routeFamilies).toBe(12);

    const rootEvent = logger.infoEvents[2];
    expect(rootEvent?.spanName).toBe("authoritative-startup");
    expect(rootEvent?.spanDepth).toBe(0);
    expect(rootEvent?.durationMs).toBe(150);
    expect(rootEvent?.slow).toBe(false);
    expect(rootEvent?.slowWarning).toBe(false);
    expect(logger.warnEvents).toHaveLength(0);
  });

  it("tags failed spans with redacted error details and metadata", () => {
    const logger = new CapturingLogger();
    let now = 400;
    const tracer = createStartupTracer({
      logger,
      traceId: "trace-startup-2",
      clock: () => now,
    });

    const span = tracer.startSpan("security", {
      metadata: {
        privateKeyRef: "pk-live-123",
      },
    });
    now = 460;
    span.fail(new Error("bootstrap failed token=abc123 password=hunter2"), {
      metadata: {
        apiKey: "key-live-123",
      },
    });

    expect(logger.infoEvents).toHaveLength(0);
    expect(logger.errorEvents).toHaveLength(1);

    const event = logger.errorEvents[0];
    const error = event?.error as Record<string, unknown> | undefined;
    expect(event?.event).toBe("startup.span.failed");
    expect(event?.startupCorrelationId).toBe("trace-startup-2");
    expect(event?.errorTagged).toBeTrue();
    expect(event?.durationMs).toBe(60);
    expect(event?.slow).toBe(false);
    expect(event?.slowWarning).toBe(false);
    expect((event?.metadata as Record<string, unknown>)?.privateKeyRef).toBe("[REDACTED]");
    expect((event?.metadata as Record<string, unknown>)?.apiKey).toBe("[REDACTED]");
    expect(error?.message).toBe("bootstrap failed token=[REDACTED] password=[REDACTED]");
    expect(logger.warnEvents).toHaveLength(0);
  });

  it("supports runInSpan helper and emits failure event when the callback throws", async () => {
    const logger = new CapturingLogger();
    let now = 800;
    const tracer = createStartupTracer({
      logger,
      traceId: "trace-startup-3",
      clock: () => now,
    });

    await expect(tracer.runInSpan("persistence", async () => {
      now = 860;
      throw new Error("database secret=abc");
    })).rejects.toThrow("database secret=abc");

    expect(logger.infoEvents).toHaveLength(0);
    expect(logger.errorEvents).toHaveLength(1);
    expect(logger.errorEvents[0]?.event).toBe("startup.span.failed");
    expect((logger.errorEvents[0]?.error as Record<string, unknown>)?.message).toBe("database secret=[REDACTED]");
  });

  it("flags long-running spans using the default 5-second threshold", () => {
    const logger = new CapturingLogger();
    let now = 1_000;
    const tracer = createStartupTracer({
      logger,
      traceId: "trace-startup-4",
      clock: () => now,
    });

    const span = tracer.startSpan("persistence");
    now = 6_200;
    span.complete();

    expect(logger.infoEvents).toHaveLength(1);
    expect(logger.infoEvents[0]?.durationMs).toBe(5_200);
    expect(logger.infoEvents[0]?.slow).toBe(true);
    expect(logger.infoEvents[0]?.slowWarning).toBe(true);
    expect(logger.infoEvents[0]?.slowSpanThresholdMs).toBe(5_000);
    expect(logger.infoEvents[0]?.slowWarningThresholdMs).toBe(5_000);
    expect(logger.warnEvents).toHaveLength(1);
    expect(logger.warnEvents[0]?.event).toBe("startup.span.slow");
    expect(logger.warnEvents[0]?.startupCorrelationId).toBe("trace-startup-4");
    expect(logger.warnEvents[0]?.spanName).toBe("persistence");
    expect(logger.warnEvents[0]?.durationMs).toBe(5_200);
    expect(logger.warnEvents[0]?.thresholdExceededByMs).toBe(200);
  });

  it("supports configurable slow warning thresholds by span name", () => {
    const logger = new CapturingLogger();
    let now = 2_000;
    const tracer = createStartupTracer({
      logger,
      traceId: "trace-startup-5",
      clock: () => now,
      slowSpanWarnings: {
        defaultThresholdMs: 4_000,
        thresholdsBySpanName: {
          dependencies: 150,
        },
      },
    });

    const dependencies = tracer.startSpan("dependencies");
    now = 2_170;
    dependencies.complete();

    const persistence = tracer.startSpan("persistence");
    now = 5_000;
    persistence.complete();

    expect(logger.infoEvents).toHaveLength(2);
    expect(logger.warnEvents).toHaveLength(1);
    expect(logger.infoEvents[0]?.slowWarning).toBe(true);
    expect(logger.infoEvents[0]?.slowWarningThresholdMs).toBe(150);
    expect(logger.warnEvents[0]?.spanName).toBe("dependencies");
    expect(logger.warnEvents[0]?.slowWarningThresholdMs).toBe(150);
    expect(logger.infoEvents[1]?.slowWarning).toBe(false);
    expect(logger.infoEvents[1]?.slowWarningThresholdMs).toBe(4_000);
  });
});

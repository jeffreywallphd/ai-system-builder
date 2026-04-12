import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationObservability,
  type RunOrchestrationMetricsEvent,
  type RunOrchestrationObservabilityLogEvent,
  type RunOrchestrationObservabilityLogger,
} from "../RunOrchestrationObservability";

class CapturingRunOrchestrationLogger implements RunOrchestrationObservabilityLogger {
  public readonly infoEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly warnEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly errorEvents: RunOrchestrationObservabilityLogEvent[] = [];

  public info(event: RunOrchestrationObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: RunOrchestrationObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: RunOrchestrationObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

describe("RunOrchestrationObservability", () => {
  it("redacts prompt, secret, path, and backend payload fields before logging", async () => {
    const logger = new CapturingRunOrchestrationLogger();
    const observability = new RunOrchestrationObservability({ logger });

    await observability.record({
      event: "run.orchestration.execution-update.completed",
      operation: "execution-update",
      outcome: "failure",
      severity: "error",
      runId: "run:redaction",
      workspaceId: "workspace-alpha",
      details: Object.freeze({
        prompt: "Draw a private portrait",
        apiToken: "Bearer top-secret-token",
        rawPath: "C:\\Users\\private\\workspace\\secret.db",
        backendPayload: Object.freeze({
          inputParameters: Object.freeze({
            guidance: 7.5,
            rawPrompt: "do not leak this",
          }),
        }),
        backendDetails: Object.freeze({
          unsafeBackendResponse: "hidden",
        }),
      }),
    });

    expect(logger.errorEvents).toHaveLength(1);
    const logged = logger.errorEvents[0];
    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain("Draw a private portrait");
    expect(serialized).not.toContain("top-secret-token");
    expect(serialized).not.toContain("C:\\\\Users\\\\private\\\\workspace\\\\secret.db");
    expect(serialized).not.toContain("do not leak this");
    expect(serialized).not.toContain("hidden");
    expect(serialized).toContain("[REDACTED]");
    expect(logged.slice).toBe("image-manipulation");
    expect(logged.correlation.runId).toBe("run:redaction");
    expect(logged.correlation.workspaceId).toBe("workspace-alpha");
    expect(logged.resilience?.length).toBeGreaterThan(0);
    expect(logged.resilience?.[0]?.category).toBe("operational");
  });

  it("emits operation and counter metrics with operation/outcome tags", async () => {
    const logger = new CapturingRunOrchestrationLogger();
    const metrics: RunOrchestrationMetricsEvent[] = [];
    const observability = new RunOrchestrationObservability({
      logger,
      metricsSink: {
        emit: async (event) => {
          metrics.push(event);
        },
      },
    });

    await observability.record({
      event: "run.orchestration.query.list-queue-status.completed",
      operation: "query.list-queue-status",
      outcome: "success",
      severity: "info",
      workspaceId: "workspace-alpha",
      counters: Object.freeze({
        queue_items_total: 3,
        state_running_total: 1,
      }),
    });

    expect(logger.infoEvents).toHaveLength(1);
    expect(metrics.some((event) => event.name === "run_orchestration_operation_total")).toBeTrue();
    expect(metrics.some((event) => event.name === "run_orchestration_queue_items_total" && event.value === 3)).toBeTrue();
    expect(metrics.some((event) => event.name === "run_orchestration_state_running_total" && event.value === 1)).toBeTrue();
    expect(logger.infoEvents[0]?.slice).toBe("image-manipulation");
    expect(logger.infoEvents[0]?.correlation.workspaceId).toBe("workspace-alpha");
    expect(logger.infoEvents[0]?.resilience).toBeUndefined();
    for (const metric of metrics) {
      expect(metric.tags?.operation).toBe("query.list-queue-status");
      expect(metric.tags?.outcome).toBe("success");
    }
  });
});

import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import {
  emitAuthoritativeServerStartupTelemetry,
  type AuthoritativeServerStartupTelemetryLogger,
} from "../AuthoritativeServerStartupTelemetry";

class CapturingTelemetryLogger implements AuthoritativeServerStartupTelemetryLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly warnEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(event: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(event);
  }

  public warn(event: Readonly<Record<string, unknown>>): void {
    this.warnEvents.push(event);
  }

  public error(event: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(event);
  }
}

function createBoot(): ReturnType<typeof createHostBootConfiguration> {
  return createHostBootConfiguration({
    host: AuthoritativeServerHostRuntime,
    mode: "cold-start",
    startupReason: "authoritative-server-startup-telemetry-test",
    requiredDependencyIds: ["dep:application:control-plane-services"],
  });
}

describe("AuthoritativeServerStartupTelemetry", () => {
  it("emits startup summary info and regression warning events on successful startup", async () => {
    const logger = new CapturingTelemetryLogger();
    const boot = createBoot();

    await emitAuthoritativeServerStartupTelemetry({
      boot,
      startupTracer: undefined,
      startupStartedAtMs: Date.now() - 10,
      startupStartedAt: new Date(Date.now() - 10).toISOString(),
      startupFailure: undefined,
      pipelineStageSummaries: Object.freeze([{
        stageId: "configuration",
        sequence: 1,
        status: "completed",
        startedAt: "2026-04-12T00:00:00.000Z",
        endedAt: "2026-04-12T00:00:00.010Z",
        durationMs: 10,
      }]),
      authoritativeStageStatus: Object.freeze([{
        stageId: "transport-startup",
        sequence: 7,
        state: "success",
        durationMs: 3,
      }]),
      startupReadinessReport: Object.freeze({
        state: "ready",
        checks: Object.freeze([]),
        securityMaterial: Object.freeze({
          state: "ready",
          blocking: false,
          lifecycleStage: "test",
          productionCapable: false,
          issueCount: 0,
          fatalIssueCount: 0,
          warningIssueCount: 0,
          summary: Object.freeze({
            total: 0,
            healthy: 0,
            degraded: 0,
            missing: 0,
            nonCompliant: 0,
          }),
          issues: Object.freeze([]),
          entries: Object.freeze([]),
          governanceAssertions: Object.freeze({
            total: 0,
            warning: 0,
            blocked: 0,
            entries: Object.freeze([]),
          }),
        }),
        totalCheckCount: 0,
        readyCheckCount: 0,
        degradedCheckCount: 0,
        failedCheckCount: 0,
        blockingFailureCount: 0,
      }),
      logger,
      recordStartupBaseline: async () => Object.freeze({
        baselinePath: "C:/tmp/authoritative-server-startup-baseline.json",
        sampleCount: 5,
        regressionWarning: Object.freeze({
          thresholdMs: 1_000,
          baselineDurationMs: 2_000,
          currentDurationMs: 3_500,
          regressionDurationMs: 1_500,
          previousSampleCount: 4,
        }),
      }),
    });

    const summary = logger.infoEvents.find((event) => event.event === "authoritative-server.startup.summary");
    expect(summary).toBeDefined();
    expect(summary?.outcome).toBe("succeeded");
    const startupResult = summary?.startupResult as Record<string, unknown> | undefined;
    const readiness = startupResult?.readiness as Record<string, unknown> | undefined;
    expect(readiness?.state).toBe("ready");
    expect((readiness?.securityMaterial as Record<string, unknown> | undefined)?.state).toBe("ready");

    const regressionWarning = logger.warnEvents.find(
      (event) => event.event === "authoritative-server.startup.baseline-regression.detected",
    );
    expect(regressionWarning).toBeDefined();
    expect(regressionWarning?.thresholdMs).toBe(1_000);
    expect(logger.errorEvents).toHaveLength(0);
  });

  it("emits startup failure summary and baseline-recording warning on baseline errors", async () => {
    const logger = new CapturingTelemetryLogger();
    const boot = createBoot();

    await emitAuthoritativeServerStartupTelemetry({
      boot,
      startupTracer: undefined,
      startupStartedAtMs: Date.now() - 10,
      startupStartedAt: new Date(Date.now() - 10).toISOString(),
      startupFailure: new Error("startup-failed"),
      pipelineStageSummaries: Object.freeze([{
        stageId: "security",
        sequence: 4,
        status: "failed",
        startedAt: "2026-04-12T00:00:00.000Z",
        endedAt: "2026-04-12T00:00:00.010Z",
        durationMs: 10,
        failure: Object.freeze({
          name: "Error",
          message: "startup-failed",
        }),
      }]),
      authoritativeStageStatus: Object.freeze([]),
      startupReadinessReport: Object.freeze({
        state: "degraded",
        checks: Object.freeze([]),
        securityMaterial: Object.freeze({
          state: "blocked",
          blocking: true,
          lifecycleStage: "production",
          productionCapable: true,
          issueCount: 1,
          fatalIssueCount: 1,
          warningIssueCount: 0,
          summary: Object.freeze({
            total: 1,
            healthy: 0,
            degraded: 0,
            missing: 1,
            nonCompliant: 0,
          }),
          issues: Object.freeze([]),
          entries: Object.freeze([]),
          governanceAssertions: Object.freeze({
            total: 0,
            warning: 0,
            blocked: 0,
            entries: Object.freeze([]),
          }),
        }),
        totalCheckCount: 0,
        readyCheckCount: 0,
        degradedCheckCount: 0,
        failedCheckCount: 0,
        blockingFailureCount: 0,
      }),
      logger,
      recordStartupBaseline: async () => {
        throw new Error("baseline-write-failed");
      },
    });

    const summary = logger.errorEvents.find((event) => event.event === "authoritative-server.startup.summary");
    expect(summary).toBeDefined();
    expect(summary?.outcome).toBe("failed");
    expect(summary?.startupFailure).toEqual({
      name: "Error",
      message: "startup-failed",
    });
    const startupResult = summary?.startupResult as Record<string, unknown> | undefined;
    const readiness = startupResult?.readiness as Record<string, unknown> | undefined;
    expect((readiness?.securityMaterial as Record<string, unknown> | undefined)?.state).toBe("blocked");

    const baselineWarning = logger.warnEvents.find(
      (event) => event.event === "authoritative-server.startup.baseline-recording.failed",
    );
    expect(baselineWarning).toBeDefined();
    expect((baselineWarning?.error as Record<string, unknown> | undefined)?.message).toBe("baseline-write-failed");
  });
});

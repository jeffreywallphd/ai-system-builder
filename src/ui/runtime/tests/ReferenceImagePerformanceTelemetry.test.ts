import { describe, expect, it } from "bun:test";
import {
  ReferenceImagePerformancePhaseIds,
  ReferenceImagePerformanceTelemetrySession,
  buildReferenceImagePerformanceBaselines,
} from "../ReferenceImagePerformanceTelemetry";

describe("ReferenceImagePerformanceTelemetry", () => {
  it("captures bounded phase timing and aggregates baseline scenarios", async () => {
    const single = new ReferenceImagePerformanceTelemetrySession();
    single.startPhase(ReferenceImagePerformancePhaseIds.preparation);
    await Promise.resolve();
    single.endPhase(ReferenceImagePerformancePhaseIds.preparation);
    single.startPhase(ReferenceImagePerformancePhaseIds.execution);
    await Promise.resolve();
    single.endPhase(ReferenceImagePerformancePhaseIds.execution);

    const singleReport = single.finalize({
      runId: "run:single",
      status: "completed",
      persistedItemCount: 1,
      batchItemCount: 1,
    });

    const batch = new ReferenceImagePerformanceTelemetrySession();
    batch.startPhase(ReferenceImagePerformancePhaseIds.execution);
    await Promise.resolve();
    batch.endPhase(ReferenceImagePerformancePhaseIds.execution);
    const batchReport = batch.finalize({
      runId: "run:batch",
      status: "completed",
      persistedItemCount: 3,
      batchItemCount: 3,
    });

    expect(singleReport.phaseMeasurements.length).toBeGreaterThan(0);
    expect(singleReport.totalDurationMs).toBeGreaterThanOrEqual(0);

    const baselines = buildReferenceImagePerformanceBaselines([singleReport, batchReport]);
    expect(baselines.some((entry) => entry.scenario === "single")).toBeTrue();
    expect(baselines.some((entry) => entry.scenario === "repeated")).toBeTrue();
    expect(baselines.some((entry) => entry.scenario === "batch")).toBeTrue();
  });
});

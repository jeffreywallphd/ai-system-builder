import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import {
  DefaultAuthoritativeServerStartupBaselineFileName,
  recordAuthoritativeServerStartupBaseline,
  type AuthoritativeServerStartupBaselineMeasurement,
} from "../AuthoritativeServerStartupBaselineRecorder";

function createMeasurement(input: {
  readonly startupReason: string;
  readonly durationMs: number;
  readonly outcome?: "succeeded" | "failed";
}): AuthoritativeServerStartupBaselineMeasurement {
  return Object.freeze({
    hostId: "host:server:authoritative",
    startupReason: input.startupReason,
    outcome: input.outcome ?? "succeeded",
    durationMs: input.durationMs,
    startedAt: "2026-04-09T00:00:00.000Z",
    completedAt: "2026-04-09T00:00:01.000Z",
    traceId: "trace-test",
    startupCorrelationId: "corr-test",
    pipelineStageDurations: Object.freeze({
      configuration: 10,
    }),
    authoritativeStageDurations: Object.freeze({
      services: 20,
    }),
  });
}

describe("AuthoritativeServerStartupBaselineRecorder", () => {
  it("returns a regression warning when startup duration exceeds baseline threshold", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-baseline-regression-warning-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");
    try {
      const firstResult = await recordAuthoritativeServerStartupBaseline({
        databasePath,
        measurement: createMeasurement({
          startupReason: "baseline-run",
          durationMs: 100,
        }),
        regressionWarningThresholdMs: 50,
      });
      expect(firstResult?.regressionWarning).toBeUndefined();

      const secondResult = await recordAuthoritativeServerStartupBaseline({
        databasePath,
        measurement: createMeasurement({
          startupReason: "regression-run",
          durationMs: 220,
        }),
        regressionWarningThresholdMs: 50,
      });
      expect(secondResult?.sampleCount).toBe(2);
      expect(secondResult?.regressionWarning).toEqual({
        thresholdMs: 50,
        baselineDurationMs: 100,
        currentDurationMs: 220,
        regressionDurationMs: 120,
        previousSampleCount: 1,
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("does not emit a regression warning when duration increase is below threshold", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-baseline-no-regression-warning-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");
    const baselinePath = path.join(tempRoot, DefaultAuthoritativeServerStartupBaselineFileName);
    try {
      await recordAuthoritativeServerStartupBaseline({
        databasePath,
        measurement: createMeasurement({
          startupReason: "baseline-run",
          durationMs: 200,
        }),
        regressionWarningThresholdMs: 100,
      });

      const secondResult = await recordAuthoritativeServerStartupBaseline({
        databasePath,
        measurement: createMeasurement({
          startupReason: "steady-run",
          durationMs: 250,
        }),
        regressionWarningThresholdMs: 100,
      });
      expect(secondResult?.regressionWarning).toBeUndefined();

      const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
        readonly sampleCount: number;
      };
      expect(baseline.sampleCount).toBe(2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("skips baseline persistence for failed startup outcomes", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ai-loom-baseline-failed-startup-test-"));
    const databasePath = path.join(tempRoot, "authoritative-server.sqlite");
    const baselinePath = path.join(tempRoot, DefaultAuthoritativeServerStartupBaselineFileName);
    try {
      const result = await recordAuthoritativeServerStartupBaseline({
        databasePath,
        measurement: createMeasurement({
          startupReason: "failed-run",
          durationMs: 500,
          outcome: "failed",
        }),
      });
      expect(result).toBeUndefined();
      await expect(readFile(baselinePath, "utf8")).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

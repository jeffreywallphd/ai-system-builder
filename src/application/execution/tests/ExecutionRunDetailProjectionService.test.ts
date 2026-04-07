import { describe, expect, it } from "bun:test";
import { ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "@domain/execution/ExecutionRun";
import { ExecutionRunDetailProjectionService } from "../ExecutionRunDetailProjectionService";

function makeRun(overrides: Partial<IExecutionRunRecord> = {}): IExecutionRunRecord {
  return Object.freeze({
    runId: "run-1",
    planId: "model-training:job-1",
    status: ExecutionStatuses.completed,
    unitIds: Object.freeze(["model-training:job-1"]),
    units: Object.freeze({
      "model-training:job-1": Object.freeze({
        unitId: "model-training:job-1",
        kind: ExecutionUnitKinds.modelTraining,
        label: "Support model run",
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        outputMetadata: Object.freeze({ trainingJobId: "job-1", progressPercent: 100, checkpointCount: 2 }),
        outputSummary: Object.freeze({ headline: "Local training completed", detail: "Training completed.", metadata: { progressPercent: 100 } }),
        provenance: Object.freeze({
          classification: "real" as const,
          executorId: "python-runtime-local",
          runtime: "python-runtime",
          detail: "Real NumPy gradient training.",
          metadata: Object.freeze({ path: "/tmp/job-1" }),
          sourceKind: "model-training",
        }),
        diagnostics: Object.freeze([{ code: "local_training_completed", severity: "info" as const, message: "Training completed." }]),
        artifacts: Object.freeze([{ kind: "model-training-job", value: { id: "job-1" } }]),
        startedAt: "2026-03-23T00:00:01.000Z",
        completedAt: "2026-03-23T00:02:00.000Z",
        updatedAt: "2026-03-23T00:02:00.000Z",
      }),
    }),
    transitions: Object.freeze([
      Object.freeze({ unitId: "model-training:job-1", toStatus: ExecutionStatuses.running, occurredAt: "2026-03-23T00:00:01.000Z" }),
      Object.freeze({ unitId: "model-training:job-1", fromStatus: ExecutionStatuses.running, toStatus: ExecutionStatuses.completed, occurredAt: "2026-03-23T00:02:00.000Z" }),
    ]),
    startedAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:02:00.000Z",
    completedAt: "2026-03-23T00:02:00.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({ executionKind: "model-training", baseModelName: "Base One", datasetName: "Support QA" }),
    terminalSummary: Object.freeze({ headline: "Local training completed", detail: "Training completed." }),
    diagnosticsSummary: Object.freeze({ headline: "1 diagnostic recorded", detail: "info: Training completed." }),
    ...overrides,
  });
}

describe("ExecutionRunDetailProjectionService", () => {
  it("projects durable run metadata, unit detail, timeline, diagnostics, and artifact summaries", () => {
    const projection = new ExecutionRunDetailProjectionService().project(makeRun());

    expect(projection.summary.executionPathLabel).toBe("Real execution");
    expect(projection.units[0]?.outputSummary).toContain("Local training completed");
    expect(projection.timeline).toHaveLength(2);
    expect(projection.diagnostics[0]?.message).toBe("Training completed.");
    expect(projection.artifactSummary?.labels).toContain("model-training-job");
    expect(projection.provenanceEntries.some((entry) => entry.value.includes("/tmp/job-1"))).toBe(true);
  });
});


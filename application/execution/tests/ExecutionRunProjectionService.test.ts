import { describe, expect, it } from "bun:test";
import { ExecutionStatuses, ExecutionUnitKinds } from "../../../domain/execution/ExecutionPlan";
import type { IExecutionRunRecord } from "../../../domain/execution/ExecutionRun";
import { ExecutionRunProjectionService } from "../ExecutionRunProjectionService";

function makeRun(overrides: Partial<IExecutionRunRecord> = {}): IExecutionRunRecord {
  return Object.freeze({
    runId: "run-1",
    planId: "workflow-run:wf-1",
    status: ExecutionStatuses.running,
    unitIds: Object.freeze(["prepare", "workflow:wf-1"]),
    units: Object.freeze({
      prepare: Object.freeze({
        unitId: "prepare",
        kind: ExecutionUnitKinds.datasetGeneration,
        label: "Prepare context",
        dependsOn: Object.freeze([]),
        status: ExecutionStatuses.completed,
        updatedAt: "2026-03-23T00:00:10.000Z",
      }),
      "workflow:wf-1": Object.freeze({
        unitId: "workflow:wf-1",
        kind: ExecutionUnitKinds.workflow,
        label: "Run workflow",
        dependsOn: Object.freeze(["prepare"]),
        status: ExecutionStatuses.running,
        updatedAt: "2026-03-23T00:00:20.000Z",
        provenance: Object.freeze({
          classification: "delegated",
          executorId: "python-runtime",
          detail: "Delegated to Python.",
          sourceKind: "workflow",
        }),
      }),
    }),
    transitions: Object.freeze([]),
    startedAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:20.000Z",
    cancellationSupported: true,
    metadata: Object.freeze({ executionKind: "workflow", workflowName: "Support flow" }),
    ...overrides,
  });
}

describe("ExecutionRunProjectionService", () => {
  it("projects current unit, progress, and execution path summaries", () => {
    const projection = new ExecutionRunProjectionService().project(makeRun());

    expect(projection.currentUnitLabel).toBe("Run workflow");
    expect(projection.progressPercent).toBe(50);
    expect(projection.progressLabel).toContain("1/2 units");
    expect(projection.executionPathLabel).toBe("Delegated execution");
    expect(projection.metadataSummary).toContain("Support flow");
  });

  it("projects terminal and error summaries for failed runs", () => {
    const projection = new ExecutionRunProjectionService().project(makeRun({
      status: ExecutionStatuses.failed,
      completedAt: "2026-03-23T00:00:30.000Z",
      finalErrorMessage: "Dataset manifest was invalid.",
      terminalSummary: Object.freeze({
        headline: "Model preparation failed",
        detail: "Dataset manifest was invalid.",
      }),
      units: Object.freeze({
        prepare: Object.freeze({
          unitId: "prepare",
          kind: ExecutionUnitKinds.modelPreparation,
          label: "Prepare bundle",
          dependsOn: Object.freeze([]),
          status: ExecutionStatuses.failed,
          updatedAt: "2026-03-23T00:00:30.000Z",
        }),
      }),
      unitIds: Object.freeze(["prepare"]),
    }));

    expect(projection.statusTone).toBe("danger");
    expect(projection.terminalSummary).toContain("Model preparation failed");
    expect(projection.errorSummary).toBe("Dataset manifest was invalid.");
    expect(projection.durationSummary).toBe("30s");
  });

  it("prefers truthful runtime-reported progress when the active unit exposes it", () => {
    const projection = new ExecutionRunProjectionService().project(makeRun({
      unitIds: Object.freeze(["model-training:job-1"]),
      units: Object.freeze({
        "model-training:job-1": Object.freeze({
          unitId: "model-training:job-1",
          kind: ExecutionUnitKinds.modelTraining,
          label: "Train adapter",
          dependsOn: Object.freeze([]),
          status: ExecutionStatuses.running,
          updatedAt: "2026-03-23T00:00:20.000Z",
          outputMetadata: Object.freeze({
            progressPercent: 50,
            currentEpoch: 1,
            totalEpochs: 2,
            currentStep: 20,
            totalSteps: 40,
            jobStatus: "running",
          }),
        }),
      }),
      metadata: Object.freeze({ executionKind: "model-training", baseModelName: "Base One" }),
    }));

    expect(projection.progressPercent).toBe(50);
    expect(projection.progressLabel).toContain("50%");
    expect(projection.progressLabel).toContain("epoch 1/2");
    expect(projection.progressLabel).toContain("step 20/40");
  });
});

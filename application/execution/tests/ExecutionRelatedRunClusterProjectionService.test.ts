import { describe, expect, it } from "bun:test";
import { ExecutionRelatedRunClusterProjectionService } from "../ExecutionRelatedRunClusterProjectionService";
import type { ExecutionRunProjection } from "../ExecutionRunProjectionService";

const runA: ExecutionRunProjection = Object.freeze({
  runId: "run-a",
  planId: "plan-1",
  executionKind: "workflow",
  executionFlowId: "flow-1",
  status: "completed",
  statusLabel: "Completed",
  statusTone: "success",
  completedUnits: 1,
  totalUnits: 1,
  progressPercent: 100,
  progressLabel: "1/1 units",
  executionPathLabel: "Delegated execution",
  startedAt: "2026-03-24T00:00:00.000Z",
  updatedAt: "2026-03-24T00:00:01.000Z",
  durationSummary: "1s",
});

const runB: ExecutionRunProjection = Object.freeze({
  ...runA,
  runId: "run-b",
  startedAt: "2026-03-24T00:00:02.000Z",
  updatedAt: "2026-03-24T00:00:03.000Z",
});

describe("ExecutionRelatedRunClusterProjectionService", () => {
  it("projects related runs into a flow-labelled newest-first cluster", () => {
    const service = new ExecutionRelatedRunClusterProjectionService();
    const cluster = service.project("run-a", [runA, runB]);

    expect(cluster.groupLabel).toBe("Execution flow flow-1");
    expect(cluster.orderingLabel).toBe("Newest first");
    expect(cluster.runs.map((entry) => entry.run.runId)).toEqual(["run-b", "run-a"]);
    expect(cluster.runs.find((entry) => entry.run.runId === "run-a")?.isAnchor).toBe(true);
  });
});

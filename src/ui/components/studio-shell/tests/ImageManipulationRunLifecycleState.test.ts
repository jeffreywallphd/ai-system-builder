import { describe, expect, it } from "bun:test";
import {
  buildRunProgressSnapshot,
  mapExecutionReadinessToRunLifecycleState,
  mapExecutionFlowSnapshotToRunLifecycleState,
  mapRuntimeStatusToRunLifecycleState,
} from "../image-manipulation/ImageManipulationRunLifecycleState";

describe("ImageManipulationRunLifecycleState", () => {
  it("maps running snapshots to queued and running UI states", () => {
    const queued = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "running",
      steps: [{
        stepId: "trigger",
        status: "running",
        userLabel: "Preparing",
      }],
      issues: [],
    });

    const running = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "running",
      steps: [{
        stepId: "execution",
        status: "running",
        userLabel: "Working",
      }],
      issues: [],
    });

    expect(queued.state).toBe("queued");
    expect(running.state).toBe("running");
  });

  it("maps terminal snapshots to completed and failed", () => {
    const completed = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "completed",
      steps: [],
      issues: [],
    });

    const failed = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "failed",
      steps: [],
      issues: [],
    });

    expect(completed.state).toBe("completed");
    expect(failed.state).toBe("failed");
  });

  it("maps runtime status responses to normalized lifecycle states", () => {
    expect(mapRuntimeStatusToRunLifecycleState("pending").state).toBe("queued");
    expect(mapRuntimeStatusToRunLifecycleState("running").state).toBe("running");
    expect(mapRuntimeStatusToRunLifecycleState("running", {
      totalNodeCount: 6,
      completedNodeCount: 0,
      failedNodeCount: 0,
      runningNodeCount: 1,
      updatedAt: "2026-04-08T19:00:00.000Z",
    }).state).toBe("preparing");
    expect(mapRuntimeStatusToRunLifecycleState("succeeded").state).toBe("completed");
    expect(mapRuntimeStatusToRunLifecycleState("failed").state).toBe("failed");
    expect(mapRuntimeStatusToRunLifecycleState("cancelled").state).toBe("cancelled");
  });

  it("maps degraded execution readiness for launch-time monitoring", () => {
    const degraded = mapExecutionReadinessToRunLifecycleState({
      backendFamily: "adapter.comfyui.image-manipulation",
      checkedAt: "2026-04-08T19:00:00.000Z",
      readiness: "degraded",
      readyForExecution: true,
      message: "Capacity is constrained.",
      capabilities: {
        backendFamily: "adapter.comfyui.image-manipulation",
        supportsProgressPolling: true,
        supportsProgressStreaming: false,
        supportsCancellation: true,
        supportsOutputDiscovery: true,
        supportedOperationKinds: Object.freeze(["image-to-image"]),
        supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
      },
      nodeAvailability: {
        state: "constrained",
        checkedAt: "2026-04-08T19:00:00.000Z",
        candidateNodeCount: 1,
        eligibleNodeCount: 1,
        unavailableNodeCount: 0,
        incompatibleNodeCount: 0,
        topBlockingReasonCodes: Object.freeze([]),
        topTransientAvailabilityReasonCodes: Object.freeze(["node-offline"]),
      },
      issues: Object.freeze([]),
    });

    expect(degraded.state).toBe("degraded");
  });

  it("builds progress snapshots from authoritative run status", () => {
    const snapshot = buildRunProgressSnapshot({
      executionId: "run-1",
      status: "running",
      rootAssetId: "asset:root:1",
      startedAt: "2026-04-08T19:00:00.000Z",
      updatedAt: "2026-04-08T19:00:30.000Z",
      progress: {
        totalNodeCount: 8,
        completedNodeCount: 3,
        failedNodeCount: 1,
        runningNodeCount: 2,
        updatedAt: "2026-04-08T19:00:30.000Z",
      },
      executedVersionMap: {
        nodeVersionIds: Object.freeze({}),
      },
      nestedExecutionLineage: Object.freeze([]),
    });

    expect(snapshot.available).toBeTrue();
    expect(snapshot.percentComplete).toBe(38);
    expect(snapshot.summary).toContain("3/8 nodes complete");
  });

  it("describes queued progress when node-level counts are not yet available", () => {
    const queued = buildRunProgressSnapshot({
      executionId: "run-2",
      status: "pending",
      rootAssetId: "asset:root:2",
      startedAt: "2026-04-08T19:00:00.000Z",
      updatedAt: "2026-04-08T19:00:10.000Z",
      progress: {
        totalNodeCount: 0,
        completedNodeCount: 0,
        failedNodeCount: 0,
        runningNodeCount: 0,
        updatedAt: "2026-04-08T19:00:10.000Z",
      },
      executedVersionMap: {
        nodeVersionIds: Object.freeze({}),
      },
      nestedExecutionLineage: Object.freeze([]),
    });

    expect(queued.available).toBeFalse();
    expect(queued.summary).toContain("Queued");
  });
});

import { describe, expect, it } from "bun:test";
import {
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
    expect(mapRuntimeStatusToRunLifecycleState("succeeded").state).toBe("completed");
    expect(mapRuntimeStatusToRunLifecycleState("failed").state).toBe("failed");
    expect(mapRuntimeStatusToRunLifecycleState("cancelled").state).toBe("cancelled");
  });
});

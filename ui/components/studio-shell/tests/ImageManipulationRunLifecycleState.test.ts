import { describe, expect, it } from "bun:test";
import { mapExecutionFlowSnapshotToRunLifecycleState } from "../image-manipulation/ImageManipulationRunLifecycleState";

describe("ImageManipulationRunLifecycleState", () => {
  it("maps running snapshots to preparing and running UI states", () => {
    const preparing = mapExecutionFlowSnapshotToRunLifecycleState({
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

    expect(preparing.state).toBe("preparing");
    expect(running.state).toBe("running");
  });

  it("maps terminal snapshots to success and failure", () => {
    const success = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "completed",
      steps: [],
      issues: [],
    });

    const failure = mapExecutionFlowSnapshotToRunLifecycleState({
      overallStatus: "failed",
      steps: [],
      issues: [],
    });

    expect(success.state).toBe("success");
    expect(failure.state).toBe("failure");
  });
});

import {
  ReferenceImageExecutionStepIds,
  type ReferenceImageExecutionFlowSnapshot,
} from "../../../runtime/ReferenceImageExecutionFlowService";

export type ImageManipulationRunLifecycleState =
  | "idle"
  | "validating"
  | "preparing"
  | "running"
  | "success"
  | "failure";

export interface ImageManipulationRunLifecycleSnapshot {
  readonly state: ImageManipulationRunLifecycleState;
  readonly message?: string;
}

export function createIdleImageManipulationRunLifecycleState(): ImageManipulationRunLifecycleSnapshot {
  return Object.freeze({
    state: "idle",
  });
}

export function mapExecutionFlowSnapshotToRunLifecycleState(
  snapshot: ReferenceImageExecutionFlowSnapshot,
): ImageManipulationRunLifecycleSnapshot {
  if (snapshot.overallStatus === "completed") {
    return Object.freeze({
      state: "success",
      message: "Done. Your result is ready.",
    });
  }
  if (snapshot.overallStatus === "failed" || snapshot.overallStatus === "partially-completed") {
    return Object.freeze({
      state: "failure",
      message: "Run failed. Check advanced details.",
    });
  }

  const executionStep = snapshot.steps.find((entry) => entry.stepId === ReferenceImageExecutionStepIds.execution);
  if (executionStep?.status === "running") {
    return Object.freeze({
      state: "running",
      message: executionStep.userLabel,
    });
  }

  const triggerStep = snapshot.steps.find((entry) => entry.stepId === ReferenceImageExecutionStepIds.trigger);
  if (triggerStep && (triggerStep.status === "started" || triggerStep.status === "running")) {
    return Object.freeze({
      state: "preparing",
      message: triggerStep.userLabel,
    });
  }

  return Object.freeze({
    state: "running",
    message: snapshot.steps[snapshot.steps.length - 1]?.userLabel,
  });
}

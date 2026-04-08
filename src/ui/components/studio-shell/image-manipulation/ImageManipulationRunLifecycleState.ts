import {
  ReferenceImageExecutionStepIds,
  type ReferenceImageExecutionFlowSnapshot,
} from "../../../runtime/ReferenceImageExecutionFlowService";
import type { RuntimeSdkExecutionStatusResponse } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";

export type ImageManipulationRunLifecycleState =
  | "idle"
  | "validating"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

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
      state: "completed",
      message: "Done. Your result is ready.",
    });
  }
  if (snapshot.overallStatus === "failed" || snapshot.overallStatus === "partially-completed") {
    return Object.freeze({
      state: "failed",
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
      state: "queued",
      message: triggerStep.userLabel,
    });
  }

  return Object.freeze({
    state: "running",
    message: snapshot.steps[snapshot.steps.length - 1]?.userLabel,
  });
}

export function mapRuntimeStatusToRunLifecycleState(
  status: RuntimeSdkExecutionStatusResponse["status"] | undefined,
): ImageManipulationRunLifecycleSnapshot {
  if (status === "pending") {
    return Object.freeze({
      state: "queued",
      message: "Your run is queued.",
    });
  }
  if (status === "running") {
    return Object.freeze({
      state: "running",
      message: "Creating your image.",
    });
  }
  if (status === "succeeded") {
    return Object.freeze({
      state: "completed",
      message: "Done. Your result is ready.",
    });
  }
  if (status === "cancelled") {
    return Object.freeze({
      state: "cancelled",
      message: "This run was cancelled.",
    });
  }
  if (status === "failed") {
    return Object.freeze({
      state: "failed",
      message: "Run failed. Check advanced details.",
    });
  }
  return Object.freeze({
    state: "running",
    message: "Creating your image.",
  });
}

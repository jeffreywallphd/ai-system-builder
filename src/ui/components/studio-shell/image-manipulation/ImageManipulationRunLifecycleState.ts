import {
  ReferenceImageExecutionStepIds,
  type ReferenceImageExecutionFlowSnapshot,
} from "../../../runtime/ReferenceImageExecutionFlowService";
import type {
  RuntimeExecutionReadinessResponse,
  RuntimeSdkExecutionStatusResponse,
} from "@shared/contracts/runtime/SystemRuntimeTransportContracts";

export type ImageManipulationRunLifecycleState =
  | "idle"
  | "validating"
  | "queued"
  | "preparing"
  | "running"
  | "degraded"
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
  progress?: RuntimeSdkExecutionStatusResponse["progress"],
): ImageManipulationRunLifecycleSnapshot {
  if (status === "pending") {
    return Object.freeze({
      state: "queued",
      message: "Your run is queued for execution.",
    });
  }
  if (status === "running") {
    if (progress && progress.totalNodeCount > 0) {
      if (progress.completedNodeCount < 1) {
        return Object.freeze({
          state: "preparing",
          message: "Preparing execution resources.",
        });
      }
      return Object.freeze({
        state: "running",
        message: `Running (${progress.completedNodeCount}/${progress.totalNodeCount} nodes complete).`,
      });
    }
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

export function mapExecutionReadinessToRunLifecycleState(
  readiness: RuntimeExecutionReadinessResponse | undefined,
): ImageManipulationRunLifecycleSnapshot {
  if (!readiness) {
    return createIdleImageManipulationRunLifecycleState();
  }
  if (readiness.readiness === "degraded" && readiness.readyForExecution) {
    return Object.freeze({
      state: "degraded",
      message: readiness.message?.trim() || "Execution environment is degraded but available.",
    });
  }
  if (readiness.readiness === "unavailable" || !readiness.readyForExecution) {
    return Object.freeze({
      state: "validating",
      message: readiness.message?.trim() || "Execution environment is currently unavailable.",
    });
  }
  return createIdleImageManipulationRunLifecycleState();
}

export interface ImageManipulationRunProgressSnapshot {
  readonly available: boolean;
  readonly completedNodeCount: number;
  readonly totalNodeCount: number;
  readonly runningNodeCount: number;
  readonly failedNodeCount: number;
  readonly percentComplete: number;
  readonly summary: string;
}

export function buildRunProgressSnapshot(
  status: RuntimeSdkExecutionStatusResponse | undefined,
): ImageManipulationRunProgressSnapshot {
  const progress = status?.progress;
  if (!progress || progress.totalNodeCount < 1) {
    return Object.freeze({
      available: false,
      completedNodeCount: 0,
      totalNodeCount: 0,
      runningNodeCount: 0,
      failedNodeCount: 0,
      percentComplete: 0,
      summary: "Progress details will appear after execution starts.",
    });
  }

  const completed = Math.max(0, progress.completedNodeCount);
  const total = Math.max(1, progress.totalNodeCount);
  const percentComplete = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
  const failed = Math.max(0, progress.failedNodeCount);
  const running = Math.max(0, progress.runningNodeCount);
  const summary = failed > 0
    ? `${completed}/${total} nodes complete (${failed} failed, ${running} running).`
    : `${completed}/${total} nodes complete (${running} running).`;

  return Object.freeze({
    available: true,
    completedNodeCount: completed,
    totalNodeCount: total,
    runningNodeCount: running,
    failedNodeCount: failed,
    percentComplete,
    summary,
  });
}

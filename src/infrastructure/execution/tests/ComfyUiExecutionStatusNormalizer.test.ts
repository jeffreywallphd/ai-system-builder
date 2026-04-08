import { describe, expect, it } from "bun:test";
import { ImageManipulationExecutionStates } from "@application/image-workflows/ports";
import { normalizeComfyUiExecutionState } from "../comfyui/ComfyUiExecutionStatusNormalizer";

describe("ComfyUiExecutionStatusNormalizer", () => {
  it("maps queued snapshots into stable queued progress with user-safe message", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-1",
      runId: "run-1",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-1",
      backendSnapshot: Object.freeze({
        state: "queued",
        checkedAt: "2026-04-08T11:00:00.000Z",
        queuePosition: 2,
      }),
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.queued);
    expect(snapshot.progress?.queuePosition).toBe(2);
    expect(snapshot.progress?.percent).toBe(0);
    expect(snapshot.message).toBe("Waiting in queue (position 3).");
    expect(snapshot.warnings?.length ?? 0).toBe(0);
  });

  it("maps running snapshots with partial progress and clamps out-of-range percent values", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-2",
      runId: "run-2",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-2",
      backendSnapshot: Object.freeze({
        state: "running",
        checkedAt: "2026-04-08T11:01:00.000Z",
        statusMessage: "running",
      }),
      progress: Object.freeze({
        percent: 140,
        stageCode: "render",
        stageLabel: "Rendering",
        partialOutputCount: 1,
      }),
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.running);
    expect(snapshot.progress?.percent).toBe(100);
    expect(snapshot.progress?.partialOutputCount).toBe(1);
    expect(snapshot.message).toBe("Rendering (100%).");
  });

  it("maps completed snapshots into terminal completion summaries", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-3",
      runId: "run-3",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-3",
      backendSnapshot: Object.freeze({
        state: "completed",
        checkedAt: "2026-04-08T11:02:00.000Z",
        completed: true,
      }),
      outputCount: 4,
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.completed);
    expect(snapshot.terminalState).toBe("completed");
    expect(snapshot.completion?.outputCount).toBe(4);
    expect(snapshot.progress).toBeUndefined();
    expect(snapshot.error).toBeUndefined();
  });

  it("maps failed timeout snapshots into retryable normalized failures with diagnostics", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-4",
      runId: "run-4",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-4",
      backendSnapshot: Object.freeze({
        state: "failed",
        checkedAt: "2026-04-08T11:03:00.000Z",
        statusMessage: "timed out waiting for completion",
      }),
      progress: Object.freeze({
        percent: 68,
        partialOutputCount: 2,
      }),
      backendStatusCode: "E_TIMEOUT",
      backendDetails: Object.freeze({
        pollCount: 50,
      }),
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.failed);
    expect(snapshot.error?.category).toBe("timeout");
    expect(snapshot.error?.code).toBe("execution-timeout");
    expect(snapshot.error?.retryable).toBeTrue();
    expect(snapshot.error?.partialOutputCount).toBe(2);
    expect(snapshot.backendDiagnostics?.rawStatusCode).toBe("E_TIMEOUT");
  });

  it("maps missing-model failures into dependency category with safe messaging", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-missing-model",
      runId: "run-missing-model",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-mm-1",
      backendSnapshot: Object.freeze({
        state: "failed",
        checkedAt: "2026-04-08T11:04:30.000Z",
        statusMessage: "missing-model checkpoint not found",
      }),
      backendStatusCode: "prompt-rejected",
      backendDetails: Object.freeze({
        path: "C:\\comfy\\models\\secret\\checkpoint.safetensors",
      }),
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.failed);
    expect(snapshot.error?.category).toBe("dependency");
    expect(snapshot.error?.code).toBe("execution-missing-model-dependency");
    expect(snapshot.error?.retryable).toBeFalse();
    expect(snapshot.error?.userMessage).toContain("required model");
    const details = snapshot.error?.diagnostics?.details as Readonly<Record<string, unknown>>;
    expect(String(details.path)).toContain("[redacted-path]");
  });

  it("maps cancelled snapshots into non-retryable cancellation failures", () => {
    const snapshot = normalizeComfyUiExecutionState({
      executionJobId: "job-5",
      runId: "run-5",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-5",
      backendSnapshot: Object.freeze({
        state: "cancelled",
        checkedAt: "2026-04-08T11:04:00.000Z",
      }),
    });

    expect(snapshot.state).toBe(ImageManipulationExecutionStates.cancelled);
    expect(snapshot.error?.category).toBe("cancellation");
    expect(snapshot.error?.retryable).toBeFalse();
  });

  it("degrades unknown or partial backend state data into safe preparing state with explicit warning", () => {
    const unknown = normalizeComfyUiExecutionState({
      executionJobId: "job-6",
      runId: "run-6",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-6",
      backendSnapshot: Object.freeze({
        state: "mystery-state",
        checkedAt: "2026-04-08T11:05:00.000Z",
      }),
    });

    expect(unknown.state).toBe(ImageManipulationExecutionStates.preparing);
    expect(unknown.warnings?.[0]?.code).toBe("backend-state-unknown");
    expect(unknown.message).toContain("Preparing execution");

    const degraded = normalizeComfyUiExecutionState({
      executionJobId: "job-7",
      runId: "run-7",
      workspaceId: "workspace-1",
      backendExecutionId: "prompt-7",
      backendSnapshot: Object.freeze({
        state: "running",
        checkedAt: "2026-04-08T11:06:00.000Z",
        statusMessage: "degraded",
      }),
    });

    expect(degraded.state).toBe(ImageManipulationExecutionStates.running);
    expect(degraded.warnings?.[0]?.code).toBe("backend-state-degraded");
    expect(degraded.message).toContain("delayed");
  });
});

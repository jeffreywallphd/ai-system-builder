import { describe, expect, it } from "bun:test";
import {
  ImageManipulationBackendJobStates,
  isImageManipulationExecutionTerminalState,
  normalizeImageManipulationBackendJobState,
  normalizeImageManipulationProgressPercent,
  type ImageManipulationBackendJobSnapshot,
} from "../ports";

describe("image manipulation execution status contracts", () => {
  it("normalizes backend state hints into canonical AI Loom job states", () => {
    expect(normalizeImageManipulationBackendJobState({ rawState: "pending" })).toBe(
      ImageManipulationBackendJobStates.queued,
    );
    expect(normalizeImageManipulationBackendJobState({ rawState: "starting" })).toBe(
      ImageManipulationBackendJobStates.preparing,
    );
    expect(normalizeImageManipulationBackendJobState({ rawState: "in-progress" })).toBe(
      ImageManipulationBackendJobStates.running,
    );
    expect(normalizeImageManipulationBackendJobState({ rawState: "succeeded" })).toBe(
      ImageManipulationBackendJobStates.completed,
    );
    expect(normalizeImageManipulationBackendJobState({ rawState: "error" })).toBe(
      ImageManipulationBackendJobStates.failed,
    );
    expect(normalizeImageManipulationBackendJobState({ rawState: "canceled" })).toBe(
      ImageManipulationBackendJobStates.cancelled,
    );
  });

  it("prioritizes explicit terminal flags over ambiguous raw states", () => {
    expect(normalizeImageManipulationBackendJobState({
      rawState: "running",
      failed: true,
    })).toBe(ImageManipulationBackendJobStates.failed);

    expect(normalizeImageManipulationBackendJobState({
      rawState: "queued",
      cancelled: true,
    })).toBe(ImageManipulationBackendJobStates.cancelled);
  });

  it("normalizes progress percent and terminal-state checks", () => {
    expect(normalizeImageManipulationProgressPercent(50.125)).toBe(50.13);
    expect(normalizeImageManipulationProgressPercent(150)).toBe(100);
    expect(normalizeImageManipulationProgressPercent(-8)).toBe(0);
    expect(normalizeImageManipulationProgressPercent("50")).toBeUndefined();

    expect(isImageManipulationExecutionTerminalState("completed")).toBeTrue();
    expect(isImageManipulationExecutionTerminalState("failed")).toBeTrue();
    expect(isImageManipulationExecutionTerminalState("cancelled")).toBeTrue();
    expect(isImageManipulationExecutionTerminalState("running")).toBeFalse();
  });

  it("supports warnings, partial progress, and partial output diagnostics in a normalized snapshot", () => {
    const snapshot: ImageManipulationBackendJobSnapshot = Object.freeze({
      executionJobId: "job:run-123",
      runId: "run-123",
      workspaceId: "workspace-1",
      state: "failed",
      updatedAt: "2026-04-08T20:11:15.000Z",
      progress: Object.freeze({
        state: "running",
        updatedAt: "2026-04-08T20:11:10.000Z",
        percent: 72,
        stageCode: "rendering",
        partialOutputCount: 1,
      }),
      warnings: Object.freeze([
        Object.freeze({
          code: "backend-latency-spike",
          severity: "warning",
          summary: "Backend response latency exceeded normal bounds.",
          userMessage: "Generation may take longer than expected.",
        }),
      ]),
      failure: Object.freeze({
        code: "execution-timeout",
        category: "timeout",
        summary: "Execution timed out while waiting for completion.",
        userMessage: "The run took too long and stopped before finishing.",
        retryable: true,
        failedAt: "2026-04-08T20:11:15.000Z",
        partialProgressObserved: true,
        partialOutputCount: 1,
        diagnostics: Object.freeze({
          provider: "comfyui",
          backendStatus: "timed out",
        }),
      }),
      backendDiagnostics: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        backendJobId: "comfy:123",
        rawState: "timed_out",
        rawStatusCode: "E_TIMEOUT",
      }),
    });

    expect(snapshot.progress?.partialOutputCount).toBe(1);
    expect(snapshot.warnings[0]?.code).toBe("backend-latency-spike");
    expect(snapshot.failure?.partialProgressObserved).toBeTrue();
    expect(snapshot.failure?.partialOutputCount).toBe(1);
  });
});

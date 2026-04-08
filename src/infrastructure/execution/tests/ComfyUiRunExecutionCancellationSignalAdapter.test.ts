import { describe, expect, it } from "bun:test";
import { RunCancellationSignalStatuses } from "@application/runs/ports/RunExecutionCancellationPorts";
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import { ImageManipulationExecutionCancellationStatuses } from "@application/image-workflows/ports";
import { ComfyUiRunExecutionCancellationSignalAdapter } from "../runs/ComfyUiRunExecutionCancellationSignalAdapter";

describe("ComfyUiRunExecutionCancellationSignalAdapter", () => {
  it("maps accepted and already-terminal responses to accepted run cancellation outcomes", async () => {
    const adapter = new ComfyUiRunExecutionCancellationSignalAdapter({
      cancellationPort: {
        requestExecutionCancellation: async () => Object.freeze({
          status: ImageManipulationExecutionCancellationStatuses.alreadyTerminal,
          acknowledgedAt: "2026-04-08T15:00:00.000Z",
          message: "already terminal",
          details: Object.freeze({ reason: "already-terminal" }),
        }),
      },
    });

    const result = await adapter.signalCancellation({
      runId: "run-1",
      workflowId: "workflow-1",
      workspaceId: "workspace-1",
      state: "running",
      backendKind: RunExecutionBackendKinds.comfyUi,
      backendRunId: "prompt-1",
      requestedAt: "2026-04-08T15:00:00.000Z",
    });

    expect(result.status).toBe(RunCancellationSignalStatuses.accepted);
    expect(result.safeCode).toBe("cancel-signal-accepted");
  });

  it("returns not-supported for non-comfy backends", async () => {
    const adapter = new ComfyUiRunExecutionCancellationSignalAdapter({
      cancellationPort: {
        requestExecutionCancellation: async () => {
          throw new Error("not called");
        },
      },
    });

    const result = await adapter.signalCancellation({
      runId: "run-2",
      workflowId: "workflow-2",
      workspaceId: "workspace-2",
      state: "running",
      backendKind: RunExecutionBackendKinds.remoteDispatch,
      backendRunId: "remote-run-2",
      requestedAt: "2026-04-08T15:10:00.000Z",
    });

    expect(result.status).toBe(RunCancellationSignalStatuses.notSupported);
    expect(result.safeCode).toBe("backend-not-supported");
  });
});

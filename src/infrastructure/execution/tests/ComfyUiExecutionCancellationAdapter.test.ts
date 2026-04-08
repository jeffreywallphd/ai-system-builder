import { describe, expect, it, mock } from "bun:test";
import {
  ImageManipulationExecutionCancellationStatuses,
  type IImageManipulationExecutionCancellationPort,
} from "@application/image-workflows/ports";
import { ComfyUiTransportClientError } from "../comfyui/ComfyUiTransportClient";
import { ComfyUiExecutionCancellationAdapter } from "../comfyui/ComfyUiExecutionCancellationAdapter";

describe("ComfyUiExecutionCancellationAdapter", () => {
  it("normalizes accepted cancellation with explicit adapter-local cleanup details", async () => {
    const transportClient = {
      requestPromptCancellation: mock(async () => Object.freeze({
        promptId: "prompt-cancel-1",
        status: "accepted",
        acknowledgedAt: "2026-04-08T14:00:10.000Z",
      })),
    };
    const cleanupPort = {
      releaseTemporaryReferences: mock(async () => Object.freeze({
        status: "completed",
        releasedReferenceCount: 2,
        acknowledgedAt: "2026-04-08T14:00:10.000Z",
        message: "released",
      })),
    };

    const adapter: IImageManipulationExecutionCancellationPort = new ComfyUiExecutionCancellationAdapter({
      transportClient,
      cleanupPort,
      resolveBackendExecutionId: () => "prompt-cancel-1",
      now: () => new Date("2026-04-08T14:00:00.000Z"),
    });

    const result = await adapter.requestExecutionCancellation({
      executionJobId: "job-cancel-1",
      runId: "run-cancel-1",
      workspaceId: "workspace-1",
      requestedAt: "2026-04-08T14:00:00.000Z",
      reason: "user-stop",
    });

    expect(result.status).toBe(ImageManipulationExecutionCancellationStatuses.accepted);
    expect(result.acknowledgedAt).toBe("2026-04-08T14:00:10.000Z");
    const details = result.details as Readonly<Record<string, unknown>>;
    const cleanup = details.cleanup as Readonly<Record<string, unknown>>;
    expect(cleanup.status).toBe("completed");
    expect(cleanup.releasedReferenceCount).toBe(2);
    expect(details.cancellationGuarantee).toBe("best-effort-comfyui-interrupt");
  });

  it("maps prompt not-found cancellation failures to not-found status", async () => {
    const transportClient = {
      requestPromptCancellation: mock(async () => {
        throw new ComfyUiTransportClientError({
          code: "http-error",
          message: "Prompt missing",
          retryable: false,
          diagnostics: Object.freeze({
            operation: "request-cancellation",
            path: "/interrupt",
            statusCode: 404,
          }),
        });
      }),
    };

    const adapter: IImageManipulationExecutionCancellationPort = new ComfyUiExecutionCancellationAdapter({
      transportClient,
      resolveBackendExecutionId: () => "prompt-missing",
      now: () => new Date("2026-04-08T14:02:00.000Z"),
    });

    const result = await adapter.requestExecutionCancellation({
      executionJobId: "job-cancel-2",
      runId: "run-cancel-2",
      workspaceId: "workspace-1",
      requestedAt: "2026-04-08T14:02:00.000Z",
    });

    expect(result.status).toBe(ImageManipulationExecutionCancellationStatuses.notFound);
    const details = result.details as Readonly<Record<string, unknown>>;
    const failure = details.failure as Readonly<Record<string, unknown>>;
    expect(failure.stageCode).toBe("cancelled");
    expect(failure.code).toBe("execution-failed");
  });

  it("preserves failed cancellation status while surfacing degraded cleanup outcomes", async () => {
    const transportClient = {
      requestPromptCancellation: mock(async () => {
        throw new ComfyUiTransportClientError({
          code: "transport-unavailable",
          message: "ComfyUI unreachable",
          retryable: true,
          diagnostics: Object.freeze({
            operation: "request-cancellation",
            path: "/interrupt",
          }),
        });
      }),
    };
    const cleanupPort = {
      releaseTemporaryReferences: mock(async () => {
        throw new Error("cleanup registry unavailable");
      }),
    };

    const adapter: IImageManipulationExecutionCancellationPort = new ComfyUiExecutionCancellationAdapter({
      transportClient,
      cleanupPort,
      resolveBackendExecutionId: () => "prompt-cancel-3",
      now: () => new Date("2026-04-08T14:03:00.000Z"),
    });

    const result = await adapter.requestExecutionCancellation({
      executionJobId: "job-cancel-3",
      runId: "run-cancel-3",
      workspaceId: "workspace-1",
      requestedAt: "2026-04-08T14:03:00.000Z",
    });

    expect(result.status).toBe(ImageManipulationExecutionCancellationStatuses.failed);
    const details = result.details as Readonly<Record<string, unknown>>;
    const failure = details.failure as Readonly<Record<string, unknown>>;
    const cleanup = details.cleanup as Readonly<Record<string, unknown>>;
    expect(failure.category).toBe("connectivity");
    expect(cleanup.status).toBe("degraded");
    expect(String(cleanup.message)).toContain("did not complete");
  });
});

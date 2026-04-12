import { describe, expect, it } from "bun:test";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  RunExecutionUpdateConflictError,
  RunExecutionUpdateValidationError,
  type IngestRunExecutionUpdateResult,
} from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import { AuthoritativeRunExecutionUpdateBackendApi } from "../AuthoritativeRunExecutionUpdateBackendApi";
import type { RunOrchestrationRealtimePublisher } from "../RunOrchestrationRealtimePublisher";
import {
  RunOrchestrationObservability,
  type RunOrchestrationObservabilityLogEvent,
  type RunOrchestrationObservabilityLogger,
} from "../RunOrchestrationObservability";

class CapturingRunObservabilityLogger implements RunOrchestrationObservabilityLogger {
  public readonly infoEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly warnEvents: RunOrchestrationObservabilityLogEvent[] = [];
  public readonly errorEvents: RunOrchestrationObservabilityLogEvent[] = [];

  public info(event: RunOrchestrationObservabilityLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: RunOrchestrationObservabilityLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: RunOrchestrationObservabilityLogEvent): void {
    this.errorEvents.push(event);
  }
}

class StubIngestRunExecutionUpdateUseCase {
  public nextError: unknown;
  public nextResult: IngestRunExecutionUpdateResult | undefined;

  public async execute(): Promise<IngestRunExecutionUpdateResult> {
    if (this.nextError) {
      throw this.nextError;
    }
    if (this.nextResult) {
      return this.nextResult;
    }

    return Object.freeze({
      mutation: Object.freeze({
        action: "lifecycle-update",
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "running",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T12:00:00.000Z",
          updatedAt: "2026-04-07T12:01:00.000Z",
          submission: Object.freeze({}),
          assignment: Object.freeze({
            status: "assigned",
            assignedNodeId: "node:trusted-1",
            assignedAt: "2026-04-07T12:00:00.000Z",
          }),
          execution: Object.freeze({
            outcome: "none",
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 2,
          }),
        }),
        mutation: Object.freeze({
          changed: true,
          mutationId: "mutation-1",
          occurredAt: "2026-04-07T12:01:00.000Z",
        }),
      }),
      status: Object.freeze({
        runId: "run:1",
        state: "running",
        updatedAt: "2026-04-07T12:01:00.000Z",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 2,
        }),
      }),
    });
  }
}

describe("AuthoritativeRunExecutionUpdateBackendApi", () => {
  it("returns canonical mutation/status payloads for successful ingestion", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const ingest = new StubIngestRunExecutionUpdateUseCase();
    const api = new AuthoritativeRunExecutionUpdateBackendApi({
      ingestRunExecutionUpdateUseCase: ingest as never,
      realtimePublisher,
    });

    const response = await api.ingestExecutionUpdate({
      runId: "run:1",
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: "run:1",
        senderNodeId: "node:trusted-1",
        heartbeatAt: "2026-04-07T12:01:00.000Z",
      }),
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.mutation.action).toBe("lifecycle-update");
    expect(response.data?.status.runId).toBe("run:1");
    expect(realtimeEvents).toHaveLength(2);
    expect((realtimeEvents[0]?.payload as { eventKind?: string }).eventKind).toBe("state-changed");
    expect((realtimeEvents[1]?.payload as { eventKind?: string }).eventKind).toBe("queue-updated");
  });

  it("maps validation and conflict errors to shared error envelopes", async () => {
    const ingest = new StubIngestRunExecutionUpdateUseCase();
    const api = new AuthoritativeRunExecutionUpdateBackendApi({
      ingestRunExecutionUpdateUseCase: ingest as never,
    });

    ingest.nextError = new RunExecutionUpdateValidationError("senderNodeId is required.");
    const invalid = await api.ingestExecutionUpdate({
      runId: "run:1",
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: "run:1",
      }),
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe(SharedApiErrorCodes.invalidRequest);

    ingest.nextError = new RunExecutionUpdateConflictError("terminal run");
    const conflict = await api.ingestExecutionUpdate({
      runId: "run:1",
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: "run:1",
      }),
    });
    expect(conflict.ok).toBeFalse();
    expect(conflict.error?.code).toBe(SharedApiErrorCodes.conflict);
  });

  it("publishes progress-updated orchestration events when execution progress changes", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const ingest = new StubIngestRunExecutionUpdateUseCase();
    ingest.nextResult = Object.freeze({
      mutation: Object.freeze({
        action: "lifecycle-update",
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:progress",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "running",
          assignmentStatus: "assigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T12:00:00.000Z",
          updatedAt: "2026-04-07T12:05:00.000Z",
          submission: Object.freeze({}),
          assignment: Object.freeze({
            status: "assigned",
            assignedNodeId: "node:trusted-1",
            assignedAt: "2026-04-07T12:00:00.000Z",
          }),
          execution: Object.freeze({
            outcome: "none",
            progress: Object.freeze({
              updatedAt: "2026-04-07T12:05:00.000Z",
              percent: 50,
              stage: "render",
            }),
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 2,
          }),
        }),
        mutation: Object.freeze({
          changed: true,
          mutationId: "mutation-progress",
          occurredAt: "2026-04-07T12:05:00.000Z",
        }),
      }),
      status: Object.freeze({
        runId: "run:progress",
        state: "running",
        updatedAt: "2026-04-07T12:05:00.000Z",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 2,
        }),
      }),
    });

    const api = new AuthoritativeRunExecutionUpdateBackendApi({
      ingestRunExecutionUpdateUseCase: ingest as never,
      realtimePublisher,
    });

    const response = await api.ingestExecutionUpdate({
      runId: "run:progress",
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: "run:progress",
        progress: Object.freeze({
          updatedAt: "2026-04-07T12:05:00.000Z",
          percent: 50,
          stage: "render",
        }),
      }),
    });

    expect(response.ok).toBeTrue();
    expect((realtimeEvents[0]?.payload as { eventKind?: string }).eventKind).toBe("progress-updated");
  });

  it("emits dispatch-failure markers and node correlation in observability logs", async () => {
    const logger = new CapturingRunObservabilityLogger();
    const observability = new RunOrchestrationObservability({ logger });
    const ingest = new StubIngestRunExecutionUpdateUseCase();
    ingest.nextResult = Object.freeze({
      mutation: Object.freeze({
        action: "lifecycle-update",
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:dispatch-failed",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "failed",
          assignmentStatus: "released",
          executionOutcome: "failed",
          submittedAt: "2026-04-07T12:00:00.000Z",
          updatedAt: "2026-04-07T12:02:00.000Z",
          submission: Object.freeze({
            correlationId: "corr-dispatch-1",
          }),
          assignment: Object.freeze({
            status: "released",
          }),
          execution: Object.freeze({
            outcome: "failed",
            errorCode: "dispatch-failed-to-start",
            errorMessage: "safe failure",
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 2,
          }),
        }),
        mutation: Object.freeze({
          changed: true,
          mutationId: "mutation-dispatch-failed",
          occurredAt: "2026-04-07T12:02:00.000Z",
        }),
      }),
      status: Object.freeze({
        runId: "run:dispatch-failed",
        state: "failed",
        updatedAt: "2026-04-07T12:02:00.000Z",
        assignmentStatus: "released",
        executionOutcome: "failed",
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 2,
        }),
      }),
    });

    const api = new AuthoritativeRunExecutionUpdateBackendApi({
      ingestRunExecutionUpdateUseCase: ingest as never,
      observability,
    });

    const response = await api.ingestExecutionUpdate({
      runId: "run:dispatch-failed",
      senderNodeId: "node:trusted-99",
      update: Object.freeze({
        runId: "run:dispatch-failed",
        senderBackendKind: "local-worker",
        senderBackendRunId: "backend-run-1",
      }),
    });

    expect(response.ok).toBeTrue();
    expect(logger.infoEvents).toHaveLength(1);
    expect(logger.infoEvents[0]?.nodeId).toBe("node:trusted-99");
    expect(logger.infoEvents[0]?.correlationId).toBe("corr-dispatch-1");
    expect(logger.infoEvents[0]?.markers).toContain("dispatch-failure-marker");
  });
});

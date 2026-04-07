import { describe, expect, it } from "bun:test";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationNotFoundError,
  RunCancellationValidationError,
  type RequestAuthoritativeRunCancellationResult,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import {
  RequestAuthoritativeRunRetryUseCase,
  RunRetryIneligibleError,
  RunRetryNotFoundError,
  RunRetryValidationError,
  type RequestAuthoritativeRunRetryResult,
} from "@application/runs/use-cases/RequestAuthoritativeRunRetryUseCase";
import { AuthoritativeRunMutationBackendApi } from "../AuthoritativeRunMutationBackendApi";
import type { RunOrchestrationRealtimePublisher } from "../RunOrchestrationRealtimePublisher";

class StubRequestAuthoritativeRunCancellationUseCase {
  public nextError: unknown;

  public async execute(): Promise<RequestAuthoritativeRunCancellationResult> {
    if (this.nextError) {
      throw this.nextError;
    }

    return Object.freeze({
      outcome: "cancelled",
      mutation: Object.freeze({
        action: "cancel",
        run: buildRun("run:1", "cancelled", 1, undefined),
        mutation: Object.freeze({
          changed: true,
          mutationId: "run:cancel:run:1:cancel:1",
          occurredAt: "2026-04-07T12:10:00.000Z",
        }),
      }),
      status: Object.freeze({
        runId: "run:1",
        state: "cancelled",
        updatedAt: "2026-04-07T12:10:00.000Z",
        assignmentStatus: "released",
        executionOutcome: "cancelled",
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 3,
        }),
      }),
    });
  }
}

class StubRequestAuthoritativeRunRetryUseCase {
  public nextError: unknown;

  public async execute(): Promise<RequestAuthoritativeRunRetryResult> {
    if (this.nextError) {
      throw this.nextError;
    }

    return Object.freeze({
      sourceRunId: "run:1",
      retriedRunId: "run:2",
      mutation: Object.freeze({
        action: "retry",
        run: buildRun("run:2", "queued", 2, "run:1"),
        mutation: Object.freeze({
          changed: true,
          mutationId: "audit:retry:1",
          occurredAt: "2026-04-07T12:11:00.000Z",
        }),
      }),
    });
  }
}

function buildRun(runId: string, state: string, attempt: number, previousRunId: string | undefined) {
  return Object.freeze({
    contractVersion: "run-orchestration-transport/v1",
    runId,
    workflowId: "workflow:demo",
    workspaceId: "workspace-alpha",
    source: state === "queued" ? "ui-rerun" : "api",
    state,
    assignmentStatus: state === "cancelled" ? "released" : "unassigned",
    executionOutcome: state === "cancelled" ? "cancelled" : "none",
    submittedAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:10:00.000Z",
    submission: Object.freeze({
      submittedByActorId: "user:owner",
    }),
    assignment: Object.freeze(
      state === "cancelled"
        ? {
          status: "released",
          assignedNodeId: "node:trusted-1",
          assignedAt: "2026-04-07T12:01:00.000Z",
          releasedAt: "2026-04-07T12:10:00.000Z",
        }
        : {
          status: "unassigned",
        },
    ),
    execution: Object.freeze(
      state === "cancelled"
        ? {
          outcome: "cancelled",
          startedAt: "2026-04-07T12:02:00.000Z",
          finishedAt: "2026-04-07T12:10:00.000Z",
        }
        : {
          outcome: "none",
        },
    ),
    cancellation: state === "cancelled"
      ? Object.freeze({
        requestedAt: "2026-04-07T12:10:00.000Z",
        requestedByActorId: "user:ops",
        acknowledgedAt: "2026-04-07T12:10:00.000Z",
      })
      : undefined,
    retry: Object.freeze({
      attempt,
      maxAttempts: 3,
      previousRunId,
    }),
  });
}

describe("AuthoritativeRunMutationBackendApi", () => {
  it("returns canonical cancellation mutation payload on success", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const retry = new StubRequestAuthoritativeRunRetryUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
      requestAuthoritativeRunRetryUseCase: retry as unknown as RequestAuthoritativeRunRetryUseCase,
      realtimePublisher,
    });

    const response = await api.cancelRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      cancellation: {
        runId: "run:1",
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.action).toBe("cancel");
    expect(response.data?.run.state).toBe("cancelled");
    expect(realtimeEvents).toHaveLength(2);
    expect((realtimeEvents[0]?.payload as { eventKind?: string }).eventKind).toBe("cancelled");
    expect((realtimeEvents[1]?.payload as { eventKind?: string }).eventKind).toBe("queue-updated");
  });

  it("maps cancellation validation and not-found failures to shared error semantics", async () => {
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const retry = new StubRequestAuthoritativeRunRetryUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
      requestAuthoritativeRunRetryUseCase: retry as unknown as RequestAuthoritativeRunRetryUseCase,
    });

    cancellation.nextError = new RunCancellationValidationError("runId is required.");
    const invalid = await api.cancelRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      cancellation: {
        runId: "run:1",
      },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe(SharedApiErrorCodes.invalidRequest);

    cancellation.nextError = new RunCancellationNotFoundError("run:missing");
    const notFound = await api.cancelRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      cancellation: {
        runId: "run:missing",
      },
    });
    expect(notFound.ok).toBeFalse();
    expect(notFound.error?.code).toBe(SharedApiErrorCodes.notFound);
  });

  it("returns canonical retry mutation payload on success", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const retry = new StubRequestAuthoritativeRunRetryUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
      requestAuthoritativeRunRetryUseCase: retry as unknown as RequestAuthoritativeRunRetryUseCase,
      realtimePublisher,
    });

    const response = await api.retryRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      retry: {
        runId: "run:1",
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.action).toBe("retry");
    expect(response.data?.run.retry.previousRunId).toBe("run:1");
    expect(response.data?.run.retry.attempt).toBe(2);
    expect(realtimeEvents).toHaveLength(2);
    expect((realtimeEvents[0]?.payload as { eventKind?: string }).eventKind).toBe("retry-queued");
    expect((realtimeEvents[1]?.payload as { eventKind?: string }).eventKind).toBe("queue-enqueued");
  });

  it("maps retry eligibility and not-found failures to shared error semantics", async () => {
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const retry = new StubRequestAuthoritativeRunRetryUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
      requestAuthoritativeRunRetryUseCase: retry as unknown as RequestAuthoritativeRunRetryUseCase,
    });

    retry.nextError = new RunRetryValidationError("runId is required.");
    const invalid = await api.retryRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      retry: {
        runId: "run:1",
      },
    });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe(SharedApiErrorCodes.invalidRequest);

    retry.nextError = new RunRetryIneligibleError({
      reason: "state-not-eligible",
      runId: "run:completed",
      currentState: "completed",
    });
    const ineligible = await api.retryRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      retry: {
        runId: "run:completed",
      },
    });
    expect(ineligible.ok).toBeFalse();
    expect(ineligible.error?.code).toBe(SharedApiErrorCodes.invalidRequest);

    retry.nextError = new RunRetryNotFoundError("run:missing");
    const notFound = await api.retryRun({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      retry: {
        runId: "run:missing",
      },
    });
    expect(notFound.ok).toBeFalse();
    expect(notFound.error?.code).toBe(SharedApiErrorCodes.notFound);
  });
});

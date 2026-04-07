import { describe, expect, it } from "bun:test";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationNotFoundError,
  RunCancellationValidationError,
  type RequestAuthoritativeRunCancellationResult,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import { AuthoritativeRunMutationBackendApi } from "../AuthoritativeRunMutationBackendApi";

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
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:1",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "api",
          state: "cancelled",
          assignmentStatus: "released",
          executionOutcome: "cancelled",
          submittedAt: "2026-04-07T12:00:00.000Z",
          updatedAt: "2026-04-07T12:10:00.000Z",
          submission: Object.freeze({
            submittedByActorId: "user:owner",
          }),
          assignment: Object.freeze({
            status: "released",
            assignedNodeId: "node:trusted-1",
            assignedAt: "2026-04-07T12:01:00.000Z",
            releasedAt: "2026-04-07T12:10:00.000Z",
          }),
          execution: Object.freeze({
            outcome: "cancelled",
            startedAt: "2026-04-07T12:02:00.000Z",
            finishedAt: "2026-04-07T12:10:00.000Z",
          }),
          cancellation: Object.freeze({
            requestedAt: "2026-04-07T12:10:00.000Z",
            requestedByActorId: "user:ops",
            acknowledgedAt: "2026-04-07T12:10:00.000Z",
          }),
          retry: Object.freeze({
            attempt: 1,
            maxAttempts: 3,
          }),
        }),
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

describe("AuthoritativeRunMutationBackendApi", () => {
  it("returns canonical cancellation mutation payload on success", async () => {
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
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
  });

  it("maps validation and not-found failures to shared error semantics", async () => {
    const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
    const api = new AuthoritativeRunMutationBackendApi({
      requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
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
});

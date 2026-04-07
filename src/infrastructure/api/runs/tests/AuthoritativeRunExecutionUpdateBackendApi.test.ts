import { describe, expect, it } from "bun:test";
import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";
import {
  RunExecutionUpdateConflictError,
  RunExecutionUpdateValidationError,
  type IngestRunExecutionUpdateResult,
} from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import { AuthoritativeRunExecutionUpdateBackendApi } from "../AuthoritativeRunExecutionUpdateBackendApi";

class StubIngestRunExecutionUpdateUseCase {
  public nextError: unknown;

  public async execute(): Promise<IngestRunExecutionUpdateResult> {
    if (this.nextError) {
      throw this.nextError;
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
    const ingest = new StubIngestRunExecutionUpdateUseCase();
    const api = new AuthoritativeRunExecutionUpdateBackendApi({
      ingestRunExecutionUpdateUseCase: ingest as never,
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
});

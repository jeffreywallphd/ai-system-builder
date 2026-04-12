import { describe, expect, it } from "bun:test";
import { parseRunListReadRequest } from "@shared/schemas/runtime/RunOrchestrationTransportSchemaContracts";
import {
  toRunCancellationApiRequest,
  toRunDetailApiRequest,
  toRunExecutionUpdateApiRequest,
  toRunQueryApiRequest,
  toRunRetryApiRequest,
  toRunStatusApiRequest,
  toRunSubmissionApiRequest,
} from "../dto/RunRouteDtoMapper";

const workspaceContext = Object.freeze({
  actor: Object.freeze({ userIdentityId: "user-1" }),
  workspace: Object.freeze({ workspaceId: "workspace-1" }),
  session: Object.freeze({ authenticatedAt: "2026-04-12T00:00:00.000Z" }),
});

describe("Run route DTO mapper", () => {
  it("maps parsed run submission payloads into application requests", () => {
    const request = toRunSubmissionApiRequest(
      workspaceContext,
      Object.freeze({
        runtimeTarget: Object.freeze({ systemId: "system-1", versionId: "version-1" }),
      }),
    );

    expect(request).toEqual({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      submission: {
        runtimeTarget: {
          systemId: "system-1",
          versionId: "version-1",
        },
      },
    });
  });

  it("maps parsed read queries with authorization context", () => {
    const parsed = parseRunListReadRequest({
      workspaceId: "workspace-1",
      searchParams: new URLSearchParams("limit=10"),
    });
    if (!parsed.ok) {
      throw new Error("Expected run list read parser to succeed.");
    }

    const request = toRunQueryApiRequest(workspaceContext, parsed.data);

    expect(request.workspaceId).toBe("workspace-1");
    expect(request.authorization).toEqual({
      actorUserIdentityId: "user-1",
      activeWorkspaceId: "workspace-1",
      authenticatedAt: "2026-04-12T00:00:00.000Z",
    });
  });

  it("maps detail and status reads with shared authorization payload", () => {
    const detailRequest = toRunDetailApiRequest(workspaceContext, "run-1");
    const statusRequest = toRunStatusApiRequest(workspaceContext, "run-1");

    expect(detailRequest).toEqual({
      runId: "run-1",
      workspaceId: "workspace-1",
      authorization: {
        actorUserIdentityId: "user-1",
        activeWorkspaceId: "workspace-1",
        authenticatedAt: "2026-04-12T00:00:00.000Z",
      },
    });
    expect(statusRequest).toEqual(detailRequest);
  });

  it("maps cancellation, retry, and execution update requests", () => {
    const cancellationRequest = toRunCancellationApiRequest(
      workspaceContext,
      Object.freeze({ runId: "run-1", reason: "user-request" }),
    );
    const retryRequest = toRunRetryApiRequest(
      workspaceContext,
      Object.freeze({ runId: "run-1", reason: "retry-request" }),
    );
    const updateRequest = toRunExecutionUpdateApiRequest(
      "run-1",
      "node-1",
      Object.freeze({ toState: "running" }),
    );

    expect(cancellationRequest.cancellation).toEqual({ runId: "run-1", reason: "user-request" });
    expect(retryRequest.retry).toEqual({ runId: "run-1", reason: "retry-request" });
    expect(updateRequest).toEqual({
      runId: "run-1",
      senderNodeId: "node-1",
      update: { toState: "running" },
    });
  });
});


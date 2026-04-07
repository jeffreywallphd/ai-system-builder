import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationTransportSchemaValidationError,
  parseRunCancellationRequest,
  parseRunListReadRequest,
  parseRunListReadResponse,
  parseRunLifecycleEventEnvelope,
  parseRunLifecycleUpdateRequest,
  parseRunQueueStatusReadRequest,
  parseRunStatusEnvelope,
  parseRunSubmissionRequest,
  toLegacyRuntimeStartRunRequest,
} from "../RunOrchestrationTransportSchemaContracts";

describe("RunOrchestrationTransportSchemaContracts", () => {
  it("parses canonical run submission payload", () => {
    const parsed = parseRunSubmissionRequest({
      workflowId: "workflow:1",
      workspaceId: "workspace:1",
      source: "api",
      runtimeTarget: {
        systemId: "system:1",
        versionId: "version:1",
        async: true,
      },
    });

    expect(parsed.workflowId).toBe("workflow:1");
    expect(parsed.runtimeTarget.systemId).toBe("system:1");
  });

  it("parses legacy runtime submission payloads and maps to canonical shape", () => {
    const parsed = parseRunSubmissionRequest({
      systemId: "system:legacy",
      versionId: "version:legacy",
      async: true,
      idempotencyKey: "key-1",
    });

    expect(parsed.workflowId).toBe("system:legacy");
    expect(parsed.runtimeTarget.versionId).toBe("version:legacy");

    const legacy = toLegacyRuntimeStartRunRequest(parsed);
    expect(legacy.systemId).toBe("system:legacy");
    expect(legacy.idempotencyKey).toBe("key-1");
  });

  it("parses cancellation and queue status request contracts", () => {
    const cancel = parseRunCancellationRequest({
      runId: "run-1",
      reason: "requested by operator",
      idempotencyKey: "cancel-1",
    });
    expect(cancel.runId).toBe("run-1");

    const queueRead = parseRunQueueStatusReadRequest({
      workspaceId: "workspace-1",
      statuses: ["queued", "running"],
      limit: 10,
      offset: 0,
    });
    expect(queueRead.statuses?.length).toBe(2);
  });

  it("parses authoritative run list read contracts", () => {
    const request = parseRunListReadRequest({
      workspaceId: "workspace-1",
      states: ["submitted", "running"],
      sources: ["api"],
      search: "workflow-alpha",
      limit: 25,
      offset: 10,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    expect(request.workspaceId).toBe("workspace-1");
    expect(request.states?.length).toBe(2);

    const response = parseRunListReadResponse({
      items: [{
        contractVersion: "run-orchestration-transport/v1",
        runId: "run-1",
        workflowId: "workflow-1",
        workspaceId: "workspace-1",
        source: "api",
        state: "running",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        submittedAt: "2026-04-07T10:00:00.000Z",
        updatedAt: "2026-04-07T10:00:05.000Z",
      }],
      totalCount: 1,
    });
    expect(response.items[0]?.runId).toBe("run-1");
  });

  it("parses run lifecycle event envelopes", () => {
    const event = parseRunLifecycleEventEnvelope({
      eventId: "event-1",
      eventKind: "run-state-changed",
      occurredAt: "2026-04-07T12:00:00.000Z",
      run: {
        runId: "run-1",
        state: "running",
        updatedAt: "2026-04-07T12:00:00.000Z",
        assignmentStatus: "assigned",
        executionOutcome: "none",
        retry: {
          attempt: 1,
          maxAttempts: 3,
        },
      },
    });

    expect(event.run.state).toBe("running");
  });

  it("parses execution lifecycle updates with progress and sender metadata", () => {
    const parsed = parseRunLifecycleUpdateRequest({
      runId: "run-1",
      occurredAt: "2026-04-07T12:04:00.000Z",
      senderNodeId: "node:trusted-1",
      senderBackendKind: "local-worker",
      senderBackendRunId: "backend-run-1",
      heartbeatAt: "2026-04-07T12:04:00.000Z",
      progress: {
        updatedAt: "2026-04-07T12:04:00.000Z",
        percent: 65,
        stage: "decode-latents",
        message: "step 26/40",
      },
      execution: {
        outcome: "none",
        heartbeatAt: "2026-04-07T12:04:00.000Z",
      },
      internalDiagnostics: {
        workerPid: 4142,
      },
    });

    expect(parsed.senderNodeId).toBe("node:trusted-1");
    expect(parsed.progress?.percent).toBe(65);
    expect(parsed.toState).toBeUndefined();
  });

  it("parses status envelope execution progress projections", () => {
    const status = parseRunStatusEnvelope({
      runId: "run-1",
      state: "running",
      updatedAt: "2026-04-07T12:04:00.000Z",
      assignmentStatus: "assigned",
      executionOutcome: "none",
      execution: {
        startedAt: "2026-04-07T12:00:00.000Z",
        heartbeatAt: "2026-04-07T12:04:00.000Z",
        progress: {
          updatedAt: "2026-04-07T12:04:00.000Z",
          percent: 65,
        },
      },
      retry: {
        attempt: 1,
        maxAttempts: 3,
      },
    });

    expect(status.execution?.progress?.percent).toBe(65);
  });

  it("rejects malformed run payloads", () => {
    expect(() => parseRunSubmissionRequest({
      runtimeTarget: {
        systemId: "",
        versionId: "version-1",
      },
    })).toThrow(RunOrchestrationTransportSchemaValidationError);
  });
});

import { describe, expect, it } from "bun:test";
import {
  parseExecutionReadinessReadRequest,
  parseExecutionReadinessReadResponse,
  RunOrchestrationTransportSchemaValidationError,
  parseRunCancellationRequest,
  parseRunListReadRequest,
  parseRunListReadResponse,
  parseRunLifecycleEventEnvelope,
  parseRunLifecycleUpdateRequest,
  parseRunQueueStatusReadRequest,
  parseRunQueueStatusReadResponse,
  parseSchedulingAdminListStaleReservationsRequest,
  parseSchedulingAdminListStaleReservationsResponse,
  parseSchedulingAdminReleaseStaleReservationRequest,
  parseSchedulingAdminReleaseStaleReservationResponse,
  parseSchedulingAdminReevaluateDeferredRunsRequest,
  parseSchedulingAdminReevaluateDeferredRunsResponse,
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

  it("parses queue status response contracts with scheduling visibility projections", () => {
    const parsed = parseRunQueueStatusReadResponse({
      items: [{
        runId: "run-1",
        workflowId: "workflow-1",
        workspaceId: "workspace-1",
        state: "queued",
        queue: {
          queueId: "queue-1",
          enteredAt: "2026-04-07T10:00:00.000Z",
          position: 1,
          positionAsOf: "2026-04-07T10:01:00.000Z",
        },
        assignmentStatus: "unassigned",
        executionOutcome: "none",
        updatedAt: "2026-04-07T10:01:00.000Z",
        scheduling: {
          candidateConstraints: {
            requiredCapabilities: ["executor"],
            requiresRemoteScheduling: true,
          },
          placement: {
            outcome: "deferred",
            reasonCodes: ["node-missing-capability"],
          },
          admin: {
            requiresAdministrativeAttention: true,
            reasonCodes: ["node-missing-capability"],
            decisionReasonCodes: ["no-eligible-candidates"],
            exclusionReasonCodes: ["node-missing-capability"],
          },
        },
      }],
      totalCount: 1,
      asOf: "2026-04-07T10:01:00.000Z",
      schedulingAdminSummary: {
        asOf: "2026-04-07T10:01:00.000Z",
        totalRuns: 1,
        deferredRuns: 1,
        requiresAdministrativeAttentionRuns: 1,
        reasonCodes: [{
          code: "node-missing-capability",
          count: 1,
        }],
        decisionReasonCodes: [{
          code: "no-eligible-candidates",
          count: 1,
        }],
        exclusionReasonCodes: [{
          code: "node-missing-capability",
          count: 1,
        }],
      },
    });

    expect(parsed.schedulingAdminSummary?.deferredRuns).toBe(1);
    expect(parsed.items[0]?.scheduling?.placement.outcome).toBe("deferred");
  });

  it("parses execution readiness read request and response contracts", () => {
    const request = parseExecutionReadinessReadRequest({
      workspaceId: "workspace-1",
      systemId: "system-1",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });
    expect(request.workspaceId).toBe("workspace-1");
    expect(request.operationKind).toBe("image-to-image");

    const response = parseExecutionReadinessReadResponse({
      backendFamily: "adapter.comfyui.image-manipulation",
      checkedAt: "2026-04-08T12:10:00.000Z",
      readiness: "degraded",
      readyForExecution: false,
      runtimeLifecycle: {
        contractVersion: "runtime-availability-response/v1",
        state: "warming",
        checkedAt: "2026-04-08T12:10:00.000Z",
        updatedAt: "2026-04-08T12:10:00.000Z",
        retryable: true,
        blockingReasons: [{
          code: "capability-warmup-in-progress",
          message: "Deferred runtime activation is still warming.",
          retryable: true,
        }],
        warmupStartedAt: "2026-04-08T12:09:59.000Z",
      },
      message: "Execution backend is reachable but incompatible.",
      capabilities: {
        backendFamily: "adapter.comfyui.image-manipulation",
        supportsProgressPolling: true,
        supportsProgressStreaming: false,
        supportsCancellation: true,
        supportsOutputDiscovery: true,
        supportedOperationKinds: ["image-to-image"],
        supportedTranslationContractVersions: ["1.0.0"],
      },
      nodeAvailability: {
        state: "constrained",
        checkedAt: "2026-04-08T12:10:00.000Z",
        candidateNodeCount: 2,
        eligibleNodeCount: 0,
        unavailableNodeCount: 1,
        incompatibleNodeCount: 1,
        topBlockingReasonCodes: ["node-backend-family-unsupported"],
        topTransientAvailabilityReasonCodes: ["node-health-not-routable"],
        reasonCode: "execution-node-no-eligible-match",
      },
      issues: [{
        code: "translation-contract-version-unsupported",
        severity: "error",
        message: "Translation contract version '2.0.0' is not supported.",
      }],
      diagnostics: {
        compatibility: {
          compatible: false,
        },
      },
    });
    expect(response.readiness).toBe("degraded");
    expect(response.runtimeLifecycle?.state).toBe("warming");
    expect(response.issues[0]?.severity).toBe("error");
  });

  it("parses scheduling admin stale reservation and deferred re-evaluation contracts", () => {
    const listRequest = parseSchedulingAdminListStaleReservationsRequest({
      workspaceId: "workspace-1",
      queueId: "queue-1",
      asOf: "2026-04-07T10:01:00.000Z",
      limit: 10,
      offset: 0,
    });
    expect(listRequest.workspaceId).toBe("workspace-1");

    const listResponse = parseSchedulingAdminListStaleReservationsResponse({
      asOf: "2026-04-07T10:01:00.000Z",
      totalCount: 1,
      items: [{
        runId: "run-1",
        queueId: "queue-1",
        workspaceId: "workspace-1",
        claimToken: "queue-claim:1",
        claimedBy: "scheduler:1",
        claimedAt: "2026-04-07T09:58:00.000Z",
        claimExpiresAt: "2026-04-07T10:00:00.000Z",
        staleSeconds: 60,
      }],
    });
    expect(listResponse.items[0]?.staleSeconds).toBe(60);

    const releaseRequest = parseSchedulingAdminReleaseStaleReservationRequest({
      runId: "run-1",
      claimToken: "queue-claim:1",
      releasedAt: "2026-04-07T10:01:00.000Z",
      reason: "operator release",
    });
    expect(releaseRequest.runId).toBe("run-1");

    const releaseResponse = parseSchedulingAdminReleaseStaleReservationResponse({
      runId: "run-1",
      queueId: "queue-1",
      releasedAt: "2026-04-07T10:01:00.000Z",
      staleSeconds: 60,
      reservationOwner: "scheduler:1",
      mutation: {
        changed: true,
        mutationId: "mutation:1",
        occurredAt: "2026-04-07T10:01:00.000Z",
      },
    });
    expect(releaseResponse.mutation.changed).toBeTrue();

    const reevaluateRequest = parseSchedulingAdminReevaluateDeferredRunsRequest({
      queueId: "queue-1",
      runIds: ["run-1"],
      requestedAt: "2026-04-07T10:01:00.000Z",
      reason: "manual re-evaluation",
      limit: 20,
    });
    expect(reevaluateRequest.runIds?.[0]).toBe("run-1");

    const reevaluateResponse = parseSchedulingAdminReevaluateDeferredRunsResponse({
      requestedAt: "2026-04-07T10:01:00.000Z",
      reEvaluatedCount: 1,
      runIds: ["run-1"],
      mutation: {
        changed: true,
        mutationId: "mutation:2",
        occurredAt: "2026-04-07T10:01:00.000Z",
      },
    });
    expect(reevaluateResponse.reEvaluatedCount).toBe(1);
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
        actionAvailability: {
          cancel: { allowed: true },
          retry: { allowed: false, reason: "Retry is available only for failed or cancelled runs." },
          dequeue: { allowed: true },
        },
      }],
      totalCount: 1,
    });
    expect(response.items[0]?.runId).toBe("run-1");
    expect(response.items[0]?.actionAvailability?.cancel.allowed).toBeTrue();
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
      result: {
        summary: "Generated outputs persisted.",
        externalResultId: "result:run-1",
        resultAvailabilityState: "preview-pending",
        outputAvailabilityHint: "degraded",
        terminalQualityHint: "degraded",
        outputs: [{
          outputId: "output-1",
          kind: "asset",
          assetId: "asset:1",
        }],
      },
      internalDiagnostics: {
        workerPid: 4142,
      },
    });

    expect(parsed.senderNodeId).toBe("node:trusted-1");
    expect(parsed.progress?.percent).toBe(65);
    expect(parsed.result?.outputs?.[0]?.kind).toBe("asset");
    expect(parsed.result?.resultAvailabilityState).toBe("preview-pending");
    expect(parsed.result?.outputAvailabilityHint).toBe("degraded");
    expect(parsed.result?.terminalQualityHint).toBe("degraded");
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
      finalization: {
        finalizedAt: "2026-04-07T12:05:00.000Z",
        outcome: "cancelled",
        summary: "Generated 4 outputs.",
        resultAvailabilityState: "partially-collected",
        outputAvailability: "partial",
        terminalQuality: "partial",
        outputs: [{
          outputId: "output-1",
          kind: "asset",
          assetId: "asset:1",
        }],
      },
    });

    expect(status.execution?.progress?.percent).toBe(65);
    expect(status.finalization?.outcome).toBe("cancelled");
    expect(status.finalization?.resultAvailabilityState).toBe("partially-collected");
    expect(status.finalization?.terminalQuality).toBe("partial");
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

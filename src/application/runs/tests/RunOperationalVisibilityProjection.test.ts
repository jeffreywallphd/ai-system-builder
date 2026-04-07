import { describe, expect, it } from "bun:test";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  buildOperationalRunStatusTimeline,
  mergeOperationalStatusProjection,
  OperationalVisibilityAudiences,
} from "../use-cases/RunOperationalVisibilityProjection";

describe("RunOperationalVisibilityProjection", () => {
  it("builds timeline entries from authoritative lifecycle, dispatch, progress, cancellation, and retry events", () => {
    const run = createCanonicalRunRecord({
      identity: {
        runId: "run:1",
        workflowId: "workflow:demo",
        workspaceId: "workspace-alpha",
      },
      submission: {
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T10:00:00.000Z",
      },
      state: RunLifecycleStates.failed,
      assignment: {
        status: RunAssignmentStatuses.released,
        assignedNodeId: "node:trusted-1",
        assignedAt: "2026-04-07T10:00:15.000Z",
        releasedAt: "2026-04-07T10:01:20.000Z",
      },
      execution: {
        outcome: RunExecutionOutcomeKinds.failed,
        startedAt: "2026-04-07T10:00:22.000Z",
        finishedAt: "2026-04-07T10:01:20.000Z",
        errorCode: "dispatch-failed-to-start",
        errorMessage: "Run failed to start on backend.",
      },
      retry: {
        attempt: 2,
        maxAttempts: 3,
      },
      updatedAt: "2026-04-07T10:01:20.000Z",
    });

    const timeline = buildOperationalRunStatusTimeline({
      run,
      audience: OperationalVisibilityAudiences.user,
      dispatchAttempts: Object.freeze([Object.freeze({
        attemptId: "dispatch-attempt:1",
        runId: "run:1",
        queueId: "queue:default",
        workspaceId: "workspace-alpha",
        nodeId: "node:trusted-1",
        reservationOwner: "orchestrator:1",
        claimToken: "claim:1",
        preparedAt: "2026-04-07T10:00:20.000Z",
        dispatchMetadata: Object.freeze({}),
        dispatchResult: Object.freeze({
          status: "failed-to-start",
          recordedAt: "2026-04-07T10:00:21.000Z",
          failure: Object.freeze({
            safeCode: "dispatch-failed-to-start",
            safeMessage: "Run failed to start on backend.",
            internalCode: "adapter-timeout",
          }),
        }),
      })]),
      auditEvents: Object.freeze([
        Object.freeze({
          eventId: "audit:queue",
          eventKind: "runs",
          action: "run.orchestration-intent.recorded",
          actorId: "system",
          targetRef: "run:run:1",
          outcome: "succeeded",
          occurredAt: "2026-04-07T10:00:05.000Z",
          details: Object.freeze({
            lifecycleState: "queued",
          }),
        }),
        Object.freeze({
          eventId: "audit:lifecycle",
          eventKind: "runs",
          action: "run.lifecycle.transitioned",
          actorId: "system",
          targetRef: "run:run:1",
          outcome: "succeeded",
          occurredAt: "2026-04-07T10:00:22.000Z",
          details: Object.freeze({
            toState: "running",
            dispatchAttemptId: "dispatch-attempt:1",
            dispatchOutcome: "accepted",
          }),
        }),
        Object.freeze({
          eventId: "audit:progress",
          eventKind: "runs",
          action: "run.execution-update.ingested",
          actorId: "node:trusted-1",
          targetRef: "run:run:1",
          outcome: "succeeded",
          occurredAt: "2026-04-07T10:00:50.000Z",
          details: Object.freeze({
            toState: "running",
            hadProgress: true,
            hadHeartbeat: true,
            hadInternalDiagnostics: true,
          }),
        }),
        Object.freeze({
          eventId: "audit:cancellation",
          eventKind: "runs",
          action: "run.cancellation.requested",
          actorId: "user:owner",
          targetRef: "run:run:1",
          outcome: "succeeded",
          occurredAt: "2026-04-07T10:01:10.000Z",
          details: Object.freeze({
            toState: "cancelling",
            outcome: "cancellation-requested",
            reason: "operator-requested",
          }),
        }),
        Object.freeze({
          eventId: "audit:retry",
          eventKind: "runs",
          action: "run.retry.requested",
          actorId: "user:owner",
          targetRef: "run:run:1",
          outcome: "succeeded",
          occurredAt: "2026-04-07T10:01:25.000Z",
          details: Object.freeze({
            retriedRunId: "run:2",
            reason: "retry-after-failure",
          }),
        }),
      ]),
    });

    expect(timeline.some((entry) => entry.kind === "submission")).toBeTrue();
    expect(timeline.some((entry) => entry.kind === "dispatch-attempt")).toBeTrue();
    expect(timeline.some((entry) => entry.kind === "progress")).toBeTrue();
    expect(timeline.some((entry) => entry.kind === "cancellation")).toBeTrue();
    expect(timeline.some((entry) => entry.kind === "retry")).toBeTrue();
    expect(timeline.find((entry) => entry.kind === "dispatch-attempt" && entry.state === "failed")?.message).toContain("Run failed to start on backend.");
    expect(timeline.find((entry) => entry.kind === "progress")?.message).toContain("progress");
  });

  it("adds admin-only failure diagnostics when audience is admin", () => {
    const run = createCanonicalRunRecord({
      identity: {
        runId: "run:diag",
        workflowId: "workflow:diag",
        workspaceId: "workspace-alpha",
      },
      submission: {
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T10:00:00.000Z",
      },
      state: RunLifecycleStates.failed,
      assignment: {
        status: RunAssignmentStatuses.released,
      },
      execution: {
        outcome: RunExecutionOutcomeKinds.failed,
        errorCode: "dispatch-failed-to-start",
        errorMessage: "Run failed to start on backend.",
        finishedAt: "2026-04-07T10:01:20.000Z",
      },
      retry: {
        attempt: 1,
        maxAttempts: 2,
      },
      updatedAt: "2026-04-07T10:01:20.000Z",
    });

    const status = mergeOperationalStatusProjection({
      status: Object.freeze({
        runId: "run:diag",
        state: RunLifecycleStates.failed,
        updatedAt: "2026-04-07T10:01:20.000Z",
        assignmentStatus: RunAssignmentStatuses.released,
        executionOutcome: RunExecutionOutcomeKinds.failed,
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 2,
        }),
      }),
      run,
      audience: OperationalVisibilityAudiences.admin,
      dispatchAttempts: Object.freeze([Object.freeze({
        attemptId: "dispatch-attempt:diag",
        runId: "run:diag",
        queueId: "queue:default",
        workspaceId: "workspace-alpha",
        nodeId: "node:trusted-1",
        reservationOwner: "orchestrator:1",
        claimToken: "claim:diag",
        preparedAt: "2026-04-07T10:00:20.000Z",
        dispatchMetadata: Object.freeze({}),
        dispatchResult: Object.freeze({
          status: "failed-to-start",
          recordedAt: "2026-04-07T10:00:21.000Z",
          failure: Object.freeze({
            safeCode: "dispatch-failed-to-start",
            safeMessage: "Run failed to start on backend.",
            internalCode: "adapter-timeout",
            details: Object.freeze({
              retryWindowSeconds: 30,
            }),
          }),
        }),
      })]),
      metadata: Object.freeze({
        executionTelemetry: Object.freeze({
          lastInternalUpdate: Object.freeze({
            updatedAt: "2026-04-07T10:00:59.000Z",
            senderNodeId: "node:trusted-1",
            senderBackendKind: "local-worker",
            senderBackendRunId: "backend-run-1",
            diagnostics: Object.freeze({
              gpuWorkerPid: 4242,
            }),
          }),
        }),
      }),
      timeline: Object.freeze([]),
    });

    expect(status.failureSummary?.diagnostics?.visibility).toBe("admin");
    expect(status.failureSummary?.diagnostics?.latestDispatchFailure?.internalCode).toBe("adapter-timeout");
    expect(status.failureSummary?.diagnostics?.latestExecutionTelemetry?.diagnosticKeys).toEqual(["gpuWorkerPid"]);

    const userStatus = mergeOperationalStatusProjection({
      status: Object.freeze({
        runId: "run:diag",
        state: RunLifecycleStates.failed,
        updatedAt: "2026-04-07T10:01:20.000Z",
        assignmentStatus: RunAssignmentStatuses.released,
        executionOutcome: RunExecutionOutcomeKinds.failed,
        retry: Object.freeze({
          attempt: 1,
          maxAttempts: 2,
        }),
      }),
      run,
      audience: OperationalVisibilityAudiences.user,
      dispatchAttempts: Object.freeze([]),
      metadata: Object.freeze({}),
      timeline: Object.freeze([]),
    });
    expect(userStatus.failureSummary?.diagnostics).toBeUndefined();
  });
});

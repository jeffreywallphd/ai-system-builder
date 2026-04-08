import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationTransportContractVersions,
  RunOrchestrationTransportRoutes,
  resolveRunLifecycleState,
  resolveRunSubmissionSource,
  toRunDetail,
  toRunStatusEnvelope,
  toRunSummary,
} from "../RunOrchestrationTransportContracts";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";

describe("RunOrchestrationTransportContracts", () => {
  it("defines canonical route catalog", () => {
    expect(RunOrchestrationTransportContractVersions.v1).toBe("run-orchestration-transport/v1");
    expect(RunOrchestrationTransportRoutes.submitRun).toBe("/api/v1/runtime/runs/start");
    expect(RunOrchestrationTransportRoutes.listRuns).toBe("/api/v1/runtime/runs");
    expect(RunOrchestrationTransportRoutes.getExecutionReadiness).toBe("/api/v1/runtime/execution/readiness");
    expect(RunOrchestrationTransportRoutes.listQueueStatus).toBe("/api/v1/runtime/queue");
    expect(RunOrchestrationTransportRoutes.listSchedulingStaleReservations)
      .toBe("/api/v1/runtime/scheduling/admin/reservations/stale");
    expect(RunOrchestrationTransportRoutes.releaseSchedulingStaleReservation)
      .toBe("/api/v1/runtime/scheduling/admin/reservations/stale/release");
    expect(RunOrchestrationTransportRoutes.reevaluateSchedulingDeferredRuns)
      .toBe("/api/v1/runtime/scheduling/admin/deferred/re-evaluate");
    expect(RunOrchestrationTransportRoutes.retryRun).toBe("/api/v1/runtime/runs/:runId/retry");
    expect(RunOrchestrationTransportRoutes.updateLifecycle).toBe("/api/v1/runtime/runs/:runId/lifecycle");
  });

  it("projects canonical run records to summary detail and status envelopes", () => {
    const run = createCanonicalRunRecord({
      identity: {
        runId: "run-1",
        workflowId: "workflow-1",
        workspaceId: "workspace-1",
      },
      submission: {
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T10:00:00.000Z",
        submittedByActorId: "actor-1",
      },
      state: RunLifecycleStates.running,
      queue: {
        queueId: "queue-1",
        enteredAt: "2026-04-07T10:00:00.000Z",
        position: null,
        positionAsOf: "2026-04-07T10:00:02.000Z",
        dequeuedAt: "2026-04-07T10:00:05.000Z",
      },
      assignment: {
        status: RunAssignmentStatuses.assigned,
        assignedNodeId: "node-1",
        assignedAt: "2026-04-07T10:00:04.000Z",
      },
      execution: {
        outcome: RunExecutionOutcomeKinds.none,
        startedAt: "2026-04-07T10:00:06.000Z",
        heartbeatAt: "2026-04-07T10:00:09.000Z",
        progress: {
          updatedAt: "2026-04-07T10:00:09.000Z",
          percent: 47,
          stage: "sampler",
          message: "sampling step 19/40",
        },
      },
      retry: {
        attempt: 1,
        maxAttempts: 3,
      },
      updatedAt: "2026-04-07T10:01:00.000Z",
    });

    const summary = toRunSummary(run);
    expect(summary.runId).toBe("run-1");
    expect(summary.state).toBe(RunLifecycleStates.running);
    expect(summary.actionAvailability?.cancel.allowed).toBeTrue();
    expect(summary.scheduling).toBeUndefined();

    const detail = toRunDetail(run);
    expect(detail.assignment.assignedNodeId).toBe("node-1");
    expect(detail.execution.startedAt).toBe("2026-04-07T10:00:06.000Z");
    expect(detail.statusTimeline?.length).toBe(1);

    const status = toRunStatusEnvelope(run);
    expect(status.assignmentStatus).toBe(RunAssignmentStatuses.assigned);
    expect(status.queue?.queueId).toBe("queue-1");
    expect(status.execution?.heartbeatAt).toBe("2026-04-07T10:00:09.000Z");
    expect(status.execution?.progress?.percent).toBe(47);
    expect(status.finalization).toBeUndefined();
    expect(status.actionAvailability?.retry.allowed).toBeFalse();
  });

  it("normalizes optional submission source and lifecycle state", () => {
    expect(resolveRunSubmissionSource(undefined)).toBe(RunSubmissionSources.uiManual);
    expect(resolveRunSubmissionSource("api")).toBe(RunSubmissionSources.api);
    expect(resolveRunSubmissionSource("invalid")).toBe(RunSubmissionSources.uiManual);

    expect(resolveRunLifecycleState(undefined)).toBeUndefined();
    expect(resolveRunLifecycleState("queued")).toBe(RunLifecycleStates.queued);
    expect(resolveRunLifecycleState("unknown")).toBeUndefined();
  });
});

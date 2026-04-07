import { describe, expect, it } from "bun:test";
import {
  createCanonicalRunRecord,
  isRunLifecycleTransitionAllowed,
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleTransitionError,
  RunLifecycleStates,
  RunSubmissionSources,
  transitionCanonicalRunRecord,
} from "../RunDomain";

describe("RunDomain", () => {
  it("creates a canonical run and enforces queue and assignment invariants", () => {
    const run = createCanonicalRunRecord({
      identity: {
        runId: "run:story-16-001",
        workflowId: "workflow:image-generation",
        workspaceId: "workspace:alpha",
      },
      submission: {
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T11:00:00.000Z",
        submittedByActorId: "user:ops",
        clientRequestId: "req-1",
      },
    });

    expect(run.state).toBe(RunLifecycleStates.submitted);
    expect(run.assignment.status).toBe(RunAssignmentStatuses.unassigned);
    expect(run.execution.outcome).toBe(RunExecutionOutcomeKinds.none);

    expect(() => createCanonicalRunRecord({
      identity: run.identity,
      submission: run.submission,
      state: RunLifecycleStates.queued,
      assignment: { status: RunAssignmentStatuses.unassigned },
    })).toThrow("requires queue state");

    expect(() => createCanonicalRunRecord({
      identity: run.identity,
      submission: run.submission,
      state: RunLifecycleStates.assignmentPending,
      queue: {
        queueId: "queue:default",
        enteredAt: "2026-04-07T11:00:01.000Z",
        position: 4,
        positionAsOf: "2026-04-07T11:00:01.000Z",
      },
      assignment: { status: RunAssignmentStatuses.unassigned },
    })).toThrow("requires assignment status 'pending'");
  });

  it("supports end-to-end queue, assignment, run, and completion transitions", () => {
    const submitted = createCanonicalRunRecord({
      identity: {
        runId: "run:story-16-002",
        workflowId: "workflow:retouch",
      },
      submission: {
        source: RunSubmissionSources.uiManual,
        submittedAt: "2026-04-07T11:10:00.000Z",
      },
      retry: {
        maxAttempts: 3,
      },
    });

    const queued = transitionCanonicalRunRecord(submitted, {
      toState: RunLifecycleStates.queued,
      occurredAt: "2026-04-07T11:10:01.000Z",
      queue: {
        queueId: "queue:default",
        enteredAt: "2026-04-07T11:10:01.000Z",
        position: 2,
        positionAsOf: "2026-04-07T11:10:01.000Z",
      },
    });

    const assignmentPending = transitionCanonicalRunRecord(queued, {
      toState: RunLifecycleStates.assignmentPending,
      occurredAt: "2026-04-07T11:10:03.000Z",
      assignment: {
        status: RunAssignmentStatuses.pending,
        candidateNodeId: "node:gpu-01",
      },
    });

    const assigned = transitionCanonicalRunRecord(assignmentPending, {
      toState: RunLifecycleStates.assigned,
      occurredAt: "2026-04-07T11:10:04.000Z",
      queue: {
        ...assignmentPending.queue!,
        dequeuedAt: "2026-04-07T11:10:04.000Z",
      },
      assignment: {
        status: RunAssignmentStatuses.assigned,
        assignedNodeId: "node:gpu-01",
        assignedAt: "2026-04-07T11:10:04.000Z",
      },
    });

    const running = transitionCanonicalRunRecord(
      transitionCanonicalRunRecord(assigned, {
        toState: RunLifecycleStates.dispatching,
        occurredAt: "2026-04-07T11:10:05.000Z",
      }),
      {
        toState: RunLifecycleStates.running,
        occurredAt: "2026-04-07T11:10:06.000Z",
        execution: {
          adapterKind: "comfyui",
          adapterRunId: "adapter-run:55",
          startedAt: "2026-04-07T11:10:06.000Z",
          heartbeatAt: "2026-04-07T11:10:07.000Z",
          outcome: RunExecutionOutcomeKinds.none,
        },
      },
    );

    const completed = transitionCanonicalRunRecord(running, {
      toState: RunLifecycleStates.completed,
      occurredAt: "2026-04-07T11:10:20.000Z",
      execution: {
        ...running.execution,
        finishedAt: "2026-04-07T11:10:20.000Z",
        outcome: RunExecutionOutcomeKinds.succeeded,
      },
    });

    expect(completed.state).toBe(RunLifecycleStates.completed);
    expect(completed.execution.outcome).toBe(RunExecutionOutcomeKinds.succeeded);
    expect(completed.assignment.status).toBe(RunAssignmentStatuses.assigned);
    expect(completed.queue?.dequeuedAt).toBe("2026-04-07T11:10:04.000Z");
  });

  it("supports cancellation and retry pending states with retry budget constraints", () => {
    const running = createCanonicalRunRecord({
      identity: {
        runId: "run:story-16-003",
        workflowId: "workflow:cleanup",
      },
      submission: {
        source: RunSubmissionSources.internalOrchestrator,
        submittedAt: "2026-04-07T12:00:00.000Z",
      },
      state: RunLifecycleStates.running,
      queue: {
        queueId: "queue:default",
        enteredAt: "2026-04-07T11:59:59.000Z",
        position: null,
        positionAsOf: "2026-04-07T12:00:00.000Z",
        dequeuedAt: "2026-04-07T12:00:00.000Z",
      },
      assignment: {
        status: RunAssignmentStatuses.assigned,
        assignedNodeId: "node:gpu-02",
        assignedAt: "2026-04-07T12:00:00.000Z",
      },
      execution: {
        adapterKind: "comfyui",
        adapterRunId: "adapter-run:cancel-me",
        startedAt: "2026-04-07T12:00:00.000Z",
        outcome: RunExecutionOutcomeKinds.none,
      },
      retry: {
        attempt: 1,
        maxAttempts: 3,
      },
    });

    const cancelling = transitionCanonicalRunRecord(running, {
      toState: RunLifecycleStates.cancelling,
      occurredAt: "2026-04-07T12:00:03.000Z",
      cancellation: {
        requestedAt: "2026-04-07T12:00:03.000Z",
        requestedByActorId: "user:owner",
        reason: "user requested cancel",
      },
    });

    const cancelled = transitionCanonicalRunRecord(cancelling, {
      toState: RunLifecycleStates.cancelled,
      occurredAt: "2026-04-07T12:00:05.000Z",
      cancellation: {
        ...cancelling.cancellation!,
        acknowledgedAt: "2026-04-07T12:00:05.000Z",
      },
      execution: {
        ...cancelling.execution,
        finishedAt: "2026-04-07T12:00:05.000Z",
        outcome: RunExecutionOutcomeKinds.cancelled,
      },
    });

    const retryPending = transitionCanonicalRunRecord(cancelled, {
      toState: RunLifecycleStates.retryPending,
      occurredAt: "2026-04-07T12:00:07.000Z",
      cancellation: null,
      execution: {
        ...cancelled.execution,
        outcome: RunExecutionOutcomeKinds.none,
        errorCode: undefined,
        errorMessage: undefined,
      },
      retry: {
        attempt: 2,
        queuedAt: "2026-04-07T12:00:07.000Z",
      },
    });

    expect(retryPending.state).toBe(RunLifecycleStates.retryPending);
    expect(retryPending.retry.attempt).toBe(2);

    expect(() => transitionCanonicalRunRecord(retryPending, {
      toState: RunLifecycleStates.retryPending,
      occurredAt: "2026-04-07T12:00:09.000Z",
      retry: {
        attempt: 3,
      },
    })).toThrow("remaining retry budget");
  });

  it("rejects invalid lifecycle transitions", () => {
    const completed = createCanonicalRunRecord({
      identity: {
        runId: "run:story-16-004",
        workflowId: "workflow:done",
      },
      submission: {
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T12:10:00.000Z",
      },
      state: RunLifecycleStates.completed,
      execution: {
        startedAt: "2026-04-07T12:09:00.000Z",
        finishedAt: "2026-04-07T12:10:00.000Z",
        outcome: RunExecutionOutcomeKinds.succeeded,
      },
      retry: {
        maxAttempts: 1,
      },
    });

    expect(isRunLifecycleTransitionAllowed(completed.state, RunLifecycleStates.running)).toBe(false);
    expect(() => transitionCanonicalRunRecord(completed, {
      toState: RunLifecycleStates.running,
      occurredAt: "2026-04-07T12:10:01.000Z",
    })).toThrow(RunLifecycleTransitionError);
  });
});

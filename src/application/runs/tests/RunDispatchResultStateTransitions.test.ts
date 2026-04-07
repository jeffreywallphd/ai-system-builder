import { describe, expect, it } from "bun:test";
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  transitionDispatchingRunToOutcome,
  transitionRunToDispatching,
} from "../use-cases/RunDispatchResultStateTransitions";

function createAssignedRun() {
  return createCanonicalRunRecord({
    identity: {
      runId: "run-1",
      workflowId: "workflow:test",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
    },
    state: RunLifecycleStates.assigned,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T09:02:00.000Z",
      dequeuedAt: "2026-04-07T09:02:00.000Z",
    }),
    assignment: Object.freeze({
      status: "assigned",
      assignedNodeId: "node:trusted-a",
      assignedAt: "2026-04-07T09:02:00.000Z",
    }),
    execution: Object.freeze({
      outcome: RunExecutionOutcomeKinds.none,
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 2,
    }),
    updatedAt: "2026-04-07T09:02:00.000Z",
  });
}

const command = Object.freeze({
  commandId: "run-execution-command:dispatch-attempt:1",
  dispatchAttemptId: "dispatch-attempt:1",
  preparedAt: "2026-04-07T09:02:00.000Z",
  run: Object.freeze({
    runId: "run-1",
    workflowId: "workflow:test",
    workspaceId: "workspace-alpha",
    submittedAt: "2026-04-07T09:00:00.000Z",
    source: "api" as const,
  }),
  queue: Object.freeze({
    queueId: "queue:default",
  }),
  assignment: Object.freeze({
    nodeId: "node:trusted-a",
    reservationOwner: "orchestrator:alpha",
    claimToken: "claim:run-1",
  }),
  runtimeTarget: Object.freeze({
    systemId: "system:test",
    versionId: "runtime:v1",
    async: true,
  }),
  backend: Object.freeze({
    kind: RunExecutionBackendKinds.remoteDispatch,
  }),
  inputs: Object.freeze({
    tags: Object.freeze([]),
    parameters: Object.freeze({}),
  }),
  references: Object.freeze({
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
  }),
});

describe("RunDispatchResultStateTransitions", () => {
  it("transitions assigned runs to dispatching and then running after accepted dispatch", () => {
    const dispatching = transitionRunToDispatching({
      run: createAssignedRun(),
      occurredAt: "2026-04-07T09:03:00.000Z",
      command,
    });
    expect(dispatching.state).toBe("dispatching");
    expect(dispatching.execution.adapterKind).toBe("remote-dispatch");

    const running = transitionDispatchingRunToOutcome({
      run: dispatching,
      command,
      outcome: Object.freeze({
        status: "accepted" as const,
        receipt: Object.freeze({
          dispatchId: "dispatch:1",
          backendKind: RunExecutionBackendKinds.remoteDispatch,
          acceptedAt: "2026-04-07T09:03:10.000Z",
          status: "accepted" as const,
          backendRunId: "backend-run-1",
        }),
      }),
    });

    expect(running.state).toBe("running");
    expect(running.execution.startedAt).toBe("2026-04-07T09:03:10.000Z");
    expect(running.execution.adapterRunId).toBe("backend-run-1");
    expect(running.execution.outcome).toBe("none");
  });

  it("transitions dispatching runs to failed when dispatch fails to start", () => {
    const dispatching = transitionRunToDispatching({
      run: createAssignedRun(),
      occurredAt: "2026-04-07T09:03:00.000Z",
      command,
    });

    const failed = transitionDispatchingRunToOutcome({
      run: dispatching,
      command,
      outcome: Object.freeze({
        status: "failed-to-start" as const,
        failedAt: "2026-04-07T09:03:20.000Z",
        failure: Object.freeze({
          safeCode: "dispatch-failed-to-start",
          safeMessage: "Run failed to start on the selected execution backend.",
        }),
      }),
    });

    expect(failed.state).toBe("failed");
    expect(failed.execution.outcome).toBe("failed");
    expect(failed.execution.errorCode).toBe("dispatch-failed-to-start");
    expect(failed.execution.errorMessage).toBe("Run failed to start on the selected execution backend.");
  });
});

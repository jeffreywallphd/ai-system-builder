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
import {
  ReleaseStaleSchedulingReservationUseCase,
  type ReleaseStaleSchedulingReservationResult,
} from "@application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase";
import {
  ReevaluateDeferredSchedulingRunsUseCase,
  type ReevaluateDeferredSchedulingRunsResult,
} from "@application/runs/use-cases/ReevaluateDeferredSchedulingRunsUseCase";
import {
  parseSchedulingAdminReevaluateDeferredRunsResponse,
  parseSchedulingAdminReleaseStaleReservationResponse,
} from "@shared/schemas/runtime/RunOrchestrationTransportSchemaContracts";
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

class StubReleaseStaleSchedulingReservationUseCase {
  public nextError: unknown;

  public async execute(): Promise<ReleaseStaleSchedulingReservationResult> {
    if (this.nextError) {
      throw this.nextError;
    }
    return Object.freeze({
      runId: "run:stale:1",
      queueId: "queue:default",
      releasedAt: "2026-04-07T12:12:00.000Z",
      staleSeconds: 120,
      reservationOwner: "scheduler:alpha",
      mutationId: "run:scheduling-admin-release-stale-reservation:1",
    });
  }
}

class StubReevaluateDeferredSchedulingRunsUseCase {
  public nextError: unknown;

  public async execute(): Promise<ReevaluateDeferredSchedulingRunsResult> {
    if (this.nextError) {
      throw this.nextError;
    }
    return Object.freeze({
      requestedAt: "2026-04-07T12:13:00.000Z",
      reEvaluatedCount: 2,
      runIds: Object.freeze(["run:deferred:1", "run:deferred:2"]),
      mutationId: "run:scheduling-admin-reevaluate-deferred:1",
    });
  }
}

function buildApi(dependencies?: {
  readonly realtimePublisher?: RunOrchestrationRealtimePublisher;
  readonly authorizationDecisionEvaluator?: {
    evaluateDecision: (input: { readonly requiredPermissionKey: string }) => Promise<{
      readonly decision: {
        readonly outcome: "allow" | "deny";
        readonly reasonCode: string;
        readonly reason: string;
        readonly requiredPermissionKey: string;
        readonly evaluatedAt: string;
        readonly isAllowed: boolean;
        readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
        readonly matchedPermissionGrantIds: ReadonlyArray<string>;
        readonly matchedSharingGrantIds: ReadonlyArray<string>;
      };
    }>;
  };
}) {
  const cancellation = new StubRequestAuthoritativeRunCancellationUseCase();
  const retry = new StubRequestAuthoritativeRunRetryUseCase();
  const release = new StubReleaseStaleSchedulingReservationUseCase();
  const reevaluate = new StubReevaluateDeferredSchedulingRunsUseCase();
  const api = new AuthoritativeRunMutationBackendApi({
    requestAuthoritativeRunCancellationUseCase: cancellation as unknown as RequestAuthoritativeRunCancellationUseCase,
    requestAuthoritativeRunRetryUseCase: retry as unknown as RequestAuthoritativeRunRetryUseCase,
    releaseStaleSchedulingReservationUseCase: release as unknown as ReleaseStaleSchedulingReservationUseCase,
    reevaluateDeferredSchedulingRunsUseCase: reevaluate as unknown as ReevaluateDeferredSchedulingRunsUseCase,
    realtimePublisher: dependencies?.realtimePublisher,
    authorizationDecisionEvaluator: dependencies?.authorizationDecisionEvaluator as never,
  });
  return { api, cancellation, retry, release, reevaluate };
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
    const { api } = buildApi({ realtimePublisher });

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
    const { api, cancellation } = buildApi();

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
    const { api } = buildApi({ realtimePublisher });

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
    const { api, retry } = buildApi();

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

  it("supports scheduling admin stale reservation release and deferred re-evaluation", async () => {
    const { api } = buildApi();

    const released = await api.releaseStaleSchedulingReservation({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      release: {
        runId: "run:stale:1",
        claimToken: "queue-claim:1",
      },
    });
    expect(released.ok).toBeTrue();
    expect(released.data?.mutation.changed).toBeTrue();
    expect(released.data?.runId).toBe("run:stale:1");
    const parsedRelease = parseSchedulingAdminReleaseStaleReservationResponse(released.data);
    expect(parsedRelease.staleSeconds).toBe(120);
    expect(parsedRelease.mutation.changed).toBeTrue();

    const reevaluated = await api.reevaluateDeferredSchedulingRuns({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      reevaluate: {
        queueId: "queue:default",
        limit: 20,
      },
    });
    expect(reevaluated.ok).toBeTrue();
    expect(reevaluated.data?.reEvaluatedCount).toBe(2);
    expect(reevaluated.data?.mutation.changed).toBeTrue();
    const parsedReevaluate = parseSchedulingAdminReevaluateDeferredRunsResponse(reevaluated.data);
    expect(parsedReevaluate.reEvaluatedCount).toBe(2);
    expect(parsedReevaluate.runIds).toEqual(["run:deferred:1", "run:deferred:2"]);
  });

  it("publishes scheduling-requeued realtime events for deferred-run re-evaluation results", async () => {
    const realtimeEvents: Array<{ type: "run" | "queue"; payload: unknown }> = [];
    const realtimePublisher: RunOrchestrationRealtimePublisher = Object.freeze({
      publishRunStatus: (input) => {
        realtimeEvents.push({ type: "run", payload: input.payload });
      },
      publishQueueMovement: (input) => {
        realtimeEvents.push({ type: "queue", payload: input.payload });
      },
    });
    const { api } = buildApi({ realtimePublisher });

    const response = await api.reevaluateDeferredSchedulingRuns({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      reevaluate: {
        queueId: "queue:default",
      },
    });

    expect(response.ok).toBeTrue();
    expect(realtimeEvents).toHaveLength(4);
    const queueKinds = realtimeEvents
      .filter((event) => event.type === "queue")
      .map((event) => (event.payload as { eventKind?: string }).eventKind);
    const runKinds = realtimeEvents
      .filter((event) => event.type === "run")
      .map((event) => (event.payload as { eventKind?: string }).eventKind);
    expect(queueKinds).toEqual(["scheduling-requeued", "scheduling-requeued"]);
    expect(runKinds).toEqual(["scheduling-requeued", "scheduling-requeued"]);
  });

  it("denies scheduling admin actions when run.manage permission is denied", async () => {
    const denyManageEvaluator = Object.freeze({
      evaluateDecision: async (input: { readonly requiredPermissionKey: string }) => Object.freeze({
        decision: Object.freeze({
          outcome: input.requiredPermissionKey === "run.manage" ? "deny" : "allow",
          reasonCode: "test",
          reason: "test",
          requiredPermissionKey: input.requiredPermissionKey,
          evaluatedAt: "2026-04-07T12:00:00.000Z",
          isAllowed: input.requiredPermissionKey !== "run.manage",
          matchedRoleAssignmentIds: Object.freeze([]),
          matchedPermissionGrantIds: Object.freeze([]),
          matchedSharingGrantIds: Object.freeze([]),
        }),
      }),
    });
    const { api } = buildApi({ authorizationDecisionEvaluator: denyManageEvaluator });

    const releaseDenied = await api.releaseStaleSchedulingReservation({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      release: {
        runId: "run:stale:1",
        claimToken: "queue-claim:1",
      },
    });
    expect(releaseDenied.ok).toBeFalse();
    expect(releaseDenied.error?.code).toBe(SharedApiErrorCodes.forbidden);

    const reevaluateDenied = await api.reevaluateDeferredSchedulingRuns({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      },
      reevaluate: {},
    });
    expect(reevaluateDenied.ok).toBeFalse();
    expect(reevaluateDenied.error?.code).toBe(SharedApiErrorCodes.forbidden);
  });
});

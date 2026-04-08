import { describe, expect, it } from "bun:test";
import type { AuthoritativeAuditRecordEventInput } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type {
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunDispatchAttemptResult,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  IRunExecutionCancellationSignalPort,
  RunExecutionCancellationSignalRequest,
  RunExecutionCancellationSignalResult,
} from "@application/runs/ports/RunExecutionCancellationPorts";
import type { IAuthoritativeRunMutationAuthorizationPort } from "@application/runs/ports/RunMutationAuthorizationPorts";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  type CanonicalRunRecord,
  type RunLifecycleState,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  mapLifecycleStateToPlatformRunStatus,
  type RunAuthoritativeMetadata,
} from "../use-cases/RunCreationPersistenceMapper";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationUnauthorizedError,
  RunCancellationOutcomes,
} from "../use-cases/RequestAuthoritativeRunCancellationUseCase";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(_query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze([...this.runs.values()]);
  }

  public async createRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: Math.max(1, record.revision),
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({ changed: true, wasReplay: false, record: persisted });
  }

  public async saveRun(
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    const existing = this.runs.get(record.runId);
    if (!existing) {
      throw new Error(`Run '${record.runId}' not found.`);
    }
    if (typeof mutation.expectedRevision === "number" && mutation.expectedRevision !== existing.revision) {
      throw new Error("expectedRevision mismatch");
    }
    const persisted = Object.freeze({
      ...record,
      revision: existing.revision + 1,
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({ changed: true, wasReplay: false, record: persisted });
  }
}

class InMemoryQueueRepository implements IRunOrchestrationQueuePersistenceRepository {
  public readonly entries = new Map<string, AuthoritativeRunQueueEntryRecord>();

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.get(runId);
  }

  public async enqueueRunForAssignment(
    record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    const persisted = Object.freeze({ ...record, revision: 1 });
    this.entries.set(record.runId, persisted);
    return Object.freeze({ changed: true, record: persisted });
  }

  public async listAssignmentReadyRuns(_query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async claimAssignmentReadyRuns(_input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const existing = this.entries.get(input.runId);
    if (!existing || existing.claimToken !== input.claimToken) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...existing,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: existing.revision + 1,
    }));
    return true;
  }

  public async claimQueuedRunForNodeDispatch(_input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    throw new Error("Not implemented.");
  }

  public async recordDispatchAttemptResult(_input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    return false;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const existing = this.entries.get(input.runId);
    if (!existing) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...existing,
      lifecycleState: input.lifecycleState,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.finalizedAt,
      revision: existing.revision + 1,
    }));
    return true;
  }

  public async listDispatchAttemptsByRunId(_runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze([]);
  }
}

class InMemoryIntentRepository implements IRunOrchestrationIntentRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({ changed: true, wasReplay: false, record: event });
  }
}

class StubCancellationSignalPort implements IRunExecutionCancellationSignalPort {
  public nextResult: RunExecutionCancellationSignalResult = Object.freeze({
    status: "accepted",
    acknowledgedAt: "2026-04-07T12:10:00.000Z",
  });

  public readonly requests: RunExecutionCancellationSignalRequest[] = [];

  public async signalCancellation(
    request: RunExecutionCancellationSignalRequest,
  ): Promise<RunExecutionCancellationSignalResult> {
    this.requests.push(request);
    return this.nextResult;
  }
}

class InMemoryRunCancellationAuthorization implements IAuthoritativeRunMutationAuthorizationPort {
  public readonly deniedRunIds = new Set<string>();
  public readonly calls: Array<{
    readonly runId: string;
    readonly workspaceId?: string;
    readonly actorUserIdentityId: string;
  }> = [];

  public async canCancelRun(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly actor: {
      readonly actorUserIdentityId: string;
      readonly activeWorkspaceId?: string;
      readonly authenticatedAt?: string;
    };
  }): Promise<boolean> {
    this.calls.push({
      runId: input.runId,
      workspaceId: input.workspaceId,
      actorUserIdentityId: input.actor.actorUserIdentityId,
    });
    return !this.deniedRunIds.has(input.runId);
  }
}

class CapturingAuthoritativeRunAuditRecorder {
  public readonly events: AuthoritativeAuditRecordEventInput[] = [];

  public async recordRunsEvent(input: AuthoritativeAuditRecordEventInput): Promise<any> {
    this.events.push(input);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event: input,
    });
  }
}

function seedRun(params: {
  readonly runRepository: InMemoryRunRepository;
  readonly queueRepository: InMemoryQueueRepository;
  readonly runId: string;
  readonly state: RunLifecycleState;
  readonly withAssignment?: boolean;
  readonly withQueue?: boolean;
  readonly withClaim?: boolean;
}): CanonicalRunRecord {
  const submittedAt = "2026-04-07T12:00:00.000Z";
  const assigned = params.withAssignment !== false;
  const queueEnabled = params.withQueue !== false;

  const queue = queueEnabled
    ? {
      queueId: "queue:default",
      enteredAt: "2026-04-07T12:00:00.000Z",
      position: params.state === RunLifecycleStates.queued || params.state === RunLifecycleStates.assignmentPending ? 1 : null,
      positionAsOf: "2026-04-07T12:00:00.000Z",
      dequeuedAt: params.state === RunLifecycleStates.queued || params.state === RunLifecycleStates.assignmentPending
        ? undefined
        : "2026-04-07T12:01:00.000Z",
    }
    : undefined;

  const assignment = params.state === RunLifecycleStates.assignmentPending
    ? {
      status: RunAssignmentStatuses.pending,
      candidateNodeId: "node:trusted-1",
    }
    : assigned && (params.state === RunLifecycleStates.assigned
      || params.state === RunLifecycleStates.dispatching
      || params.state === RunLifecycleStates.running)
      ? {
        status: RunAssignmentStatuses.assigned,
        assignedNodeId: "node:trusted-1",
        assignedAt: "2026-04-07T12:01:00.000Z",
      }
      : {
        status: RunAssignmentStatuses.unassigned,
      };

  const execution = params.state === RunLifecycleStates.running || params.state === RunLifecycleStates.dispatching
    ? {
      adapterKind: "local-worker",
      adapterRunId: "backend-run-1",
      startedAt: "2026-04-07T12:02:00.000Z",
      outcome: RunExecutionOutcomeKinds.none,
    }
    : {
      outcome: params.state === RunLifecycleStates.completed
        ? RunExecutionOutcomeKinds.succeeded
        : params.state === RunLifecycleStates.failed
          ? RunExecutionOutcomeKinds.failed
          : params.state === RunLifecycleStates.cancelled
            ? RunExecutionOutcomeKinds.cancelled
            : RunExecutionOutcomeKinds.none,
      startedAt: params.state === RunLifecycleStates.completed
        || params.state === RunLifecycleStates.failed
        || params.state === RunLifecycleStates.cancelled
        ? "2026-04-07T12:02:00.000Z"
        : undefined,
      finishedAt: params.state === RunLifecycleStates.completed
        || params.state === RunLifecycleStates.failed
        || params.state === RunLifecycleStates.cancelled
        ? "2026-04-07T12:03:00.000Z"
        : undefined,
      errorMessage: params.state === RunLifecycleStates.failed ? "failed" : undefined,
      errorCode: params.state === RunLifecycleStates.failed ? "failed" : undefined,
    };

  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: params.runId,
      workflowId: "workflow:demo",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt,
      submittedByActorId: "user:owner",
    },
    state: params.state,
    queue,
    assignment,
    execution,
    cancellation: params.state === RunLifecycleStates.cancelling || params.state === RunLifecycleStates.cancelled
      ? {
        requestedAt: "2026-04-07T12:04:00.000Z",
        requestedByActorId: "user:owner",
        acknowledgedAt: params.state === RunLifecycleStates.cancelled ? "2026-04-07T12:04:05.000Z" : undefined,
      }
      : undefined,
    retry: {
      attempt: 1,
      maxAttempts: 3,
    },
    updatedAt: "2026-04-07T12:04:00.000Z",
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace-alpha",
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:demo",
        versionId: "version:demo",
        async: true,
      }),
      tags: Object.freeze([]),
      parameters: Object.freeze({}),
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze([]),
    }),
    visibility: Object.freeze({
      workspaceScope: "workspace",
      sharingPosture: "workspace-members",
    }),
    orchestration: Object.freeze({
      initialLifecycleState: RunLifecycleStates.queued,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: submittedAt,
      }),
    }),
  });

  params.runRepository.runs.set(params.runId, Object.freeze({
    runId: params.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(canonicalRun.state),
    workspaceId: "workspace-alpha",
    userIdentityId: "user:owner",
    sourceAggregateRef: "workflow:demo",
    initiatedAt: submittedAt,
    metadata,
    revision: 1,
  }));

  if (queueEnabled && canonicalRun.queue) {
    params.queueRepository.entries.set(params.runId, Object.freeze({
      runId: params.runId,
      queueId: canonicalRun.queue.queueId,
      workspaceId: "workspace-alpha",
      lifecycleState: canonicalRun.state,
      enteredAt: canonicalRun.queue.enteredAt,
      orderKey: `${canonicalRun.queue.enteredAt}:${params.runId}`,
      eligibilityMarker: "ready",
      eligibleAt: canonicalRun.queue.enteredAt,
      claimToken: params.withClaim ? "claim:token-1" : undefined,
      claimedBy: params.withClaim ? "orchestrator:test" : undefined,
      claimedAt: params.withClaim ? "2026-04-07T12:05:00.000Z" : undefined,
      claimExpiresAt: params.withClaim ? "2026-04-07T12:10:00.000Z" : undefined,
      assignmentNodeId: canonicalRun.assignment.assignedNodeId,
      assignmentClaimedAt: canonicalRun.assignment.assignedAt,
      dispatchPreparedAt: canonicalRun.state === RunLifecycleStates.dispatching || canonicalRun.state === RunLifecycleStates.running
        ? "2026-04-07T12:02:00.000Z"
        : undefined,
      dequeuedAt: canonicalRun.queue.dequeuedAt,
      updatedAt: canonicalRun.updatedAt,
      revision: 1,
    }));
  }

  return canonicalRun;
}

describe("RequestAuthoritativeRunCancellationUseCase", () => {
  it("applies cancellation state-matrix transitions across lifecycle positions", async () => {
    const matrix = [
      {
        state: RunLifecycleStates.submitted,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.cancelled,
      },
      {
        state: RunLifecycleStates.queued,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.cancelled,
      },
      {
        state: RunLifecycleStates.assignmentPending,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.cancelled,
      },
      {
        state: RunLifecycleStates.assigned,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.cancelled,
      },
      {
        state: RunLifecycleStates.dispatching,
        expectedState: RunLifecycleStates.cancelling,
        expectedOutcome: RunCancellationOutcomes.cancellationRequested,
      },
      {
        state: RunLifecycleStates.running,
        expectedState: RunLifecycleStates.cancelling,
        expectedOutcome: RunCancellationOutcomes.cancellationRequested,
      },
      {
        state: RunLifecycleStates.retryPending,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.cancelled,
      },
      {
        state: RunLifecycleStates.cancelling,
        expectedState: RunLifecycleStates.cancelling,
        expectedOutcome: RunCancellationOutcomes.alreadyCancelling,
      },
      {
        state: RunLifecycleStates.completed,
        expectedState: RunLifecycleStates.completed,
        expectedOutcome: RunCancellationOutcomes.alreadyFinalized,
      },
      {
        state: RunLifecycleStates.failed,
        expectedState: RunLifecycleStates.failed,
        expectedOutcome: RunCancellationOutcomes.alreadyFinalized,
      },
      {
        state: RunLifecycleStates.cancelled,
        expectedState: RunLifecycleStates.cancelled,
        expectedOutcome: RunCancellationOutcomes.alreadyFinalized,
      },
    ] as const;

    for (const entry of matrix) {
      const runRepository = new InMemoryRunRepository();
      const queueRepository = new InMemoryQueueRepository();
      const intentRepository = new InMemoryIntentRepository();
      const signalPort = new StubCancellationSignalPort();
      const runId = `run:${entry.state}`;
      seedRun({
        runRepository,
        queueRepository,
        runId,
        state: entry.state,
        withClaim: true,
      });

      const useCase = new RequestAuthoritativeRunCancellationUseCase({
        runRepository,
        queueRepository,
        orchestrationIntentRepository: intentRepository,
        cancellationSignalPort: signalPort,
        now: () => new Date("2026-04-07T12:10:00.000Z"),
        idGenerator: {
          nextId: (prefix) => `${prefix}:${runId}`,
        },
      });

      const result = await useCase.execute({
        workspaceId: "workspace-alpha",
        actorUserIdentityId: "user:ops",
        request: Object.freeze({
          runId,
          reason: `cancel ${entry.state}`,
          requestedAt: "2026-04-07T12:10:00.000Z",
          idempotencyKey: `cancel:${entry.state}`,
        }),
      });

      expect(result.outcome).toBe(entry.expectedOutcome);
      expect(result.mutation.run.state).toBe(entry.expectedState);
      if (entry.expectedState === RunLifecycleStates.cancelled) {
        expect(result.mutation.run.execution.outcome).toBe(RunExecutionOutcomeKinds.cancelled);
        expect(result.mutation.run.cancellation?.acknowledgedAt).toBeDefined();
        expect(result.mutation.run.finalization?.outcome).toBe("cancelled");
        expect(result.status.finalization?.outputAvailability).toBe("none");
      }
      if (entry.state === RunLifecycleStates.running || entry.state === RunLifecycleStates.dispatching) {
        expect(result.signalResult?.status).toBe("accepted");
        expect(signalPort.requests).toHaveLength(1);
      }
      if (
        entry.expectedOutcome === RunCancellationOutcomes.alreadyFinalized
        || entry.expectedOutcome === RunCancellationOutcomes.alreadyCancelling
      ) {
        expect(result.mutation.mutation.changed).toBeFalse();
      }
    }
  });

  it("records explicit not-supported signal outcomes when backend cancellation signaling is unavailable", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();

    seedRun({
      runRepository,
      queueRepository,
      runId: "run:running-no-signal",
      state: RunLifecycleStates.running,
      withClaim: true,
    });

    const useCase = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      now: () => new Date("2026-04-07T12:10:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:running-no-signal",
        requestedAt: "2026-04-07T12:10:00.000Z",
      }),
    });

    expect(result.outcome).toBe(RunCancellationOutcomes.cancellationRequested);
    expect(result.mutation.run.state).toBe(RunLifecycleStates.cancelling);
    expect(result.signalResult?.status).toBe("not-supported");
    expect(intentRepository.events).toHaveLength(1);
    expect(intentRepository.events[0]?.details?.signal).toBeDefined();
  });

  it("keeps cancellation explicit and non-terminal when backend cancellation signaling degrades", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const signalPort = new StubCancellationSignalPort();
    signalPort.nextResult = Object.freeze({
      status: "failed",
      safeCode: "transport-timeout",
      safeMessage: "Cancellation request timed out at backend boundary.",
    });

    seedRun({
      runRepository,
      queueRepository,
      runId: "run:running-signal-degraded",
      state: RunLifecycleStates.running,
      withClaim: true,
    });

    const useCase = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      cancellationSignalPort: signalPort,
      now: () => new Date("2026-04-07T12:10:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:running-signal-degraded",
        requestedAt: "2026-04-07T12:10:00.000Z",
      }),
    });

    expect(result.outcome).toBe(RunCancellationOutcomes.cancellationRequested);
    expect(result.mutation.run.state).toBe(RunLifecycleStates.cancelling);
    expect(result.signalResult?.status).toBe("failed");
    expect(result.status.state).toBe(RunLifecycleStates.cancelling);
  });

  it("denies cancellation when run-level authorization rejects the actor", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const authorization = new InMemoryRunCancellationAuthorization();

    seedRun({
      runRepository,
      queueRepository,
      runId: "run:denied",
      state: RunLifecycleStates.queued,
      withClaim: true,
    });
    authorization.deniedRunIds.add("run:denied");

    const useCase = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      authorization,
      now: () => new Date("2026-04-07T12:10:00.000Z"),
    });

    await expect(useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      authorization: Object.freeze({
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      }),
      request: Object.freeze({
        runId: "run:denied",
        requestedAt: "2026-04-07T12:10:00.000Z",
      }),
    })).rejects.toBeInstanceOf(RunCancellationUnauthorizedError);

    expect(authorization.calls).toHaveLength(1);
    expect(intentRepository.events).toHaveLength(1);
    expect(intentRepository.events[0]?.outcome).toBe("rejected");
    expect(intentRepository.events[0]?.details?.outcome).toBe("denied");
  });

  it("allows cancellation when run-level authorization allows the actor", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const authorization = new InMemoryRunCancellationAuthorization();

    seedRun({
      runRepository,
      queueRepository,
      runId: "run:allowed",
      state: RunLifecycleStates.queued,
      withClaim: true,
    });

    const useCase = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      authorization,
      now: () => new Date("2026-04-07T12:10:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      authorization: Object.freeze({
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      }),
      request: Object.freeze({
        runId: "run:allowed",
        requestedAt: "2026-04-07T12:10:00.000Z",
      }),
    });

    expect(authorization.calls).toHaveLength(1);
    expect(result.outcome).toBe(RunCancellationOutcomes.cancelled);
    expect(result.mutation.run.state).toBe(RunLifecycleStates.cancelled);
  });

  it("emits authoritative run cancellation events through centralized recorder when configured", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const authoritativeAuditRecorder = new CapturingAuthoritativeRunAuditRecorder();

    seedRun({
      runRepository,
      queueRepository,
      runId: "run:cancel-authoritative",
      state: RunLifecycleStates.queued,
      withClaim: true,
    });

    const useCase = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      authoritativeAuditRecorder,
      now: () => new Date("2026-04-07T12:10:00.000Z"),
    });

    await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:cancel-authoritative",
        requestedAt: "2026-04-07T12:10:00.000Z",
      }),
    });

    expect(authoritativeAuditRecorder.events).toHaveLength(1);
    expect(authoritativeAuditRecorder.events[0]?.action).toBe("run.cancellation.requested");
    expect(authoritativeAuditRecorder.events[0]?.scope.kind).toBe("workspace");
    expect(authoritativeAuditRecorder.events[0]?.protectedResource?.resourceRef).toBe("run:cancel-authoritative");
  });
});

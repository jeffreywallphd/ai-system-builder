import { describe, expect, it } from "bun:test";
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
  AuthoritativeRunNodePlacementHoldRecord,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
  RunQueueEligibilityMarker,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  type RunLifecycleState,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  mapLifecycleStateToPlatformRunStatus,
  type RunAuthoritativeMetadata,
} from "../use-cases/RunCreationPersistenceMapper";
import {
  RecoverRunOrchestrationStartupStateUseCase,
  RunOrchestrationRecoveryActionKinds,
} from "../use-cases/RecoverRunOrchestrationStartupStateUseCase";

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
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
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
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }
}

class InMemoryQueueRepository implements IRunOrchestrationQueuePersistenceRepository {
  public readonly entries = new Map<string, AuthoritativeRunQueueEntryRecord>();
  public readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();
  public readonly placementHolds = new Map<string, AuthoritativeRunNodePlacementHoldRecord>();
  public allowRecoveryRequeue = true;
  public readonly releaseClaimFailures = new Set<string>();

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.get(runId);
  }

  public async listQueueEntries(_query: {
    readonly workspaceId?: string;
    readonly queueId?: string;
    readonly lifecycleStates?: ReadonlyArray<RunLifecycleState>;
    readonly includeDequeued?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([...this.entries.values()]);
  }

  public async enqueueRunForAssignment(
    record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: 1,
    });
    this.entries.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      record: persisted,
    });
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
    if (this.releaseClaimFailures.has(input.runId)) {
      return false;
    }
    const entry = this.entries.get(input.runId);
    if (!entry || entry.claimToken !== input.claimToken) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...entry,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: entry.revision + 1,
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
    throw new Error("not implemented");
  }

  public async requeueAssignedRunForRecovery(input: {
    readonly runId: string;
    readonly requeuedAt: string;
    readonly eligibilityMarker?: RunQueueEligibilityMarker;
  }): Promise<boolean> {
    if (!this.allowRecoveryRequeue) {
      return false;
    }
    const entry = this.entries.get(input.runId);
    if (!entry || entry.lifecycleState !== "assigned") {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...entry,
      lifecycleState: "queued",
      eligibilityMarker: input.eligibilityMarker ?? "ready",
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      assignmentNodeId: undefined,
      assignmentClaimedAt: undefined,
      dispatchPreparedAt: undefined,
      lastDispatchAttemptId: undefined,
      dequeuedAt: undefined,
      updatedAt: input.requeuedAt,
      revision: entry.revision + 1,
    }));
    return true;
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
    const entry = this.entries.get(input.runId);
    if (!entry) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...entry,
      lifecycleState: input.lifecycleState,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.finalizedAt,
      revision: entry.revision + 1,
    }));
    return true;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.attempts.values()]
        .filter((entry) => entry.runId === runId)
        .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt) || left.attemptId.localeCompare(right.attemptId)),
    );
  }

  public async releaseExpiredNodePlacementHolds(input: {
    readonly asOf: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunNodePlacementHoldRecord>> {
    const limit = Math.max(1, input.limit ?? Number.MAX_SAFE_INTEGER);
    const expired = [...this.placementHolds.values()]
      .filter((record) => record.expiresAt <= input.asOf)
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt) || left.nodeId.localeCompare(right.nodeId))
      .slice(0, limit);
    for (const record of expired) {
      this.placementHolds.delete(record.nodeId);
    }
    return Object.freeze(expired);
  }
}

class InMemoryIntentRepository implements IRunOrchestrationIntentRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }
}

function seedRun(input: {
  readonly runRepository: InMemoryRunRepository;
  readonly queueRepository: InMemoryQueueRepository;
  readonly runId: string;
  readonly state: RunLifecycleState;
  readonly queueLifecycleState?: RunLifecycleState;
  readonly assignedNodeId?: string;
  readonly assignedAt?: string;
  readonly heartbeatAt?: string;
}): void {
  const submittedAt = "2026-04-07T10:00:00.000Z";
  const assignedNodeId = input.assignedNodeId ?? "node:trusted-a";
  const assignedAt = input.assignedAt ?? "2026-04-07T10:05:00.000Z";
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: input.runId,
      workflowId: "workflow:recovery",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt,
      submittedByActorId: "user:owner",
    },
    state: input.state,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: submittedAt,
      position: input.state === RunLifecycleStates.queued ? 1 : null,
      positionAsOf: assignedAt,
      dequeuedAt: input.state === RunLifecycleStates.queued ? undefined : assignedAt,
    }),
    assignment: input.state === RunLifecycleStates.assigned
      || input.state === RunLifecycleStates.dispatching
      || input.state === RunLifecycleStates.running
      ? Object.freeze({
        status: "assigned" as const,
        assignedNodeId,
        assignedAt,
      })
      : Object.freeze({
        status: "unassigned" as const,
      }),
    execution: Object.freeze({
      adapterKind: input.state === RunLifecycleStates.running || input.state === RunLifecycleStates.dispatching
        ? "remote-dispatch"
        : undefined,
      adapterRunId: input.state === RunLifecycleStates.running || input.state === RunLifecycleStates.dispatching
        ? "backend-run-1"
        : undefined,
      startedAt: input.state === RunLifecycleStates.running
        ? "2026-04-07T10:06:00.000Z"
        : undefined,
      heartbeatAt: input.heartbeatAt,
      outcome: RunExecutionOutcomeKinds.none,
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 3,
    }),
    updatedAt: assignedAt,
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
        versionId: "runtime:v1",
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
      initialLifecycleState: "queued",
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: submittedAt,
      }),
    }),
  });

  input.runRepository.runs.set(input.runId, Object.freeze({
    runId: input.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(canonicalRun.state),
    workspaceId: "workspace-alpha",
    userIdentityId: "user:owner",
    sourceAggregateRef: "workflow:recovery",
    initiatedAt: submittedAt,
    metadata,
    revision: 1,
  }));

  input.queueRepository.entries.set(input.runId, Object.freeze({
    runId: input.runId,
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    lifecycleState: input.queueLifecycleState ?? input.state,
    enteredAt: submittedAt,
    orderKey: `${submittedAt}:${input.runId}`,
    eligibilityMarker: "ready",
    eligibleAt: submittedAt,
    claimToken: input.state === RunLifecycleStates.queued ? "claim:queued" : "claim:assigned",
    claimedBy: "orchestrator:startup",
    claimedAt: assignedAt,
    claimExpiresAt: "2026-04-07T10:07:00.000Z",
    assignmentNodeId: input.state === RunLifecycleStates.assigned
      || input.state === RunLifecycleStates.dispatching
      || input.state === RunLifecycleStates.running
      ? assignedNodeId
      : undefined,
    assignmentClaimedAt: input.state === RunLifecycleStates.assigned
      || input.state === RunLifecycleStates.dispatching
      || input.state === RunLifecycleStates.running
      ? assignedAt
      : undefined,
    dispatchPreparedAt: input.state === RunLifecycleStates.dispatching || input.state === RunLifecycleStates.running
      ? assignedAt
      : undefined,
    lastDispatchAttemptId: input.state === RunLifecycleStates.dispatching ? "dispatch-attempt:1" : undefined,
    dequeuedAt: input.state === RunLifecycleStates.queued ? undefined : assignedAt,
    updatedAt: assignedAt,
    revision: 1,
  }));
}

describe("RecoverRunOrchestrationStartupStateUseCase", () => {
  it("releases expired queue claims and requeues stale assigned runs", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:assigned-stale",
      state: RunLifecycleStates.assigned,
    });
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:queued-expired",
      state: RunLifecycleStates.queued,
    });

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
      staleAssignedSeconds: 120,
    });

    expect(result.summary.appliedCount).toBeGreaterThanOrEqual(2);
    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.expiredClaimReleased)).toBe(true);
    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.staleAssignmentRequeued)).toBe(true);

    const recoveredRun = runRepository.runs.get("run:assigned-stale");
    expect(recoveredRun).toBeDefined();
    const recoveredCanonical = (recoveredRun?.metadata as RunAuthoritativeMetadata).canonicalRun;
    expect(recoveredCanonical.state).toBe("queued");
    expect(recoveredCanonical.assignment.status).toBe("unassigned");
    expect(queueRepository.entries.get("run:assigned-stale")?.dequeuedAt).toBeUndefined();
    expect(queueRepository.entries.get("run:queued-expired")?.claimToken).toBeUndefined();
  });

  it("reconciles interrupted dispatch progression from persisted dispatch result", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:dispatching",
      state: RunLifecycleStates.dispatching,
      queueLifecycleState: RunLifecycleStates.assigned,
    });
    queueRepository.attempts.set("dispatch-attempt:1", Object.freeze({
      attemptId: "dispatch-attempt:1",
      runId: "run:dispatching",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      nodeId: "node:trusted-a",
      reservationOwner: "orchestrator:startup",
      claimToken: "claim:assigned",
      preparedAt: "2026-04-07T10:05:00.000Z",
      dispatchMetadata: Object.freeze({}),
      dispatchResult: Object.freeze({
        status: "accepted",
        recordedAt: "2026-04-07T10:05:10.000Z",
        acceptedAt: "2026-04-07T10:05:10.000Z",
        backendKind: "remote-dispatch",
        backendRunId: "backend-run-1",
      }),
    }));

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
    });

    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.dispatchAcceptedReconciled)).toBe(true);
    const recovered = runRepository.runs.get("run:dispatching");
    expect((recovered?.metadata as RunAuthoritativeMetadata).canonicalRun.state).toBe("running");
  });

  it("fails dispatching runs from persisted failed-to-start dispatch outcomes", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:dispatching-failed",
      state: RunLifecycleStates.dispatching,
      queueLifecycleState: RunLifecycleStates.assigned,
    });
    queueRepository.attempts.set("dispatch-attempt:2", Object.freeze({
      attemptId: "dispatch-attempt:2",
      runId: "run:dispatching-failed",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      nodeId: "node:trusted-a",
      reservationOwner: "orchestrator:startup",
      claimToken: "claim:assigned",
      preparedAt: "2026-04-07T10:05:00.000Z",
      dispatchMetadata: Object.freeze({}),
      dispatchResult: Object.freeze({
        status: "failed-to-start",
        recordedAt: "2026-04-07T10:05:08.000Z",
        failure: Object.freeze({
          safeCode: "dispatch-failed-to-start",
          safeMessage: "Run failed to start on the selected execution backend.",
          internalCode: "backend-timeout",
          internalMessage: "Timed out while contacting backend.",
        }),
      }),
    }));

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
    });

    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.dispatchFailedToStartReconciled)).toBe(true);
    const recovered = runRepository.runs.get("run:dispatching-failed");
    expect((recovered?.metadata as RunAuthoritativeMetadata).canonicalRun.state).toBe("failed");
  });

  it("releases expired placement holds and clears deferred intermediary reservations", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:deferred-with-claim",
      state: RunLifecycleStates.queued,
    });

    const deferredEntry = queueRepository.entries.get("run:deferred-with-claim");
    if (!deferredEntry) {
      throw new Error("Expected seeded queue entry.");
    }
    queueRepository.entries.set("run:deferred-with-claim", Object.freeze({
      ...deferredEntry,
      eligibilityMarker: "deferred",
      claimToken: "claim:deferred",
      claimedBy: "orchestrator:alpha",
      claimedAt: "2026-04-07T10:08:00.000Z",
      claimExpiresAt: "2026-04-07T10:30:00.000Z",
      updatedAt: "2026-04-07T10:08:00.000Z",
      revision: deferredEntry.revision + 1,
    }));
    queueRepository.placementHolds.set("node:trusted-z", Object.freeze({
      holdToken: "node-hold:expired",
      runId: "run:deferred-with-claim",
      queueId: "queue:default",
      nodeId: "node:trusted-z",
      reservationOwner: "orchestrator:alpha",
      claimToken: "claim:deferred",
      heldAt: "2026-04-07T10:04:00.000Z",
      expiresAt: "2026-04-07T10:05:00.000Z",
    }));

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      placementHoldRepository: queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
    });

    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.expiredPlacementHoldReleased)).toBe(true);
    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.deferredReservationReleased)).toBe(true);
    expect(queueRepository.placementHolds.size).toBe(0);
    expect(queueRepository.entries.get("run:deferred-with-claim")?.claimToken).toBeUndefined();
  });

  it("records manual follow-up when deferred intermediary reservation cannot be released", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:deferred-release-conflict",
      state: RunLifecycleStates.queued,
    });

    const deferredEntry = queueRepository.entries.get("run:deferred-release-conflict");
    if (!deferredEntry) {
      throw new Error("Expected seeded queue entry.");
    }
    queueRepository.entries.set("run:deferred-release-conflict", Object.freeze({
      ...deferredEntry,
      eligibilityMarker: "deferred",
      claimToken: "claim:deferred-conflict",
      claimedBy: "orchestrator:alpha",
      claimedAt: "2026-04-07T10:08:00.000Z",
      claimExpiresAt: "2026-04-07T10:09:00.000Z",
      updatedAt: "2026-04-07T10:08:00.000Z",
      revision: deferredEntry.revision + 1,
    }));
    queueRepository.releaseClaimFailures.add("run:deferred-release-conflict");

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
    });

    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.manualFollowUpRequired)).toBe(true);
    const manualEvents = intentRepository.events.filter((event) => event.details?.recoveryStatus === "manual-follow-up");
    expect(manualEvents.length).toBeGreaterThan(0);
  });

  it("fails stale running runs and marks unresolved requeue gaps as manual follow-up", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:running-stale",
      state: RunLifecycleStates.running,
      heartbeatAt: "2026-04-07T10:06:00.000Z",
    });
    seedRun({
      runRepository,
      queueRepository,
      runId: "run:assigned-no-requeue",
      state: RunLifecycleStates.assigned,
    });
    queueRepository.allowRecoveryRequeue = false;

    const useCase = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
    });
    const result = await useCase.execute({
      asOf: "2026-04-07T10:20:00.000Z",
      staleAssignedSeconds: 120,
      staleRunningHeartbeatSeconds: 120,
    });

    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.staleRunningFailed)).toBe(true);
    expect(result.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.manualFollowUpRequired)).toBe(true);
    const failed = runRepository.runs.get("run:running-stale");
    expect((failed?.metadata as RunAuthoritativeMetadata).canonicalRun.state).toBe("failed");
  });
});

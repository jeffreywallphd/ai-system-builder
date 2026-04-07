import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  RunNodeClaimConflictReasons,
  type AuthoritativeRunDispatchAttemptRecord,
  type AuthoritativeRunNodeClaimResult,
  type AuthoritativeRunQueueEntryRecord,
  type AuthoritativeRunQueueMutationResult,
  type IAuthoritativeRunPersistenceRepository,
  type IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import {
  ClaimRunForNodeDispatchPreparationUseCase,
  RunNodeDispatchClaimConflictError,
} from "../use-cases/ClaimRunForNodeDispatchPreparationUseCase";

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
    this.runs.set(record.runId, Object.freeze({
      ...record,
      revision: 1,
    }));
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: this.runs.get(record.runId)!,
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
  public readonly queue = new Map<string, AuthoritativeRunQueueEntryRecord>();
  public readonly dispatchAttempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.queue.get(runId);
  }

  public async enqueueRunForAssignment(
    record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    const persisted: AuthoritativeRunQueueEntryRecord = Object.freeze({
      ...record,
      revision: 1,
    });
    this.queue.set(record.runId, persisted);
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

  public async releaseRunClaim(_input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    return false;
  }

  public async claimQueuedRunForNodeDispatch(input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    const existing = this.queue.get(input.runId);
    if (!existing) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.notFound,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry not found.",
        }),
      });
    }
    if (existing.assignmentNodeId) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry already assigned.",
          currentEntry: existing,
        }),
      });
    }
    if (
      existing.claimToken !== input.claimToken
      || existing.claimedBy !== input.reservationOwner
      || !existing.claimExpiresAt
      || existing.claimExpiresAt < input.preparedAt
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.reservationConflict,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue reservation mismatch.",
          currentEntry: existing,
        }),
      });
    }

    const updated: AuthoritativeRunQueueEntryRecord = Object.freeze({
      ...existing,
      lifecycleState: "assigned",
      assignmentNodeId: input.nodeId,
      assignmentClaimedAt: input.preparedAt,
      dispatchPreparedAt: input.preparedAt,
      lastDispatchAttemptId: input.dispatchAttemptId,
      dequeuedAt: input.preparedAt,
      updatedAt: input.preparedAt,
      revision: existing.revision + 1,
    });
    this.queue.set(input.runId, updated);

    const dispatchAttempt: AuthoritativeRunDispatchAttemptRecord = Object.freeze({
      attemptId: input.dispatchAttemptId,
      runId: input.runId,
      queueId: updated.queueId,
      workspaceId: updated.workspaceId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      preparedAt: input.preparedAt,
      dispatchMetadata: Object.freeze({ ...input.dispatchMetadata }),
    });
    this.dispatchAttempts.set(dispatchAttempt.attemptId, dispatchAttempt);

    return Object.freeze({
      outcome: "claimed",
      queueEntry: updated,
      dispatchAttempt,
    });
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.dispatchAttempts.values()].filter((attempt) => attempt.runId === runId),
    );
  }
}

function createQueuedRunRecord(runId: string): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId,
      workflowId: "workflow:test",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      submittedByActorId: "user-owner",
      correlationId: "corr-alpha",
    },
    state: RunLifecycleStates.queued,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T09:00:00.000Z",
    }),
    assignment: Object.freeze({
      status: "unassigned",
    }),
    execution: Object.freeze({
      outcome: "none",
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 1,
    }),
    updatedAt: "2026-04-07T09:00:00.000Z",
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: "workspace-alpha",
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:test",
        versionId: "system:test:v1",
        async: true,
      }),
      tags: Object.freeze([]),
      parameters: Object.freeze({ seed: 7 }),
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
        recordedAt: "2026-04-07T09:00:00.000Z",
      }),
    }),
  });

  return Object.freeze({
    runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.queued),
    workspaceId: "workspace-alpha",
    userIdentityId: "user-owner",
    sourceAggregateRef: "workflow:test",
    initiatedAt: "2026-04-07T09:00:00.000Z",
    metadata,
    revision: 1,
  });
}

function createClaimedQueueEntry(runId: string): AuthoritativeRunQueueEntryRecord {
  return Object.freeze({
    runId,
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    lifecycleState: "queued",
    enteredAt: "2026-04-07T09:00:00.000Z",
    orderKey: "2026-04-07T09:00:00.000Z:run-1",
    eligibilityMarker: "ready",
    eligibleAt: "2026-04-07T09:00:00.000Z",
    claimToken: "claim:run-1",
    claimedBy: "orchestrator:alpha",
    claimedAt: "2026-04-07T09:00:01.000Z",
    claimExpiresAt: "2026-04-07T09:10:00.000Z",
    updatedAt: "2026-04-07T09:00:01.000Z",
    revision: 2,
  });
}

describe("ClaimRunForNodeDispatchPreparationUseCase", () => {
  it("claims queued runs for a node and returns dispatch preparation metadata", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    runRepository.runs.set("run-1", createQueuedRunRecord("run-1"));
    queueRepository.queue.set("run-1", createClaimedQueueEntry("run-1"));

    const useCase = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator: {
        nextId: (prefix) => `${prefix}:test`,
      },
    });

    const result = await useCase.execute({
      runId: "run-1",
      nodeId: "node:trusted-a",
      reservationOwner: "orchestrator:alpha",
      claimToken: "claim:run-1",
      preparedAt: "2026-04-07T09:02:00.000Z",
    });

    expect(result.run.state).toBe("assigned");
    expect(result.queue.assignmentNodeId).toBe("node:trusted-a");
    expect(result.dispatchPreparation.dispatchAttemptId).toBe("dispatch-attempt:test");
    expect(
      (result.dispatchPreparation.dispatchMetadata.runtimeTarget as { systemId?: string } | undefined)?.systemId,
    ).toBe("system:test");
    const persistedQueueEntry = await queueRepository.getQueueEntryByRunId("run-1");
    expect(persistedQueueEntry?.assignmentNodeId).toBe("node:trusted-a");
    expect((await queueRepository.listDispatchAttemptsByRunId("run-1")).length).toBe(1);
  });

  it("surfaces controlled conflicts when duplicate node claims are attempted", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    runRepository.runs.set("run-1", createQueuedRunRecord("run-1"));
    queueRepository.queue.set("run-1", createClaimedQueueEntry("run-1"));

    const useCase = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator: {
        nextId: (prefix) => `${prefix}:test`,
      },
    });

    await useCase.execute({
      runId: "run-1",
      nodeId: "node:trusted-a",
      reservationOwner: "orchestrator:alpha",
      claimToken: "claim:run-1",
      preparedAt: "2026-04-07T09:02:00.000Z",
    });

    let thrown: unknown;
    try {
      await useCase.execute({
        runId: "run-1",
        nodeId: "node:trusted-b",
        reservationOwner: "orchestrator:alpha",
        claimToken: "claim:run-1",
        preparedAt: "2026-04-07T09:03:00.000Z",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RunNodeDispatchClaimConflictError);
    expect((thrown as RunNodeDispatchClaimConflictError).conflict.reason).toBe(
      RunNodeClaimConflictReasons.alreadyAssigned,
    );
  });
});

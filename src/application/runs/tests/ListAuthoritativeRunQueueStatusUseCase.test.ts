import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunQueueEntryRecord,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "@application/runs/use-cases/RunCreationPersistenceMapper";
import { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import type { RunLifecycleState } from "@domain/runs/RunDomain";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze(
      [...this.runs.values()].filter((run) => !query.workspaceId || run.workspaceId === query.workspaceId),
    );
  }

  public async createRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    this.runs.set(record.runId, record);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }

  public async saveRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    this.runs.set(record.runId, record);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }
}

class InMemoryQueueRepository implements IRunOrchestrationQueuePersistenceRepository {
  public entries: ReadonlyArray<AuthoritativeRunQueueEntryRecord> = Object.freeze([]);

  public async getQueueEntryByRunId(_runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return undefined;
  }

  public async listQueueEntries(_query: {
    readonly workspaceId?: string;
    readonly queueId?: string;
    readonly lifecycleStates?: ReadonlyArray<RunLifecycleState>;
    readonly includeDequeued?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return this.entries;
  }

  public async enqueueRunForAssignment(
    _record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly record: AuthoritativeRunQueueEntryRecord; }> {
    throw new Error("Not used in test.");
  }

  public async listAssignmentReadyRuns(
    _query: {
      readonly asOf: string;
      readonly queueId?: string;
      readonly workspaceId?: string;
      readonly limit?: number;
    },
  ): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
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

  public async claimQueuedRunForNodeDispatch(_input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<never> {
    throw new Error("Not used in test.");
  }

  public async recordDispatchAttemptResult(_input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: import("@application/runs/ports/RunOrchestrationPersistencePorts").AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    return false;
  }

  public async finalizeRunQueueEntry(_input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    return false;
  }

  public async listDispatchAttemptsByRunId(_runId: string) {
    return Object.freeze([]);
  }
}

function createRunRecord(input: {
  readonly runId: string;
  readonly workflowId: string;
  readonly state: typeof RunLifecycleStates[keyof typeof RunLifecycleStates];
  readonly workspaceId: string;
  readonly submittedAt: string;
  readonly updatedAt: string;
}): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: input.runId,
      workflowId: input.workflowId,
      workspaceId: input.workspaceId,
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: input.submittedAt,
      submittedByActorId: "user:owner",
    },
    state: input.state,
    assignment: {
      status: "unassigned",
    },
    execution: {
      outcome: "none",
    },
    retry: {
      attempt: 1,
      maxAttempts: 1,
    },
    updatedAt: input.updatedAt,
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: input.workspaceId,
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:demo",
        versionId: "system:demo:v1",
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
      initialLifecycleState: input.state,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: input.updatedAt,
      }),
    }),
  });

  return Object.freeze({
    runId: input.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(input.state),
    workspaceId: input.workspaceId,
    userIdentityId: "user:owner",
    sourceAggregateRef: `workflow:${input.workflowId}`,
    initiatedAt: input.submittedAt,
    metadata,
    revision: 1,
  });
}

describe("ListAuthoritativeRunQueueStatusUseCase", () => {
  it("projects queue status views with position and action availability", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();

    await runRepository.createRun(createRunRecord({
      runId: "run:queued",
      workflowId: "workflow:queued",
      state: RunLifecycleStates.queued,
      workspaceId: "workspace-alpha",
      submittedAt: "2026-04-07T10:00:00.000Z",
      updatedAt: "2026-04-07T10:01:00.000Z",
    }), { operationKey: "seed:run:queued", actorId: "system" });

    queueRepository.entries = Object.freeze([Object.freeze({
      runId: "run:queued",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: RunLifecycleStates.queued,
      enteredAt: "2026-04-07T10:00:00.000Z",
      orderKey: "0001",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-07T10:00:00.000Z",
      updatedAt: "2026-04-07T10:01:00.000Z",
      revision: 1,
    })]);

    const useCase = new ListAuthoritativeRunQueueStatusUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T10:02:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
    });

    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.queue.position).toBe(1);
    expect(result.items[0]?.actionAvailability?.cancel.allowed).toBeTrue();
    expect(result.items[0]?.scheduling?.candidateConstraints?.requiresRemoteScheduling).toBeTrue();
    expect(result.items[0]?.scheduling?.placement.outcome).toBe("not-applicable");
  });
});

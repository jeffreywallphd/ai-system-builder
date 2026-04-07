import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
  RunQueueEligibilityMarker,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  IRunNodeAssignmentEligibilityService,
  RunAssignmentEligibilityDecision,
} from "@application/runs/ports/RunAssignmentEligibilityPorts";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import { SelectAssignmentReadyRunsUseCase } from "../use-cases/SelectAssignmentReadyRunsUseCase";

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
  public readonly queue = new Map<string, AuthoritativeRunQueueEntryRecord>();
  public readonly releases: Array<{ readonly runId: string; readonly claimToken: string; readonly releasedAt: string }> = [];

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

  public async listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const asOf = query.asOf;
    const ready = [...this.queue.values()]
      .filter((entry) => !entry.dequeuedAt)
      .filter((entry) => entry.eligibilityMarker === "ready")
      .filter((entry) => entry.eligibleAt <= asOf)
      .filter((entry) => !query.queueId || entry.queueId === query.queueId)
      .filter((entry) => !query.workspaceId || entry.workspaceId === query.workspaceId)
      .filter((entry) => !entry.claimExpiresAt || entry.claimExpiresAt <= asOf)
      .sort((left, right) => {
        if (left.eligibleAt !== right.eligibleAt) {
          return left.eligibleAt.localeCompare(right.eligibleAt);
        }
        if (left.orderKey !== right.orderKey) {
          return left.orderKey.localeCompare(right.orderKey);
        }
        return left.runId.localeCompare(right.runId);
      });

    const limit = Math.max(1, query.limit ?? 10);
    return Object.freeze(ready.slice(0, limit));
  }

  public async claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const candidates = await this.listAssignmentReadyRuns({
      asOf: input.asOf,
      queueId: input.queueId,
      workspaceId: input.workspaceId,
      limit: input.limit,
    });

    const claimed: AuthoritativeRunQueueEntryRecord[] = [];
    for (const candidate of candidates) {
      const claimExpiresAt = new Date(Date.parse(input.asOf) + (input.reservationTtlSeconds * 1000)).toISOString();
      const next: AuthoritativeRunQueueEntryRecord = Object.freeze({
        ...candidate,
        claimToken: `claim:${candidate.runId}`,
        claimedBy: input.reservationOwner,
        claimedAt: input.asOf,
        claimExpiresAt,
        updatedAt: input.asOf,
        revision: candidate.revision + 1,
      });
      this.queue.set(candidate.runId, next);
      claimed.push(next);
    }

    return Object.freeze(claimed);
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const existing = this.queue.get(input.runId);
    if (!existing || existing.claimToken !== input.claimToken) {
      return false;
    }
    this.releases.push(input);
    this.queue.set(input.runId, Object.freeze({
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

  public async listDispatchAttemptsByRunId(_runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze([]);
  }
}

class ConditionalAssignmentEligibilityService implements IRunNodeAssignmentEligibilityService {
  public constructor(private readonly deniedRunIds = new Set<string>()) {}

  public async evaluateNodeEligibility(input: {
    readonly asOf: string;
    readonly run: PlatformRunRecord;
    readonly queueEntry: AuthoritativeRunQueueEntryRecord;
    readonly nodeId: string;
  }): Promise<RunAssignmentEligibilityDecision> {
    if (this.deniedRunIds.has(input.run.runId)) {
      return Object.freeze({
        eligible: false,
        nodeId: input.nodeId,
        reasons: Object.freeze([
          Object.freeze({
            code: "policy-denied",
            message: "Test policy denied this run for the selected node.",
          }),
        ]),
      });
    }

    return Object.freeze({
      eligible: true,
      nodeId: input.nodeId,
      reasons: Object.freeze([]),
    });
  }
}

function createRunRecord(input: {
  readonly runId: string;
  readonly queueId: string;
  readonly lifecycleState: typeof RunLifecycleStates[keyof typeof RunLifecycleStates];
  readonly source?: typeof RunSubmissionSources[keyof typeof RunSubmissionSources];
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly workspaceId?: string;
}): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: input.runId,
      workflowId: `workflow:${input.runId}`,
      workspaceId: input.workspaceId,
    },
    submission: {
      source: input.source ?? RunSubmissionSources.api,
      submittedAt: input.submittedAt,
      submittedByActorId: "user-owner",
    },
    state: input.lifecycleState,
    queue: Object.freeze({
      queueId: input.queueId,
      enteredAt: input.submittedAt,
      position: null,
      positionAsOf: input.updatedAt,
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
    updatedAt: input.updatedAt,
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: input.workspaceId ?? "workspace-alpha",
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:demo",
        versionId: "system:demo:v1",
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
      initialLifecycleState: input.lifecycleState,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: input.queueId,
        recordedAt: input.updatedAt,
      }),
    }),
  });

  return Object.freeze({
    runId: input.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(input.lifecycleState),
    workspaceId: input.workspaceId,
    userIdentityId: "user-owner",
    sourceAggregateRef: `workflow:${input.runId}`,
    initiatedAt: input.submittedAt,
    metadata,
    revision: 1,
  });
}

function createQueueEntry(input: {
  readonly runId: string;
  readonly queueId: string;
  readonly enteredAt: string;
  readonly eligibleAt: string;
  readonly orderKey: string;
  readonly eligibilityMarker?: RunQueueEligibilityMarker;
  readonly workspaceId?: string;
}): AuthoritativeRunQueueEntryRecord {
  return Object.freeze({
    runId: input.runId,
    queueId: input.queueId,
    workspaceId: input.workspaceId,
    lifecycleState: RunLifecycleStates.queued,
    enteredAt: input.enteredAt,
    orderKey: input.orderKey,
    eligibilityMarker: input.eligibilityMarker ?? "ready",
    eligibleAt: input.eligibleAt,
    updatedAt: input.enteredAt,
    revision: 1,
  });
}

describe("SelectAssignmentReadyRunsUseCase", () => {
  it("claims assignment-ready runs in deterministic queue order", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();

    const runSubmissionTimes = Object.freeze({
      "run-a": "2026-04-07T09:01:00.000Z",
      "run-b": "2026-04-07T09:02:00.000Z",
      "run-c": "2026-04-07T09:03:00.000Z",
    });
    for (const runId of ["run-a", "run-b", "run-c"] as const) {
      await runRepository.createRun(createRunRecord({
        runId,
        queueId: "queue:default",
        lifecycleState: RunLifecycleStates.queued,
        submittedAt: runSubmissionTimes[runId],
        updatedAt: "2026-04-07T09:10:00.000Z",
        workspaceId: "workspace-alpha",
      }), { operationKey: `seed:${runId}`, actorId: "system:test" });
    }

    queueRepository.queue.set("run-a", createQueueEntry({
      runId: "run-a",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:01:00.000Z",
      eligibleAt: "2026-04-07T09:02:00.000Z",
      orderKey: "2026-04-07T09:01:00.000Z:run-a",
      workspaceId: "workspace-alpha",
    }));
    queueRepository.queue.set("run-b", createQueueEntry({
      runId: "run-b",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:30.000Z",
      eligibleAt: "2026-04-07T09:01:00.000Z",
      orderKey: "2026-04-07T09:00:30.000Z:run-b",
      workspaceId: "workspace-alpha",
    }));
    queueRepository.queue.set("run-c", createQueueEntry({
      runId: "run-c",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:03:00.000Z",
      eligibleAt: "2026-04-07T09:04:00.000Z",
      orderKey: "2026-04-07T09:03:00.000Z:run-c",
      workspaceId: "workspace-alpha",
    }));

    const useCase = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T09:05:00.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:alpha",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 2,
      reservationTtlSeconds: 60,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.run.runId).toBe("run-b");
    expect(result.items[1]?.run.runId).toBe("run-a");
    expect(result.items[0]?.queue.claimToken).toBe("claim:run-b");
    expect(result.items[1]?.queue.claimToken).toBe("claim:run-a");
  });

  it("excludes deferred or future-eligible queue entries from assignment selection", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();

    await runRepository.createRun(createRunRecord({
      runId: "run-ready",
      queueId: "queue:default",
      lifecycleState: RunLifecycleStates.queued,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:00:00.000Z",
    }), { operationKey: "seed:ready", actorId: "system:test" });
    await runRepository.createRun(createRunRecord({
      runId: "run-future",
      queueId: "queue:default",
      lifecycleState: RunLifecycleStates.queued,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:00:00.000Z",
    }), { operationKey: "seed:future", actorId: "system:test" });
    await runRepository.createRun(createRunRecord({
      runId: "run-deferred",
      queueId: "queue:default",
      lifecycleState: RunLifecycleStates.queued,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:00:00.000Z",
    }), { operationKey: "seed:deferred", actorId: "system:test" });

    queueRepository.queue.set("run-ready", createQueueEntry({
      runId: "run-ready",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      eligibleAt: "2026-04-07T09:01:00.000Z",
      orderKey: "2026-04-07T09:00:00.000Z:run-ready",
    }));
    queueRepository.queue.set("run-future", createQueueEntry({
      runId: "run-future",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      eligibleAt: "2026-04-07T10:01:00.000Z",
      orderKey: "2026-04-07T09:00:00.000Z:run-future",
    }));
    queueRepository.queue.set("run-deferred", createQueueEntry({
      runId: "run-deferred",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      eligibleAt: "2026-04-07T09:00:30.000Z",
      orderKey: "2026-04-07T09:00:00.000Z:run-deferred",
      eligibilityMarker: "deferred",
    }));

    const useCase = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T09:05:00.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:alpha",
      queueId: "queue:default",
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.run.runId).toBe("run-ready");
  });

  it("releases claimed runs that fail node-assignment eligibility checks", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();

    for (const runId of ["run-eligible", "run-ineligible"] as const) {
      await runRepository.createRun(createRunRecord({
        runId,
        queueId: "queue:default",
        lifecycleState: RunLifecycleStates.queued,
        submittedAt: "2026-04-07T09:00:00.000Z",
        updatedAt: "2026-04-07T09:00:00.000Z",
      }), { operationKey: `seed:${runId}`, actorId: "system:test" });

      queueRepository.queue.set(runId, createQueueEntry({
        runId,
        queueId: "queue:default",
        enteredAt: "2026-04-07T09:00:00.000Z",
        eligibleAt: "2026-04-07T09:00:00.000Z",
        orderKey: `2026-04-07T09:00:00.000Z:${runId}`,
      }));
    }

    const useCase = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      assignmentEligibilityService: new ConditionalAssignmentEligibilityService(new Set(["run-ineligible"])),
      now: () => new Date("2026-04-07T09:01:00.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:alpha",
      queueId: "queue:default",
      nodeId: "node:trusted-alpha",
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.run.runId).toBe("run-eligible");
    expect(queueRepository.releases).toEqual([
      Object.freeze({
        runId: "run-ineligible",
        claimToken: "claim:run-ineligible",
        releasedAt: "2026-04-07T09:01:00.000Z",
      }),
    ]);
  });

  it("returns no items for node-targeted selection when assignment matching is unavailable", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();

    await runRepository.createRun(createRunRecord({
      runId: "run-a",
      queueId: "queue:default",
      lifecycleState: RunLifecycleStates.queued,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:00:00.000Z",
    }), { operationKey: "seed:run-a", actorId: "system:test" });

    queueRepository.queue.set("run-a", createQueueEntry({
      runId: "run-a",
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      eligibleAt: "2026-04-07T09:00:00.000Z",
      orderKey: "2026-04-07T09:00:00.000Z:run-a",
    }));

    const useCase = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T09:01:00.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:alpha",
      nodeId: "node:trusted-alpha",
      limit: 10,
    });

    expect(result.items).toEqual([]);
    expect(queueRepository.releases).toEqual([]);
  });
});

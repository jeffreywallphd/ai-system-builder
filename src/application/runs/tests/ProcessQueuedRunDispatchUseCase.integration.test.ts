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
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import { ClaimRunForNodeDispatchPreparationUseCase } from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { BuildAssignedRunExecutionCommandUseCase } from "@application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase";
import { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import { HandleRunDispatchResultUseCase } from "@application/runs/use-cases/HandleRunDispatchResultUseCase";
import { ProcessQueuedRunDispatchUseCase } from "@application/runs/use-cases/ProcessQueuedRunDispatchUseCase";
import { RunLifecycleStates, RunSubmissionSources, type RunLifecycleState } from "@domain/runs/RunDomain";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  private readonly runs = new Map<string, PlatformRunRecord>();

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
    const current = this.runs.get(record.runId);
    if (!current) {
      throw new Error(`Run '${record.runId}' not found.`);
    }
    if (typeof mutation.expectedRevision === "number" && mutation.expectedRevision !== current.revision) {
      throw new Error("expectedRevision mismatch");
    }
    const persisted = Object.freeze({
      ...record,
      revision: current.revision + 1,
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
  private readonly entries = new Map<string, AuthoritativeRunQueueEntryRecord>();
  private readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.get(runId);
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

  public async listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const asOf = query.asOf;
    const limit = Math.max(1, query.limit ?? 10);
    return Object.freeze(
      [...this.entries.values()]
        .filter((entry) => !entry.dequeuedAt)
        .filter((entry) => entry.eligibilityMarker === "ready")
        .filter((entry) => entry.eligibleAt <= asOf)
        .filter((entry) => !entry.claimExpiresAt || entry.claimExpiresAt <= asOf)
        .filter((entry) => !query.queueId || entry.queueId === query.queueId)
        .filter((entry) => !query.workspaceId || entry.workspaceId === query.workspaceId)
        .sort((left, right) => left.orderKey.localeCompare(right.orderKey) || left.runId.localeCompare(right.runId))
        .slice(0, limit),
    );
  }

  public async claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const ready = await this.listAssignmentReadyRuns({
      asOf: input.asOf,
      queueId: input.queueId,
      workspaceId: input.workspaceId,
      limit: input.limit,
    });
    const claimExpiresAt = new Date(Date.parse(input.asOf) + (input.reservationTtlSeconds * 1000)).toISOString();
    const claimed = ready.map((entry) => {
      const next = Object.freeze({
        ...entry,
        claimToken: `claim:${entry.runId}`,
        claimedBy: input.reservationOwner,
        claimedAt: input.asOf,
        claimExpiresAt,
        updatedAt: input.asOf,
        revision: entry.revision + 1,
      });
      this.entries.set(entry.runId, next);
      return next;
    });
    return Object.freeze(claimed);
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const current = this.entries.get(input.runId);
    if (!current || current.claimToken !== input.claimToken) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...current,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: current.revision + 1,
    }));
    return true;
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
    const current = this.entries.get(input.runId);
    if (!current) {
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
    if (current.assignmentNodeId) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry already assigned.",
          currentEntry: current,
        }),
      });
    }
    if (
      current.claimToken !== input.claimToken
      || current.claimedBy !== input.reservationOwner
      || !current.claimExpiresAt
      || current.claimExpiresAt < input.preparedAt
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.reservationConflict,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue reservation mismatch.",
          currentEntry: current,
        }),
      });
    }

    const nextQueue = Object.freeze({
      ...current,
      lifecycleState: RunLifecycleStates.assigned,
      assignmentNodeId: input.nodeId,
      assignmentClaimedAt: input.preparedAt,
      dispatchPreparedAt: input.preparedAt,
      lastDispatchAttemptId: input.dispatchAttemptId,
      dequeuedAt: input.preparedAt,
      updatedAt: input.preparedAt,
      revision: current.revision + 1,
    });
    this.entries.set(input.runId, nextQueue);
    const attempt = Object.freeze({
      attemptId: input.dispatchAttemptId,
      runId: input.runId,
      queueId: current.queueId,
      workspaceId: current.workspaceId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      preparedAt: input.preparedAt,
      dispatchMetadata: input.dispatchMetadata,
    });
    this.attempts.set(input.dispatchAttemptId, attempt);
    return Object.freeze({
      outcome: "claimed",
      queueEntry: nextQueue,
      dispatchAttempt: attempt,
    });
  }

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const current = this.attempts.get(input.attemptId);
    if (!current || current.runId !== input.runId) {
      return false;
    }
    this.attempts.set(input.attemptId, Object.freeze({
      ...current,
      dispatchResult: input.result,
    }));
    return true;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const current = this.entries.get(input.runId);
    if (!current) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...current,
      lifecycleState: input.lifecycleState,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.finalizedAt,
      revision: current.revision + 1,
    }));
    return true;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.attempts.values()]
        .filter((attempt) => attempt.runId === runId)
        .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt) || left.attemptId.localeCompare(right.attemptId)),
    );
  }
}

class InMemoryIntentRepository implements IRunOrchestrationIntentRepository {
  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }
}

class SequenceIdGenerator {
  private value = 0;

  public nextId(prefix: string): string {
    this.value += 1;
    return `${prefix}:${this.value}`;
  }
}

function buildSubmissionCommand(occurredAt: string) {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:owner",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow:image-demo",
    source: RunSubmissionSources.api,
    runtimeTarget: Object.freeze({
      systemId: "comfyui",
      versionId: "system:comfyui:v1",
      async: true,
    }),
    tags: Object.freeze(["queue:default"]),
    metadata: Object.freeze({
      origin: "image-studio",
    }),
    parameters: Object.freeze({
      prompt: "make a watercolor portrait",
    }),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: "user:owner",
      correlationId: "corr:image-dispatch",
      idempotencyKey: `image-dispatch:${occurredAt}`,
    }),
    occurredAt,
  });
}

describe("ProcessQueuedRunDispatchUseCase integration", () => {
  it("advances queued runs through claim + dispatch into running state with dispatch linkage", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const idGenerator = new SequenceIdGenerator();

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T12:00:00.000Z"),
    });
    expect(created.run.state).toBe("queued");

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:00:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:00:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:00:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:run:1",
          backendKind: "comfyui",
          backendRunId: "comfy-job:1",
          acceptedAt: "2026-04-08T12:00:07.000Z",
        }),
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:00:07.000Z"),
    });

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      now: () => new Date("2026-04-08T12:00:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      nodeId: "node:image-executor:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.selectedCount).toBe(1);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("dispatched");
    if (result.outcomes[0]?.status === "dispatched") {
      expect(result.outcomes[0].dispatchAttemptId).toContain("dispatch-attempt:");
      expect(result.outcomes[0].dispatchId).toBe("dispatch:run:1");
      expect(result.outcomes[0].backendRunId).toBe("comfy-job:1");
    }

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("running");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("running");
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.dispatchResult?.status).toBe("accepted");
    expect(attempts[0]?.dispatchResult?.dispatchId).toBe("dispatch:run:1");
    expect(attempts[0]?.dispatchResult?.backendRunId).toBe("comfy-job:1");
  });

  it("captures dispatch failures while leaving authoritative lifecycle transitions to dispatch result handling", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const idGenerator = new SequenceIdGenerator();

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T12:10:00.000Z"),
    });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:10:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:10:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:10:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => {
          throw new Error("comfy backend unavailable");
        },
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:10:07.000Z"),
    });

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      now: () => new Date("2026-04-08T12:10:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      nodeId: "node:image-executor:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("failed");
    if (result.outcomes[0]?.status === "failed") {
      expect(result.outcomes[0].stage).toBe("dispatch");
      expect(result.outcomes[0].message).toContain("unavailable");
      expect(result.outcomes[0].dispatchAttemptId).toContain("dispatch-attempt:");
    }

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("failed");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("failed");
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.dispatchResult?.status).toBe("failed-to-start");
  });
});


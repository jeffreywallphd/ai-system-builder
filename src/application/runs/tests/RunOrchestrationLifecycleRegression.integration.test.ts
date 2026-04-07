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
  RunQueueEligibilityMarker,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import {
  ClaimRunForNodeDispatchPreparationUseCase,
  RunNodeDispatchClaimConflictError,
} from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { BuildAssignedRunExecutionCommandUseCase } from "@application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase";
import { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import { HandleRunDispatchResultUseCase } from "@application/runs/use-cases/HandleRunDispatchResultUseCase";
import { IngestRunExecutionUpdateUseCase } from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationOutcomes,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import {
  RequestAuthoritativeRunRetryUseCase,
  RunRetryIneligibleError,
} from "@application/runs/use-cases/RequestAuthoritativeRunRetryUseCase";
import {
  RecoverRunOrchestrationStartupStateUseCase,
  RunOrchestrationRecoveryActionKinds,
} from "@application/runs/use-cases/RecoverRunOrchestrationStartupStateUseCase";
import { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import { ListStaleSchedulingReservationsUseCase } from "@application/runs/use-cases/ListStaleSchedulingReservationsUseCase";
import { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import { AuthoritativeRunQueryBackendApi } from "@infrastructure/api/runs/AuthoritativeRunQueryBackendApi";
import {
  parseRunListReadResponse,
  parseRunQueueStatusReadResponse,
  parseRunStatusEnvelope,
} from "@shared/schemas/runtime/RunOrchestrationTransportSchemaContracts";
import {
  type PlatformAuditEventListQuery,
  type IPlatformAuditEventRepository,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { ValidateRunSubmissionResult } from "@application/runs/use-cases/RunSubmissionValidationContracts";
import type { CreateAuthoritativeRunResult } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import {
  RunLifecycleStates,
  RunSubmissionSources,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";

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

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.get(runId);
  }

  public async listQueueEntries(query: {
    readonly workspaceId?: string;
    readonly queueId?: string;
    readonly lifecycleStates?: ReadonlyArray<RunLifecycleState>;
    readonly includeDequeued?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    let items = [...this.entries.values()];
    if (query.workspaceId) {
      items = items.filter((entry) => entry.workspaceId === query.workspaceId);
    }
    if (query.queueId) {
      items = items.filter((entry) => entry.queueId === query.queueId);
    }
    if (query.lifecycleStates && query.lifecycleStates.length > 0) {
      const allowed = new Set(query.lifecycleStates);
      items = items.filter((entry) => allowed.has(entry.lifecycleState));
    }
    if (!query.includeDequeued) {
      items = items.filter((entry) => !entry.dequeuedAt);
    }
    items.sort((left, right) => left.orderKey.localeCompare(right.orderKey) || left.runId.localeCompare(right.runId));
    const offset = Math.max(0, query.offset ?? 0);
    const limit = Math.max(1, query.limit ?? items.length);
    return Object.freeze(items.slice(offset, offset + limit));
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
    let items = [...this.entries.values()]
      .filter((entry) => !entry.dequeuedAt)
      .filter((entry) => entry.eligibilityMarker === "ready")
      .filter((entry) => entry.eligibleAt <= asOf)
      .filter((entry) => !entry.claimExpiresAt || entry.claimExpiresAt <= asOf)
      .filter((entry) => !query.queueId || entry.queueId === query.queueId)
      .filter((entry) => !query.workspaceId || entry.workspaceId === query.workspaceId)
      .sort((left, right) => left.orderKey.localeCompare(right.orderKey) || left.runId.localeCompare(right.runId));

    const limit = Math.max(1, query.limit ?? 10);
    items = items.slice(0, limit);
    return Object.freeze(items);
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

    const claimExpiresAt = new Date(Date.parse(input.asOf) + (input.reservationTtlSeconds * 1000)).toISOString();
    const claimed: AuthoritativeRunQueueEntryRecord[] = [];
    for (const candidate of candidates) {
      const next = Object.freeze({
        ...candidate,
        claimToken: `claim:${candidate.runId}`,
        claimedBy: input.reservationOwner,
        claimedAt: input.asOf,
        claimExpiresAt,
        updatedAt: input.asOf,
        revision: candidate.revision + 1,
      });
      this.entries.set(candidate.runId, next);
      claimed.push(next);
    }
    return Object.freeze(claimed);
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
    const next = Object.freeze({
      ...existing,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: existing.revision + 1,
    });
    this.entries.set(input.runId, next);
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
    const existing = this.entries.get(input.runId);
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

    const queueEntry = Object.freeze({
      ...existing,
      lifecycleState: RunLifecycleStates.assigned,
      assignmentNodeId: input.nodeId,
      assignmentClaimedAt: input.preparedAt,
      dispatchPreparedAt: input.preparedAt,
      lastDispatchAttemptId: input.dispatchAttemptId,
      dequeuedAt: input.preparedAt,
      updatedAt: input.preparedAt,
      revision: existing.revision + 1,
    });
    this.entries.set(input.runId, queueEntry);

    const dispatchAttempt = Object.freeze({
      attemptId: input.dispatchAttemptId,
      runId: input.runId,
      queueId: queueEntry.queueId,
      workspaceId: queueEntry.workspaceId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      preparedAt: input.preparedAt,
      dispatchMetadata: input.dispatchMetadata,
    });
    this.attempts.set(dispatchAttempt.attemptId, dispatchAttempt);

    return Object.freeze({
      outcome: "claimed",
      queueEntry,
      dispatchAttempt,
    });
  }

  public async requeueAssignedRunForRecovery(input: {
    readonly runId: string;
    readonly requeuedAt: string;
    readonly eligibilityMarker?: RunQueueEligibilityMarker;
  }): Promise<boolean> {
    const existing = this.entries.get(input.runId);
    if (!existing || existing.lifecycleState !== RunLifecycleStates.assigned) {
      return false;
    }

    const next = Object.freeze({
      ...existing,
      lifecycleState: RunLifecycleStates.queued,
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
      revision: existing.revision + 1,
    });
    this.entries.set(input.runId, next);
    return true;
  }

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const existing = this.attempts.get(input.attemptId);
    if (!existing || existing.runId !== input.runId) {
      return false;
    }

    this.attempts.set(input.attemptId, Object.freeze({
      ...existing,
      dispatchResult: input.result,
    }));
    return true;
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

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.attempts.values()]
        .filter((attempt) => attempt.runId === runId)
        .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt) || left.attemptId.localeCompare(right.attemptId)),
    );
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

class InMemoryAuditRepository implements IPlatformAuditEventRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendAuditEvent(
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

  public async listAuditEvents(query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return Object.freeze(this.events.filter((event) => !query.targetRef || event.targetRef === query.targetRef));
  }
}

class SequenceIdGenerator {
  private value = 0;

  public nextId(prefix: string): string {
    this.value += 1;
    return `${prefix}:${this.value}`;
  }
}

function buildCanonicalSubmissionCommand() {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:owner",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow:demo",
    source: RunSubmissionSources.api,
    runtimeTarget: Object.freeze({
      systemId: "system:demo",
      versionId: "system:demo:v1",
      async: true,
    }),
    tags: Object.freeze(["queue:default"]),
    metadata: Object.freeze({
      requestType: "regression",
    }),
    parameters: Object.freeze({
      prompt: "safe-prompt",
    }),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: "user:owner",
      correlationId: "corr-lifecycle-regression",
      idempotencyKey: "run-lifecycle-regression",
    }),
    occurredAt: "2026-04-07T12:00:00.000Z",
  });
}

function createValidateStub(command = buildCanonicalSubmissionCommand()) {
  let calls = 0;
  return Object.freeze({
    get calls() {
      return calls;
    },
    execute: async () => {
      calls += 1;
      const result: ValidateRunSubmissionResult = Object.freeze({
        ok: true,
        command,
      });
      return result;
    },
  });
}

function createNoOpCreateStub() {
  let calls = 0;
  return Object.freeze({
    get calls() {
      return calls;
    },
    execute: async () => {
      calls += 1;
      const result: CreateAuthoritativeRunResult = Object.freeze({
        run: Object.freeze({
          contractVersion: "run-orchestration-transport/v1",
          runId: "run:unexpected",
          workflowId: "workflow:demo",
          workspaceId: "workspace-alpha",
          source: "ui-rerun",
          state: "queued",
          assignmentStatus: "unassigned",
          executionOutcome: "none",
          submittedAt: "2026-04-07T12:30:00.000Z",
          updatedAt: "2026-04-07T12:30:00.000Z",
          submission: Object.freeze({ submittedByActorId: "user:owner" }),
          assignment: Object.freeze({ status: "unassigned" }),
          execution: Object.freeze({ outcome: "none" }),
          retry: Object.freeze({ attempt: 2, maxAttempts: 3 }),
        }),
        persistedRunRevision: 1,
        orchestrationIntentEventId: "audit:unexpected",
      });
      return result;
    },
  });
}

describe("Run orchestration lifecycle regression", () => {
  it("covers authoritative submission, queueing, assignment, dispatch, progress, completion, and read contracts", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const auditRepository = new InMemoryAuditRepository();
    const idGenerator = new SequenceIdGenerator();

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const created = await createRun.execute({
      command: buildCanonicalSubmissionCommand(),
    });

    expect(created.run.state).toBe("queued");
    expect(created.run.retry.attempt).toBe(1);

    const listRuns = new ListAuthoritativeRunsUseCase(runRepository);
    const listQueueStatus = new ListAuthoritativeRunQueueStatusUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T12:00:10.000Z"),
    });
    const getRun = new GetAuthoritativeRunUseCase(runRepository);
    const queryApi = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: listRuns,
      listAuthoritativeRunQueueStatusUseCase: listQueueStatus,
      listStaleSchedulingReservationsUseCase: new ListStaleSchedulingReservationsUseCase({
        queueRepository,
        now: () => new Date("2026-04-07T12:00:10.000Z"),
      }),
      getAuthoritativeRunUseCase: getRun,
      runRepository,
      queueRepository,
      auditEventRepository: auditRepository,
      now: () => new Date("2026-04-07T12:00:10.000Z"),
    });

    const queuedProjection = await queryApi.listQueueStatus({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(queuedProjection.ok).toBeTrue();
    const parsedQueueProjection = parseRunQueueStatusReadResponse(queuedProjection.data);
    expect(parsedQueueProjection.items).toHaveLength(1);
    expect(parsedQueueProjection.items[0]?.state).toBe("queued");
    expect(parsedQueueProjection.items[0]?.actionAvailability?.cancel.allowed).toBeTrue();

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T12:00:20.000Z"),
    });
    const selection = await selectReady.execute({
      reservationOwner: "orchestrator:alpha",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 60,
    });

    expect(selection.items).toHaveLength(1);
    const selected = selection.items[0]!;

    const claim = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
    });
    const claimed = await claim.execute({
      runId: selected.run.runId,
      nodeId: "node:trusted-1",
      reservationOwner: "orchestrator:alpha",
      claimToken: selected.queue.claimToken,
      preparedAt: "2026-04-07T12:00:30.000Z",
    });

    expect(claimed.run.state).toBe("assigned");
    expect(claimed.queue.assignmentNodeId).toBe("node:trusted-1");

    await expect(claim.execute({
      runId: selected.run.runId,
      nodeId: "node:trusted-2",
      reservationOwner: "orchestrator:alpha",
      claimToken: selected.queue.claimToken,
      preparedAt: "2026-04-07T12:00:35.000Z",
    })).rejects.toBeInstanceOf(RunNodeDispatchClaimConflictError);

    const commandBuilder = new BuildAssignedRunExecutionCommandUseCase({
      runRepository,
      queueRepository,
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-07T12:00:40.000Z"),
    });
    const dispatch = new DispatchAssignedRunExecutionUseCase({
      commandBuilder,
      dispatchResultHandler,
      now: () => new Date("2026-04-07T12:00:40.000Z"),
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:accepted:1",
          backendKind: "remote-dispatch",
          backendRunId: "backend-run:1",
          acceptedAt: "2026-04-07T12:00:40.000Z",
        }),
      },
    });

    const dispatchResult = await dispatch.execute({
      runId: selected.run.runId,
      dispatchAttemptId: claimed.dispatchPreparation.dispatchAttemptId,
    });
    expect(dispatchResult.command.run.runId).toBe(selected.run.runId);
    const queueAfterDispatchAccepted = await queueRepository.getQueueEntryByRunId(selected.run.runId);
    expect(queueAfterDispatchAccepted?.lifecycleState).toBe("running");
    expect(queueAfterDispatchAccepted?.claimToken).toBeUndefined();

    const ingest = new IngestRunExecutionUpdateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });

    const progressMutation = await ingest.execute({
      runId: selected.run.runId,
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: selected.run.runId,
        senderNodeId: "node:trusted-1",
        senderBackendKind: "remote-dispatch",
        senderBackendRunId: "backend-run:1",
        heartbeatAt: "2026-04-07T12:01:00.000Z",
        progress: Object.freeze({
          updatedAt: "2026-04-07T12:01:00.000Z",
          percent: 75,
          stage: "render",
        }),
      }),
    });
    expect(progressMutation.status.state).toBe("running");
    expect(progressMutation.status.execution?.progress?.percent).toBe(75);

    const completionMutation = await ingest.execute({
      runId: selected.run.runId,
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: selected.run.runId,
        senderNodeId: "node:trusted-1",
        senderBackendKind: "remote-dispatch",
        senderBackendRunId: "backend-run:1",
        occurredAt: "2026-04-07T12:02:00.000Z",
        toState: "completed",
        execution: Object.freeze({
          outcome: "succeeded",
          finishedAt: "2026-04-07T12:02:00.000Z",
        }),
        result: Object.freeze({
          summary: "Generated one output.",
          externalResultId: "result:1",
          outputs: Object.freeze([Object.freeze({
            outputId: "output:1",
            kind: "asset",
            assetId: "asset:1",
          })]),
        }),
      }),
    });

    expect(completionMutation.status.state).toBe("completed");
    expect(completionMutation.status.finalization?.outputs[0]?.assetId).toBe("asset:1");

    const statusResponse = await queryApi.getRunStatus({
      runId: selected.run.runId,
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(statusResponse.ok).toBeTrue();
    const parsedStatus = parseRunStatusEnvelope(statusResponse.data);
    expect(parsedStatus.state).toBe("completed");
    expect(parsedStatus.actionAvailability?.cancel.allowed).toBeFalse();

    const listResponse = await queryApi.listRuns({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace-alpha",
      },
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    expect(listResponse.ok).toBeTrue();
    const parsedList = parseRunListReadResponse(listResponse.data);
    expect(parsedList.totalCount).toBe(1);
    expect(parsedList.items[0]?.state).toBe("completed");

    const cancel = new RequestAuthoritativeRunCancellationUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-07T12:03:00.000Z"),
    });
    const cancellation = await cancel.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:owner",
      request: Object.freeze({ runId: selected.run.runId }),
    });
    expect(cancellation.outcome).toBe(RunCancellationOutcomes.alreadyFinalized);
    expect(cancellation.mutation.mutation.changed).toBeFalse();

    const validateStub = createValidateStub();
    const createStub = createNoOpCreateStub();
    const retry = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validateStub as never,
      createAuthoritativeRunUseCase: createStub as never,
      now: () => new Date("2026-04-07T12:03:00.000Z"),
      idGenerator,
    });

    await expect(retry.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:owner",
      request: Object.freeze({ runId: selected.run.runId }),
    })).rejects.toBeInstanceOf(RunRetryIneligibleError);
    expect(validateStub.calls).toBe(0);
    expect(createStub.calls).toBe(0);
  });

  it("recovers stale assigned runs back into queue-ready state", async () => {
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

    const command = Object.freeze({
      ...buildCanonicalSubmissionCommand(),
      submissionContext: Object.freeze({
        submittedByActorId: "user:owner",
        correlationId: "corr-recovery",
        idempotencyKey: "run-recovery-source",
      }),
      occurredAt: "2026-04-07T10:00:00.000Z",
    });
    const created = await createRun.execute({ command });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T10:00:10.000Z"),
    });
    const selection = await selectReady.execute({
      reservationOwner: "orchestrator:startup",
      limit: 1,
    });

    const claim = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
    });
    await claim.execute({
      runId: created.run.runId,
      nodeId: "node:trusted-1",
      reservationOwner: "orchestrator:startup",
      claimToken: selection.items[0]!.queue.claimToken,
      preparedAt: "2026-04-07T10:00:20.000Z",
    });

    const assignedEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(assignedEntry?.lifecycleState).toBe("assigned");

    const recover = new RecoverRunOrchestrationStartupStateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-07T10:20:00.000Z"),
    });
    const recovered = await recover.execute({
      asOf: "2026-04-07T10:20:00.000Z",
      staleAssignedSeconds: 60,
    });

    expect(recovered.actions.some((entry) => entry.kind === RunOrchestrationRecoveryActionKinds.staleAssignmentRequeued)).toBeTrue();
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("queued");
    expect(queueEntry?.assignmentNodeId).toBeUndefined();
  });
});

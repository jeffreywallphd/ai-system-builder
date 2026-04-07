import { describe, expect, it } from "bun:test";
import type {
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { IPlatformTransactionManager } from "@application/common/ports/PlatformTransactionPorts";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
  IRunOrchestrationIntentRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { CanonicalRunSubmissionCommand } from "../use-cases/RunSubmissionValidationContracts";
import { CreateAuthoritativeRunUseCase } from "../use-cases/CreateAuthoritativeRunUseCase";
import { GetAuthoritativeRunUseCase } from "../use-cases/GetAuthoritativeRunUseCase";
import {
  RunSubmissionAuditEventTypes,
  type RunSubmissionAuditEvent,
  type RunSubmissionAuditSink,
} from "../use-cases/RunSubmissionAudit";

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
    if (this.runs.has(record.runId)) {
      throw new Error("duplicate run");
    }
    const persisted = Object.freeze({
      ...record,
      revision: 1,
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
    _mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: Math.max(1, record.revision + 1),
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }
}

class InMemoryAuditRepository implements IRunOrchestrationIntentRepository {
  public readonly events = new Map<string, PlatformAuditEventRecord>();

  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.set(event.eventId, event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }

  public async listAuditEvents(_query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return Object.freeze([...this.events.values()]);
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
    const persisted: AuthoritativeRunQueueEntryRecord = Object.freeze({
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
    return Object.freeze([...this.entries.values()]);
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
  }): Promise<AuthoritativeRunNodeClaimResult> {
    throw new Error("Not implemented.");
  }

  public async listDispatchAttemptsByRunId(_runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze([]);
  }
}

class SpyTransactionManager implements IPlatformTransactionManager {
  public calls = 0;

  public async runInTransaction<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    this.calls += 1;
    return operation();
  }
}

class InMemoryRunSubmissionAuditSink implements RunSubmissionAuditSink {
  public readonly events: RunSubmissionAuditEvent[] = [];

  public async recordRunSubmissionEvent(event: RunSubmissionAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function createCommand(): CanonicalRunSubmissionCommand {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:alpha",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow-alpha",
    source: "api",
    runtimeTarget: Object.freeze({
      systemId: "system-alpha",
      versionId: "system-alpha:v1",
      async: true,
    }),
    tags: Object.freeze(["queue:critical"]),
    metadata: Object.freeze({ requestedBy: "integration-test" }),
    parameters: Object.freeze({ seed: 7, steps: 20 }),
    storageReferences: Object.freeze([
      Object.freeze({
        storageInstanceId: "storage-alpha",
      }),
    ]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: "user:alpha",
      clientRequestId: "req-123",
      correlationId: "corr-123",
      idempotencyKey: "idem-123",
    }),
    occurredAt: "2026-04-07T15:00:00.000Z",
  });
}

describe("CreateAuthoritativeRunUseCase", () => {
  it("persists accepted runs with canonical metadata and supports authoritative reads", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const auditRepository = new InMemoryAuditRepository();
    const runSubmissionAuditSink = new InMemoryRunSubmissionAuditSink();
    const useCase = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: auditRepository,
      auditSink: runSubmissionAuditSink,
      idGenerator: {
        nextId: (prefix) => `${prefix}:test`,
      },
    });

    const result = await useCase.execute({
      command: createCommand(),
    });

    expect(result.run.runId).toBe("run:idem-123");
    expect(result.run.state).toBe("queued");
    expect(result.persistedRunRevision).toBe(1);
    expect(result.orchestrationIntentEventId).toBe("audit:test");
    expect(runSubmissionAuditSink.events.map((event) => event.type)).toEqual([
      RunSubmissionAuditEventTypes.submissionAccepted,
      RunSubmissionAuditEventTypes.lifecycleTransitioned,
    ]);
    expect(runSubmissionAuditSink.events[0]?.runId).toBe("run:idem-123");
    expect(runSubmissionAuditSink.events[0]?.workspaceId).toBe("workspace-alpha");
    expect((runSubmissionAuditSink.events[0]?.details as { parameterCount?: number } | undefined)?.parameterCount).toBe(2);
    expect((runSubmissionAuditSink.events[0]?.details as Record<string, unknown> | undefined)?.parameters).toBeUndefined();
    expect((runSubmissionAuditSink.events[1]?.details as { fromState?: string; toState?: string } | undefined)?.fromState)
      .toBe("none");
    expect((runSubmissionAuditSink.events[1]?.details as { fromState?: string; toState?: string } | undefined)?.toState)
      .toBe("queued");

    const persisted = await runRepository.findRunById("run:idem-123");
    expect(persisted).toBeDefined();
    expect(persisted?.status).toBe("pending");
    expect(persisted?.workspaceId).toBe("workspace-alpha");
    expect((persisted?.metadata as { orchestration?: { intent?: { queueId?: string } } })?.orchestration?.intent?.queueId)
      .toBe("queue:critical");
    expect((persisted?.metadata as { canonicalRun?: { queue?: { queueId?: string } } })?.canonicalRun?.queue?.queueId)
      .toBe("queue:critical");
    expect((persisted?.metadata as { submissionSnapshot?: { parameters?: Record<string, unknown> } })?.submissionSnapshot?.parameters?.seed)
      .toBe(7);

    const readUseCase = new GetAuthoritativeRunUseCase(runRepository);
    const loaded = await readUseCase.execute({
      runId: "run:idem-123",
      workspaceId: "workspace-alpha",
    });
    expect(loaded).toBeDefined();
    expect(loaded?.state).toBe("queued");
    expect(loaded?.executionOutcome).toBe("none");
    expect(await queueRepository.getQueueEntryByRunId("run:idem-123")).toBeDefined();
  });

  it("executes run creation inside the transaction boundary when a manager is configured", async () => {
    const transactionManager = new SpyTransactionManager();
    const useCase = new CreateAuthoritativeRunUseCase({
      runRepository: new InMemoryRunRepository(),
      queueRepository: new InMemoryQueueRepository(),
      orchestrationIntentRepository: new InMemoryAuditRepository(),
      transactionManager,
      idGenerator: {
        nextId: (prefix) => `${prefix}:tx`,
      },
    });

    await useCase.execute({
      command: createCommand(),
    });

    expect(transactionManager.calls).toBe(1);
  });

  it("keeps run creation successful when run-submission audit dispatch fails", async () => {
    const runRepository = new InMemoryRunRepository();
    const useCase = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository: new InMemoryQueueRepository(),
      orchestrationIntentRepository: new InMemoryAuditRepository(),
      auditSink: {
        async recordRunSubmissionEvent(): Promise<void> {
          throw new Error("audit unavailable");
        },
      },
      idGenerator: {
        nextId: (prefix) => `${prefix}:audit-failure`,
      },
    });

    const result = await useCase.execute({
      command: createCommand(),
    });

    expect(result.run.runId).toBe("run:idem-123");
    expect(await runRepository.findRunById("run:idem-123")).toBeDefined();
  });
});

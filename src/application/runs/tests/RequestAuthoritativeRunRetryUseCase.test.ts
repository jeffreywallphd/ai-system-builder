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
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import {
  mapLifecycleStateToPlatformRunStatus,
  type RunAuthoritativeMetadata,
} from "../use-cases/RunCreationPersistenceMapper";
import {
  RequestAuthoritativeRunRetryUseCase,
  RunRetryIneligibleError,
  RunRetrySubmissionValidationError,
} from "../use-cases/RequestAuthoritativeRunRetryUseCase";
import type { ValidateRunSubmissionUseCase } from "../use-cases/ValidateRunSubmissionUseCase";
import type { CreateAuthoritativeRunUseCase } from "../use-cases/CreateAuthoritativeRunUseCase";
import type { ValidateRunSubmissionResult } from "../use-cases/RunSubmissionValidationContracts";
import type { CreateAuthoritativeRunResult } from "../use-cases/CreateAuthoritativeRunUseCase";

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
    return Object.freeze({ changed: true, wasReplay: false, record });
  }

  public async saveRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    this.runs.set(record.runId, record);
    return Object.freeze({ changed: true, wasReplay: false, record });
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

class StubValidateRunSubmissionUseCase {
  public calls: ReadonlyArray<Readonly<Record<string, unknown>>> = [];
  public nextResult: ValidateRunSubmissionResult = Object.freeze({
    ok: true as const,
    command: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user:ops",
        activeWorkspaceId: "workspace-alpha",
      }),
      workspaceId: "workspace-alpha",
      workflowId: "workflow:demo",
      source: "ui-rerun",
      runtimeTarget: Object.freeze({
        systemId: "system:demo",
        versionId: "version:demo",
        async: true,
      }),
      tags: Object.freeze(["quality:high"]),
      metadata: Object.freeze({ retry: Object.freeze({ previousRunId: "run:source" }) }),
      parameters: Object.freeze({ seed: 42 }),
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze([]),
      submissionContext: Object.freeze({
        submittedByActorId: "user:ops",
      }),
      occurredAt: "2026-04-07T12:11:00.000Z",
    }),
  });

  public async execute(request: Readonly<Record<string, unknown>>): Promise<ValidateRunSubmissionResult> {
    this.calls = Object.freeze([...this.calls, request]);
    return this.nextResult;
  }
}

class StubCreateAuthoritativeRunUseCase {
  public calls: ReadonlyArray<Readonly<Record<string, unknown>>> = [];
  public nextResult: CreateAuthoritativeRunResult = Object.freeze({
    run: Object.freeze({
      contractVersion: "run-orchestration-transport/v1",
      runId: "run:retry-1",
      workflowId: "workflow:demo",
      workspaceId: "workspace-alpha",
      source: "ui-rerun",
      state: "queued",
      assignmentStatus: "unassigned",
      executionOutcome: "none",
      submittedAt: "2026-04-07T12:11:00.000Z",
      updatedAt: "2026-04-07T12:11:00.000Z",
      submission: Object.freeze({
        submittedByActorId: "user:ops",
      }),
      assignment: Object.freeze({
        status: "unassigned",
      }),
      execution: Object.freeze({
        outcome: "none",
      }),
      retry: Object.freeze({
        attempt: 2,
        maxAttempts: 3,
        previousRunId: "run:source",
        retryReason: "operator retry",
        queuedAt: "2026-04-07T12:11:00.000Z",
      }),
    }),
    persistedRunRevision: 2,
    orchestrationIntentEventId: "audit:retry:1",
  });

  public async execute(request: Readonly<Record<string, unknown>>): Promise<CreateAuthoritativeRunResult> {
    this.calls = Object.freeze([...this.calls, request]);
    return this.nextResult;
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
  readonly runId: string;
  readonly state: RunLifecycleState;
  readonly includeSnapshot?: boolean;
}): void {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: params.runId,
      workflowId: "workflow:demo",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T12:00:00.000Z",
      submittedByActorId: "user:owner",
    },
    state: params.state,
    queue: params.state === RunLifecycleStates.failed || params.state === RunLifecycleStates.cancelled
      ? {
        queueId: "queue:default",
        enteredAt: "2026-04-07T12:00:00.000Z",
        position: null,
        positionAsOf: "2026-04-07T12:03:00.000Z",
        dequeuedAt: "2026-04-07T12:03:00.000Z",
      }
      : undefined,
    assignment: {
      status: "unassigned",
    },
    execution: {
      outcome: params.state === RunLifecycleStates.failed
        ? RunExecutionOutcomeKinds.failed
        : params.state === RunLifecycleStates.cancelled
          ? RunExecutionOutcomeKinds.cancelled
          : RunExecutionOutcomeKinds.none,
      startedAt: params.state === RunLifecycleStates.failed || params.state === RunLifecycleStates.cancelled
        ? "2026-04-07T12:02:00.000Z"
        : undefined,
      finishedAt: params.state === RunLifecycleStates.failed || params.state === RunLifecycleStates.cancelled
        ? "2026-04-07T12:03:00.000Z"
        : undefined,
      errorCode: params.state === RunLifecycleStates.failed ? "runtime-failure" : undefined,
      errorMessage: params.state === RunLifecycleStates.failed ? "failed" : undefined,
    },
    cancellation: params.state === RunLifecycleStates.cancelled
      ? {
        requestedAt: "2026-04-07T12:03:00.000Z",
        requestedByActorId: "user:owner",
        acknowledgedAt: "2026-04-07T12:03:00.000Z",
      }
      : undefined,
    retry: {
      attempt: 1,
      maxAttempts: 3,
    },
    updatedAt: "2026-04-07T12:03:00.000Z",
  });

  const metadata: RunAuthoritativeMetadata | Record<string, unknown> = params.includeSnapshot === false
    ? Object.freeze({
      canonicalRun,
    })
    : Object.freeze({
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
        tags: Object.freeze(["quality:high"]),
        parameters: Object.freeze({ seed: 42 }),
        metadata: Object.freeze({ mode: "baseline" }),
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
          recordedAt: "2026-04-07T12:00:00.000Z",
        }),
      }),
    });

  params.runRepository.runs.set(params.runId, Object.freeze({
    runId: params.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(params.state),
    workspaceId: "workspace-alpha",
    userIdentityId: "user:owner",
    sourceAggregateRef: "workflow:demo",
    initiatedAt: "2026-04-07T12:00:00.000Z",
    metadata,
    revision: 1,
  }));
}

describe("RequestAuthoritativeRunRetryUseCase", () => {
  it("retries failed runs through validation and authoritative creation with lineage", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    seedRun({
      runRepository,
      runId: "run:source",
      state: RunLifecycleStates.failed,
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
      now: () => new Date("2026-04-07T12:11:00.000Z"),
      idGenerator: {
        nextId: (prefix) => `${prefix}:retry-test`,
      },
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:source",
        reason: "operator retry",
        requestedAt: "2026-04-07T12:11:00.000Z",
      }),
    });

    expect(result.mutation.action).toBe("retry");
    expect(result.sourceRunId).toBe("run:source");
    expect(result.retriedRunId).toBe("run:retry-1");
    expect(validate.calls).toHaveLength(1);
    expect(create.calls).toHaveLength(1);
    expect(result.mutation.run.retry.previousRunId).toBe("run:source");
    expect(result.mutation.run.retry.attempt).toBe(2);
    expect(intentRepository.events).toHaveLength(1);
    expect(intentRepository.events[0]?.action).toBe("run.retry.requested");
  });

  it("emits authoritative run retry events when centralized recorder is configured", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    const authoritativeAuditRecorder = new CapturingAuthoritativeRunAuditRecorder();
    seedRun({
      runRepository,
      runId: "run:source",
      state: RunLifecycleStates.failed,
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
      authoritativeAuditRecorder,
      now: () => new Date("2026-04-07T12:11:00.000Z"),
    });

    await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:source",
        requestedAt: "2026-04-07T12:11:00.000Z",
      }),
    });

    expect(authoritativeAuditRecorder.events).toHaveLength(1);
    expect(authoritativeAuditRecorder.events[0]?.action).toBe("run.retry.requested");
    expect(authoritativeAuditRecorder.events[0]?.protectedResource?.resourceRef).toBe("run:source");
  });

  it("treats cancelled runs as retry-eligible", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    seedRun({
      runRepository,
      runId: "run:cancelled",
      state: RunLifecycleStates.cancelled,
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
      now: () => new Date("2026-04-07T12:11:00.000Z"),
    });

    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:cancelled",
      }),
    });

    expect(result.mutation.action).toBe("retry");
    expect(result.mutation.run.state).toBe("queued");
  });

  it("fails retry requests for ineligible lifecycle states", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    seedRun({
      runRepository,
      runId: "run:completed",
      state: RunLifecycleStates.completed,
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
    });

    await expect(useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:completed",
      }),
    })).rejects.toBeInstanceOf(RunRetryIneligibleError);
    expect(validate.calls).toHaveLength(0);
    expect(create.calls).toHaveLength(0);
  });

  it("fails retry when authoritative submission snapshot metadata is unavailable", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    seedRun({
      runRepository,
      runId: "run:failed-no-snapshot",
      state: RunLifecycleStates.failed,
      includeSnapshot: false,
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
    });

    await expect(useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:failed-no-snapshot",
      }),
    })).rejects.toBeInstanceOf(RunRetryIneligibleError);
  });

  it("surfaces submission validation denials with explicit retry semantics", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryIntentRepository();
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    seedRun({
      runRepository,
      runId: "run:failed-denied",
      state: RunLifecycleStates.failed,
    });

    validate.nextResult = Object.freeze({
      ok: false as const,
      error: Object.freeze({
        code: "policy-ineligible",
        message: "Run submission is policy-ineligible.",
        validationIssues: Object.freeze([]),
      }),
    });

    const useCase = new RequestAuthoritativeRunRetryUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      validateRunSubmissionUseCase: validate as unknown as ValidateRunSubmissionUseCase,
      createAuthoritativeRunUseCase: create as unknown as CreateAuthoritativeRunUseCase,
    });

    await expect(useCase.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:ops",
      request: Object.freeze({
        runId: "run:failed-denied",
      }),
    })).rejects.toBeInstanceOf(RunRetrySubmissionValidationError);
    expect(create.calls).toHaveLength(0);
  });
});

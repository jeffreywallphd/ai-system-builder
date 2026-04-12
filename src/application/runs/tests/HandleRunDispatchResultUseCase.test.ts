import { describe, expect, it } from "bun:test";
import type { AuthoritativeAuditRecordEventInput } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type {
  PlatformAuditEventListQuery,
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
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  type RunLifecycleState,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import {
  DispatchOutcomeQueueActions,
  HandleRunDispatchResultUseCase,
  createDispatchAcceptedOutcome,
  createDispatchFailureOutcome,
} from "../use-cases/HandleRunDispatchResultUseCase";

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
  public readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();

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

  public async requeueAssignedRunForRecovery(input: {
    readonly runId: string;
    readonly requeuedAt: string;
    readonly eligibilityMarker?: "ready" | "deferred" | "blocked";
  }): Promise<boolean> {
    const entry = this.queue.get(input.runId);
    if (!entry || entry.lifecycleState !== "assigned") {
      return false;
    }
    this.queue.set(input.runId, Object.freeze({
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

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const attempt = this.attempts.get(input.attemptId);
    if (!attempt || attempt.runId !== input.runId) {
      return false;
    }
    this.attempts.set(input.attemptId, Object.freeze({
      ...attempt,
      dispatchResult: input.result,
    }));
    return true;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const entry = this.queue.get(input.runId);
    if (!entry) {
      return false;
    }
    this.queue.set(input.runId, Object.freeze({
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
    return Object.freeze([...this.attempts.values()].filter((attempt) => attempt.runId === runId));
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

const command = Object.freeze({
  commandId: "run-execution-command:dispatch-attempt:1",
  dispatchAttemptId: "dispatch-attempt:1",
  preparedAt: "2026-04-07T09:02:00.000Z",
  run: Object.freeze({
    runId: "run-1",
    workflowId: "workflow:test",
    workspaceId: "workspace-alpha",
    submittedAt: "2026-04-07T09:00:00.000Z",
    source: "api" as const,
    correlationId: "corr-alpha",
  }),
  queue: Object.freeze({
    queueId: "queue:default",
  }),
  assignment: Object.freeze({
    nodeId: "node:trusted-a",
    reservationOwner: "orchestrator:alpha",
    claimToken: "claim:run-1",
  }),
  runtimeTarget: Object.freeze({
    systemId: "system:test",
    versionId: "runtime:v1",
    async: true,
  }),
  backend: Object.freeze({
    kind: RunExecutionBackendKinds.remoteDispatch,
  }),
  inputs: Object.freeze({
    tags: Object.freeze([]),
    parameters: Object.freeze({}),
  }),
  references: Object.freeze({
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
  }),
});

function seedAssignedRun(runRepository: InMemoryRunRepository): void {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: "run-1",
      workflowId: "workflow:test",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      correlationId: "corr-alpha",
    },
    state: RunLifecycleStates.assigned,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T09:02:00.000Z",
      dequeuedAt: "2026-04-07T09:02:00.000Z",
    }),
    assignment: Object.freeze({
      status: "assigned",
      assignedNodeId: "node:trusted-a",
      assignedAt: "2026-04-07T09:02:00.000Z",
    }),
    execution: Object.freeze({
      outcome: RunExecutionOutcomeKinds.none,
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 2,
    }),
    updatedAt: "2026-04-07T09:02:00.000Z",
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
        recordedAt: "2026-04-07T09:00:00.000Z",
      }),
    }),
  });

  runRepository.runs.set("run-1", Object.freeze({
    runId: "run-1",
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.assigned),
    workspaceId: "workspace-alpha",
    userIdentityId: "user-owner",
    sourceAggregateRef: "workflow:test",
    initiatedAt: "2026-04-07T09:00:00.000Z",
    metadata,
    revision: 1,
  }));
}

function seedDispatchAttempt(queueRepository: InMemoryQueueRepository): void {
  queueRepository.queue.set("run-1", Object.freeze({
    runId: "run-1",
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    lifecycleState: "assigned",
    enteredAt: "2026-04-07T09:00:00.000Z",
    orderKey: "2026-04-07T09:00:00.000Z:run-1",
    eligibilityMarker: "ready",
    eligibleAt: "2026-04-07T09:00:00.000Z",
    claimToken: "claim:run-1",
    claimedBy: "orchestrator:alpha",
    claimedAt: "2026-04-07T09:02:00.000Z",
    claimExpiresAt: "2026-04-07T09:07:00.000Z",
    assignmentNodeId: "node:trusted-a",
    assignmentClaimedAt: "2026-04-07T09:02:00.000Z",
    dispatchPreparedAt: "2026-04-07T09:02:00.000Z",
    lastDispatchAttemptId: "dispatch-attempt:1",
    dequeuedAt: "2026-04-07T09:02:00.000Z",
    updatedAt: "2026-04-07T09:02:00.000Z",
    revision: 1,
  }));
  queueRepository.attempts.set("dispatch-attempt:1", Object.freeze({
    attemptId: "dispatch-attempt:1",
    runId: "run-1",
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    nodeId: "node:trusted-a",
    reservationOwner: "orchestrator:alpha",
    claimToken: "claim:run-1",
    preparedAt: "2026-04-07T09:02:00.000Z",
    dispatchMetadata: Object.freeze({
      runId: "run-1",
    }),
  }));
}

describe("HandleRunDispatchResultUseCase", () => {
  it("transitions run to running and records accepted dispatch attempt outcomes", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const auditRepository = new InMemoryAuditRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);

    const authoritativeAuditRecorder = new CapturingAuthoritativeRunAuditRecorder();
    const useCase = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: auditRepository,
      authoritativeAuditRecorder,
      idGenerator: {
        nextId: (prefix) => `${prefix}:${auditRepository.events.size + 1}`,
      },
    });

    const result = await useCase.execute({
      command,
      dispatchStartedAt: "2026-04-07T09:03:00.000Z",
      outcome: createDispatchAcceptedOutcome(Object.freeze({
        dispatchId: "dispatch:1",
        backendKind: RunExecutionBackendKinds.remoteDispatch,
        acceptedAt: "2026-04-07T09:03:10.000Z",
        status: "accepted",
        backendRunId: "backend-run-1",
      })),
    });

    expect(result.run.state).toBe("running");
    expect(result.queueAction).toBe(DispatchOutcomeQueueActions.runningReservationReleased);
    expect(result.run.execution.startedAt).toBe("2026-04-07T09:03:10.000Z");
    expect(result.run.execution.adapterRunId).toBe("backend-run-1");
    expect(result.dispatchAttemptResult.status).toBe("accepted");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.status).toBe("accepted");
    expect(queueRepository.queue.get("run-1")?.lifecycleState).toBe("running");
    expect(queueRepository.queue.get("run-1")?.claimToken).toBeUndefined();
    expect([...auditRepository.events.values()].length).toBe(3);
    expect(authoritativeAuditRecorder.events.map((entry) => entry.action)).toContain("run.dispatch.initiated");
    expect(authoritativeAuditRecorder.events.map((entry) => entry.action)).toContain("run.lifecycle.transitioned");
  });

  it("transitions run to failed for dispatch failures and stores user-safe/internal failure reasons", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const auditRepository = new InMemoryAuditRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);

    const useCase = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: auditRepository,
      idGenerator: {
        nextId: (prefix) => `${prefix}:${auditRepository.events.size + 1}`,
      },
    });

    const result = await useCase.execute({
      command,
      dispatchStartedAt: "2026-04-07T09:03:00.000Z",
      outcome: createDispatchFailureOutcome({
        failedAt: "2026-04-07T09:03:20.000Z",
        error: Object.freeze({
          code: "backend-unavailable",
          message: "Socket connection timeout.",
          retryable: false,
        }),
      }),
    });

    expect(result.run.state).toBe("failed");
    expect(result.queueAction).toBe(DispatchOutcomeQueueActions.terminalFinalized);
    expect(result.run.assignment.status).toBe("released");
    expect(result.run.execution.errorCode).toBe("dispatch-timeout");
    expect(result.run.execution.errorMessage).toContain("took too long");
    expect(result.run.finalization?.outcome).toBe("failed");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.status).toBe("failed-to-start");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.failure?.internalMessage)
      .toContain("Socket connection timeout");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.failure?.details?.recovery)
      .toBeDefined();
    expect(queueRepository.queue.get("run-1")?.lifecycleState).toBe("failed");
    expect(queueRepository.queue.get("run-1")?.claimToken).toBeUndefined();
    expect([...auditRepository.events.values()].length).toBe(3);
  });

  it("requeues retryable failed-to-start dispatch outcomes when retry budget remains", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const auditRepository = new InMemoryAuditRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);

    const useCase = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: auditRepository,
      idGenerator: {
        nextId: (prefix) => `${prefix}:${auditRepository.events.size + 1}`,
      },
    });

    const result = await useCase.execute({
      command,
      dispatchStartedAt: "2026-04-07T09:03:00.000Z",
      outcome: createDispatchFailureOutcome({
        failedAt: "2026-04-07T09:03:20.000Z",
        error: Object.freeze({
          code: "backend-unavailable",
          message: "Socket connection timeout.",
          retryable: true,
        }),
      }),
    });

    expect(result.run.state).toBe("queued");
    expect(result.queueAction).toBe(DispatchOutcomeQueueActions.failedStartRequeued);
    expect(result.run.assignment.status).toBe("unassigned");
    expect(result.run.execution.outcome).toBe("none");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.status).toBe("failed-to-start");
    expect(queueRepository.attempts.get("dispatch-attempt:1")?.dispatchResult?.failure?.details?.recovery)
      .toBeDefined();
    expect(queueRepository.queue.get("run-1")?.lifecycleState).toBe("queued");
    expect(queueRepository.queue.get("run-1")?.assignmentNodeId).toBeUndefined();
    expect(queueRepository.queue.get("run-1")?.claimToken).toBeUndefined();
    expect([...auditRepository.events.values()].length).toBe(3);
  });

  it("does not auto-requeue when retry policy indicates manual retry only", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const auditRepository = new InMemoryAuditRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);

    const useCase = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: auditRepository,
      idGenerator: {
        nextId: (prefix) => `${prefix}:${auditRepository.events.size + 1}`,
      },
    });

    const result = await useCase.execute({
      command,
      dispatchStartedAt: "2026-04-07T09:03:00.000Z",
      outcome: createDispatchFailureOutcome({
        failedAt: "2026-04-07T09:03:20.000Z",
        error: Object.freeze({
          code: "backend-transient",
          message: "Backend transient failure requiring manual intervention.",
          retryable: true,
          failure: Object.freeze({
            code: "dispatch-execution-failed",
            summary: "Dispatch failed.",
            userMessage: "Dispatch failed.",
            retryable: true,
            recovery: Object.freeze({
              retry: Object.freeze({
                retryEligible: true,
                retrySafe: true,
                retryMode: "manual",
              }),
              recoveryAction: Object.freeze({
                kind: "retry-manual",
                userActionRequired: false,
                backendRecoveryPending: false,
                terminalNotRetryable: false,
                summary: "Manual retry is required.",
              }),
              escalation: Object.freeze({
                category: "operator",
                required: true,
              }),
            }),
          }),
        }),
      }),
    });

    expect(result.run.state).toBe("failed");
    expect(result.queueAction).toBe(DispatchOutcomeQueueActions.terminalFinalized);
  });
});

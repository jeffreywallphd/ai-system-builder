import { describe, expect, it } from "bun:test";
import { RunExecutionBackendKinds, type CanonicalRunExecutionCommand } from "@application/runs/ports/RunExecutionDispatchPorts";
import type {
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
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import {
  DispatchAssignedRunExecutionUseCase,
  RunDispatchGuardError,
  RunDispatchGuardErrorCodes,
} from "../use-cases/DispatchAssignedRunExecutionUseCase";

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
    mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    const current = this.runs.get(record.runId);
    if (!current) {
      throw new Error(`Run '${record.runId}' was not found.`);
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
  public readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();

  public async getQueueEntryByRunId(_runId: string): Promise<undefined> {
    return undefined;
  }

  public async enqueueRunForAssignment(
    _record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    throw new Error("Not implemented.");
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

  public async finalizeRunQueueEntry(_input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    return false;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.attempts.values()].filter((entry) => entry.runId === runId),
    );
  }
}

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
      initialLifecycleState: RunLifecycleStates.queued,
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

function seedDispatchAttempt(queueRepository: InMemoryQueueRepository, withResult = false): void {
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
    dispatchResult: withResult
      ? Object.freeze({
        status: "accepted",
        recordedAt: "2026-04-07T09:03:00.000Z",
        acceptedAt: "2026-04-07T09:03:00.000Z",
        dispatchId: "dispatch:run-1",
        backendKind: "remote-dispatch",
      })
      : undefined,
  }));
}

describe("DispatchAssignedRunExecutionUseCase", () => {
  it("dispatches through the execution dispatch port using canonical command output", async () => {
    const command: CanonicalRunExecutionCommand = Object.freeze({
      commandId: "run-execution-command:dispatch-attempt:1",
      dispatchAttemptId: "dispatch-attempt:1",
      preparedAt: "2026-04-07T09:02:00.000Z",
      run: Object.freeze({
        runId: "run-1",
        workflowId: "workflow:test",
        workspaceId: "workspace-alpha",
        submittedAt: "2026-04-07T09:00:00.000Z",
        source: "api",
        submittedByActorId: "user-owner",
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
        tags: Object.freeze(["priority:normal"]),
        parameters: Object.freeze({ seed: 7 }),
      }),
      references: Object.freeze({
        storageReferences: Object.freeze([]),
        resourceReferences: Object.freeze([]),
        policyPrerequisites: Object.freeze([]),
      }),
    });

    const dispatchedCommands: CanonicalRunExecutionCommand[] = [];
    const handledOutcomes: string[] = [];
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);
    const useCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async (nextCommand) => {
          dispatchedCommands.push(nextCommand);
          return Object.freeze({
            dispatchId: `dispatch:${nextCommand.dispatchAttemptId}`,
            backendKind: nextCommand.backend.kind,
            acceptedAt: "2026-04-07T09:03:00.000Z",
            status: "accepted",
            backendRunId: "remote-run-1",
          });
        },
      },
      dispatchResultHandler: {
        execute: async (input) => {
          handledOutcomes.push(input.outcome.status);
        },
      },
      runRepository,
      queueRepository,
    });

    const result = await useCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    });

    expect(dispatchedCommands).toHaveLength(1);
    expect(dispatchedCommands[0]).toBe(command);
    expect(result.command).toBe(command);
    expect(result.receipt.backendKind).toBe(RunExecutionBackendKinds.remoteDispatch);
    expect(result.receipt.backendRunId).toBe("remote-run-1");
    expect(handledOutcomes).toEqual(["accepted"]);
    expect(runRepository.runs.get("run-1")?.status).toBe("dispatching");
  });

  it("records failed-to-start dispatch outcomes before rethrowing backend dispatch errors", async () => {
    const command: CanonicalRunExecutionCommand = Object.freeze({
      commandId: "run-execution-command:dispatch-attempt:2",
      dispatchAttemptId: "dispatch-attempt:2",
      preparedAt: "2026-04-07T09:12:00.000Z",
      run: Object.freeze({
        runId: "run-2",
        workflowId: "workflow:test",
        workspaceId: "workspace-alpha",
        submittedAt: "2026-04-07T09:10:00.000Z",
        source: "api",
      }),
      queue: Object.freeze({
        queueId: "queue:default",
      }),
      assignment: Object.freeze({
        nodeId: "node:trusted-a",
        reservationOwner: "orchestrator:alpha",
        claimToken: "claim:run-2",
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

    const handledOutcomes: string[] = [];
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);
    const useCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async () => {
          throw new Error("backend unavailable");
        },
      },
      dispatchResultHandler: {
        execute: async (input) => {
          handledOutcomes.push(input.outcome.status);
        },
      },
      now: () => new Date("2026-04-07T09:12:10.000Z"),
      runRepository,
      queueRepository,
    });

    await expect(useCase.execute({
      runId: "run-2",
      dispatchAttemptId: "dispatch-attempt:2",
    })).rejects.toThrow("backend unavailable");

    expect(handledOutcomes).toEqual(["failed-to-start"]);
  });

  it("blocks duplicate dispatch when run is already transitioned out of assigned state", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository);

    const firstUseCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:run-1",
          backendKind: RunExecutionBackendKinds.remoteDispatch,
          acceptedAt: "2026-04-07T09:03:00.000Z",
          status: "accepted",
          backendRunId: "remote-run-1",
        }),
      },
      dispatchResultHandler: {
        execute: async () => {
          // no-op for this guard-focused unit test
        },
      },
      runRepository,
      queueRepository,
    });

    await firstUseCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    });

    const secondUseCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async () => {
          throw new Error("should not dispatch");
        },
      },
      dispatchResultHandler: {
        execute: async () => {
          throw new Error("should not handle outcome");
        },
      },
      runRepository,
      queueRepository,
    });

    await expect(secondUseCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    })).rejects.toMatchObject({
      name: "RunDispatchGuardError",
      code: RunDispatchGuardErrorCodes.duplicateDispatchDetected,
    } satisfies Partial<RunDispatchGuardError>);
  });

  it("blocks dispatch when the attempt is already finalized", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    seedAssignedRun(runRepository);
    seedDispatchAttempt(queueRepository, true);

    const useCase = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => command,
      },
      dispatchPort: {
        dispatch: async () => {
          throw new Error("should not dispatch");
        },
      },
      dispatchResultHandler: {
        execute: async () => {
          throw new Error("should not handle outcome");
        },
      },
      runRepository,
      queueRepository,
    });

    await expect(useCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    })).rejects.toMatchObject({
      name: "RunDispatchGuardError",
      code: RunDispatchGuardErrorCodes.dispatchAttemptAlreadyFinalized,
    } satisfies Partial<RunDispatchGuardError>);
  });
});


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
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import {
  BuildAssignedRunExecutionCommandUseCase,
  RunExecutionCommandBuildError,
} from "../use-cases/BuildAssignedRunExecutionCommandUseCase";

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

  public async claimQueuedRunForNodeDispatch(_input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    throw new Error("not used");
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.dispatchAttempts.values()].filter((attempt) => attempt.runId === runId),
    );
  }
}

function createAssignedRunRecord(runId: string, runtimeSystemId: string): PlatformRunRecord {
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
    state: RunLifecycleStates.assigned,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-07T09:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T09:00:00.000Z",
      dequeuedAt: "2026-04-07T09:02:00.000Z",
    }),
    assignment: Object.freeze({
      status: "assigned",
      assignedNodeId: "node:trusted-a",
      assignedAt: "2026-04-07T09:02:00.000Z",
    }),
    execution: Object.freeze({
      outcome: "none",
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 1,
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
        systemId: runtimeSystemId,
        versionId: "runtime:v1",
        async: true,
      }),
      tags: Object.freeze(["priority:normal"]),
      parameters: Object.freeze({ seed: 7, prompt: "test" }),
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
    status: mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.assigned),
    workspaceId: "workspace-alpha",
    userIdentityId: "user-owner",
    sourceAggregateRef: "workflow:test",
    initiatedAt: "2026-04-07T09:00:00.000Z",
    metadata,
    revision: 2,
  });
}

function createQueueEntry(runId: string): AuthoritativeRunQueueEntryRecord {
  return Object.freeze({
    runId,
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    lifecycleState: "assigned",
    enteredAt: "2026-04-07T09:00:00.000Z",
    orderKey: "2026-04-07T09:00:00.000Z:run-1",
    eligibilityMarker: "ready",
    eligibleAt: "2026-04-07T09:00:00.000Z",
    claimToken: "claim:run-1",
    claimedBy: "orchestrator:alpha",
    claimedAt: "2026-04-07T09:00:01.000Z",
    claimExpiresAt: "2026-04-07T09:10:00.000Z",
    assignmentNodeId: "node:trusted-a",
    assignmentClaimedAt: "2026-04-07T09:02:00.000Z",
    dispatchPreparedAt: "2026-04-07T09:02:00.000Z",
    lastDispatchAttemptId: "dispatch-attempt:1",
    dequeuedAt: "2026-04-07T09:02:00.000Z",
    updatedAt: "2026-04-07T09:02:00.000Z",
    revision: 4,
  });
}

function createDispatchAttempt(runId: string): AuthoritativeRunDispatchAttemptRecord {
  return Object.freeze({
    attemptId: "dispatch-attempt:1",
    runId,
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    nodeId: "node:trusted-a",
    reservationOwner: "orchestrator:alpha",
    claimToken: "claim:run-1",
    preparedAt: "2026-04-07T09:02:00.000Z",
    dispatchMetadata: Object.freeze({
      runId,
    }),
  });
}

describe("BuildAssignedRunExecutionCommandUseCase", () => {
  it("builds a canonical execution command from assigned run and dispatch attempt", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    runRepository.runs.set("run-1", createAssignedRunRecord("run-1", "comfyui"));
    queueRepository.queue.set("run-1", createQueueEntry("run-1"));
    queueRepository.dispatchAttempts.set("dispatch-attempt:1", createDispatchAttempt("run-1"));

    const useCase = new BuildAssignedRunExecutionCommandUseCase({
      runRepository,
      queueRepository,
    });

    const command = await useCase.execute({
      runId: "run-1",
      dispatchAttemptId: "dispatch-attempt:1",
    });

    expect(command.commandId).toBe("run-execution-command:dispatch-attempt:1");
    expect(command.assignment.nodeId).toBe("node:trusted-a");
    expect(command.runtimeTarget.systemId).toBe("comfyui");
    expect(command.inputs.parameters.seed).toBe(7);
    expect(command.backend.kind).toBe(RunExecutionBackendKinds.comfyUi);
  });

  it("fails with a structured error when the dispatch attempt does not exist", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    runRepository.runs.set("run-1", createAssignedRunRecord("run-1", "system:remote"));
    queueRepository.queue.set("run-1", createQueueEntry("run-1"));

    const useCase = new BuildAssignedRunExecutionCommandUseCase({
      runRepository,
      queueRepository,
    });

    let thrown: unknown;
    try {
      await useCase.execute({
        runId: "run-1",
        dispatchAttemptId: "dispatch-attempt:missing",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RunExecutionCommandBuildError);
    expect((thrown as RunExecutionCommandBuildError).code).toBe("dispatch-attempt-not-found");
  });
});


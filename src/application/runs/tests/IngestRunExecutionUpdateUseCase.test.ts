import { describe, expect, it } from "bun:test";
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
  IngestRunExecutionUpdateUseCase,
  RunExecutionUpdateForbiddenError,
} from "../use-cases/IngestRunExecutionUpdateUseCase";
import {
  mapLifecycleStateToPlatformRunStatus,
  type RunAuthoritativeMetadata,
} from "../use-cases/RunCreationPersistenceMapper";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  createCanonicalRunRecord,
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

class InMemoryOrchestrationIntentRepository implements IRunOrchestrationIntentRepository {
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

function seedRun(runRepository: InMemoryRunRepository): void {
  const canonical = createCanonicalRunRecord({
    identity: {
      runId: "run:1",
      workflowId: "workflow:demo",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T12:00:00.000Z",
      submittedByActorId: "user:owner",
    },
    state: RunLifecycleStates.running,
    queue: {
      queueId: "queue:default",
      enteredAt: "2026-04-07T11:59:30.000Z",
      position: null,
      positionAsOf: "2026-04-07T12:00:00.000Z",
      dequeuedAt: "2026-04-07T12:00:00.000Z",
    },
    assignment: {
      status: RunAssignmentStatuses.assigned,
      assignedNodeId: "node:trusted-1",
      assignedAt: "2026-04-07T12:00:00.000Z",
    },
    execution: {
      adapterKind: "local-worker",
      adapterRunId: "backend-run-1",
      startedAt: "2026-04-07T12:00:00.000Z",
      heartbeatAt: "2026-04-07T12:00:15.000Z",
      outcome: RunExecutionOutcomeKinds.none,
    },
    retry: {
      attempt: 1,
      maxAttempts: 2,
    },
    updatedAt: "2026-04-07T12:00:15.000Z",
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun: canonical,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user:owner",
        activeWorkspaceId: "workspace-alpha",
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
      initialLifecycleState: "queued",
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: "2026-04-07T12:00:00.000Z",
      }),
    }),
  });

  runRepository.runs.set("run:1", Object.freeze({
    runId: "run:1",
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(canonical.state),
    workspaceId: "workspace-alpha",
    userIdentityId: "user:owner",
    sourceAggregateRef: "workflow:demo",
    initiatedAt: "2026-04-07T12:00:00.000Z",
    metadata,
    revision: 1,
  }));
}

describe("IngestRunExecutionUpdateUseCase", () => {
  it("accepts authorized node progress/heartbeat updates and persists canonical state", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryOrchestrationIntentRepository();
    seedRun(runRepository);
    const useCase = new IngestRunExecutionUpdateUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
      idGenerator: {
        nextId: (prefix) => `${prefix}:${intentRepository.events.length + 1}`,
      },
    });

    const result = await useCase.execute({
      runId: "run:1",
      senderNodeId: "node:trusted-1",
      update: Object.freeze({
        runId: "run:1",
        senderNodeId: "node:trusted-1",
        senderBackendKind: "local-worker",
        senderBackendRunId: "backend-run-1",
        heartbeatAt: "2026-04-07T12:01:00.000Z",
        progress: Object.freeze({
          updatedAt: "2026-04-07T12:01:00.000Z",
          percent: 72,
          stage: "decode",
          message: "step 29/40",
        }),
        internalDiagnostics: Object.freeze({
          workerPid: 4242,
        }),
      }),
    });

    expect(result.mutation.run.execution.heartbeatAt).toBe("2026-04-07T12:01:00.000Z");
    expect(result.mutation.run.execution.progress?.percent).toBe(72);
    expect(result.status.execution?.progress?.stage).toBe("decode");
    expect(intentRepository.events).toHaveLength(1);
  });

  it("rejects execution updates from nodes that are not assigned to the run", async () => {
    const runRepository = new InMemoryRunRepository();
    const intentRepository = new InMemoryOrchestrationIntentRepository();
    seedRun(runRepository);
    const useCase = new IngestRunExecutionUpdateUseCase({
      runRepository,
      orchestrationIntentRepository: intentRepository,
    });

    await expect(useCase.execute({
      runId: "run:1",
      senderNodeId: "node:intruder",
      update: Object.freeze({
        runId: "run:1",
        senderNodeId: "node:intruder",
        heartbeatAt: "2026-04-07T12:01:00.000Z",
      }),
    })).rejects.toThrow(RunExecutionUpdateForbiddenError);
  });
});

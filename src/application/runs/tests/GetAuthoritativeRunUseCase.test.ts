import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { IAuthoritativeRunQueryAuthorizationPort } from "@application/runs/ports/RunQueryAuthorizationPorts";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import { GetAuthoritativeRunUseCase } from "../use-cases/GetAuthoritativeRunUseCase";

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

class InMemoryRunQueryAuthorization implements IAuthoritativeRunQueryAuthorizationPort {
  public readonly deniedRunIds = new Set<string>();

  public async canReadWorkspaceRuns(_input: {
    readonly workspaceId: string;
    readonly actor: {
      readonly actorUserIdentityId: string;
      readonly activeWorkspaceId?: string;
      readonly authenticatedAt?: string;
    };
  }): Promise<boolean> {
    return true;
  }

  public async canReadRun(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly actor: {
      readonly actorUserIdentityId: string;
      readonly activeWorkspaceId?: string;
      readonly authenticatedAt?: string;
    };
  }): Promise<boolean> {
    return !this.deniedRunIds.has(input.runId);
  }
}

function createRun(input: {
  readonly runId: string;
  readonly workspaceId: string;
  readonly ownerUserIdentityId: string;
  readonly systemId: string;
  readonly state: typeof RunLifecycleStates[keyof typeof RunLifecycleStates];
}): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: input.runId,
      workflowId: "workflow:image",
      workspaceId: input.workspaceId,
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-05T10:00:00.000Z",
      submittedByActorId: input.ownerUserIdentityId,
    },
    state: input.state,
    assignment: {
      status: "unassigned",
    },
    execution: {
      outcome: input.state === RunLifecycleStates.failed ? "failed" : "none",
      errorCode: input.state === RunLifecycleStates.failed ? "dispatch-failed" : undefined,
      errorMessage: input.state === RunLifecycleStates.failed ? "Dispatch failed." : undefined,
      progress: input.state === RunLifecycleStates.running
        ? {
          updatedAt: "2026-04-05T10:01:00.000Z",
          percent: 62,
          stage: "sampler",
          message: "sampling",
        }
        : undefined,
    },
    retry: {
      attempt: 1,
      maxAttempts: 1,
    },
    updatedAt: "2026-04-05T10:01:00.000Z",
  });
  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: input.ownerUserIdentityId,
        activeWorkspaceId: input.workspaceId,
      }),
      runtimeTarget: Object.freeze({
        systemId: input.systemId,
        versionId: `${input.systemId}:v1`,
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
      initialLifecycleState: input.state,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: "2026-04-05T10:01:00.000Z",
      }),
      finalization: input.state === RunLifecycleStates.completed
        ? Object.freeze({
          finalizedAt: "2026-04-05T10:02:00.000Z",
          outcome: "completed" as const,
          outputs: Object.freeze([{
            outputId: "image:1",
            kind: "asset" as const,
            assetId: "asset:image:1",
          }]),
        })
        : undefined,
    }),
  });

  return Object.freeze({
    runId: input.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(input.state),
    workspaceId: input.workspaceId,
    userIdentityId: input.ownerUserIdentityId,
    sourceAggregateRef: "workflow:workflow:image",
    initiatedAt: "2026-04-05T10:00:00.000Z",
    metadata,
    revision: 1,
  });
}

describe("GetAuthoritativeRunUseCase", () => {
  it("returns dto-ready history hints for authorized callers", async () => {
    const repository = new InMemoryRunRepository();
    await repository.createRun(createRun({
      runId: "run:detail:1",
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user:owner",
      systemId: "system:image",
      state: RunLifecycleStates.completed,
    }), { operationKey: "seed:detail:1", actorId: "system:test" });
    const authorization = new InMemoryRunQueryAuthorization();

    const useCase = new GetAuthoritativeRunUseCase(repository, { authorization });
    const result = await useCase.execute({
      runId: "run:detail:1",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:viewer",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(result).toBeDefined();
    expect(result?.runId).toBe("run:detail:1");
    expect(result?.systemId).toBe("system:image");
    expect(result?.ownerUserIdentityId).toBe("user:owner");
    expect(result?.historyHints.normalizedStatus).toBe("succeeded");
    expect(result?.historyHints.hasFailure).toBeFalse();
    expect(result?.historyHints.hasResult).toBeTrue();
  });

  it("returns undefined when run-level read authorization is denied", async () => {
    const repository = new InMemoryRunRepository();
    await repository.createRun(createRun({
      runId: "run:detail:2",
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user:owner",
      systemId: "system:image",
      state: RunLifecycleStates.running,
    }), { operationKey: "seed:detail:2", actorId: "system:test" });
    const authorization = new InMemoryRunQueryAuthorization();
    authorization.deniedRunIds.add("run:detail:2");

    const useCase = new GetAuthoritativeRunUseCase(repository, { authorization });
    const result = await useCase.execute({
      runId: "run:detail:2",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user:viewer",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(result).toBeUndefined();
  });
});

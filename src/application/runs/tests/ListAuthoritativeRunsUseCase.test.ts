import { describe, expect, it } from "bun:test";
import type {
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "../use-cases/RunCreationPersistenceMapper";
import { ListAuthoritativeRunsUseCase } from "../use-cases/ListAuthoritativeRunsUseCase";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze(
      [...this.runs.values()].filter((entry) => !query.workspaceId || entry.workspaceId === query.workspaceId),
    );
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
}

function createRun(input: {
  readonly runId: string;
  readonly workspaceId: string;
  readonly workflowId: string;
  readonly state: typeof RunLifecycleStates[keyof typeof RunLifecycleStates];
  readonly source: typeof RunSubmissionSources[keyof typeof RunSubmissionSources];
  readonly submittedAt: string;
  readonly updatedAt: string;
}): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: input.runId,
      workflowId: input.workflowId,
      workspaceId: input.workspaceId,
    },
    submission: {
      source: input.source,
      submittedAt: input.submittedAt,
      submittedByActorId: "user-owner",
    },
    state: input.state,
    assignment: {
      status: "unassigned",
    },
    execution: {
      outcome: "none",
    },
    retry: {
      attempt: 1,
      maxAttempts: 1,
    },
    updatedAt: input.updatedAt,
  });
  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: input.workspaceId,
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
      initialLifecycleState: input.state,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: input.updatedAt,
      }),
    }),
  });
  return Object.freeze({
    runId: input.runId,
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(input.state),
    workspaceId: input.workspaceId,
    userIdentityId: "user-owner",
    sourceAggregateRef: `workflow:${input.workflowId}`,
    initiatedAt: input.submittedAt,
    metadata,
    revision: 1,
  });
}

describe("ListAuthoritativeRunsUseCase", () => {
  it("filters by state/source/search and paginates canonical summaries", async () => {
    const repository = new InMemoryRunRepository();
    await repository.createRun(createRun({
      runId: "run:alpha",
      workspaceId: "workspace-alpha",
      workflowId: "workflow:alpha",
      state: RunLifecycleStates.running,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T10:00:00.000Z",
      updatedAt: "2026-04-07T10:05:00.000Z",
    }), { operationKey: "seed:alpha", actorId: "system:test" });
    await repository.createRun(createRun({
      runId: "run:beta",
      workspaceId: "workspace-alpha",
      workflowId: "workflow:beta",
      state: RunLifecycleStates.submitted,
      source: RunSubmissionSources.uiManual,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    }), { operationKey: "seed:beta", actorId: "system:test" });
    await repository.createRun(createRun({
      runId: "run:gamma",
      workspaceId: "workspace-beta",
      workflowId: "workflow:gamma",
      state: RunLifecycleStates.running,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T08:00:00.000Z",
      updatedAt: "2026-04-07T08:05:00.000Z",
    }), { operationKey: "seed:gamma", actorId: "system:test" });

    const useCase = new ListAuthoritativeRunsUseCase(repository);
    const result = await useCase.execute({
      workspaceId: "workspace-alpha",
      states: [RunLifecycleStates.running, RunLifecycleStates.submitted],
      sources: [RunSubmissionSources.api],
      search: "workflow:alpha",
      limit: 1,
      offset: 0,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.runId).toBe("run:alpha");
  });
});


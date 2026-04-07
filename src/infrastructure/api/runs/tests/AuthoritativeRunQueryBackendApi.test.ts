import { describe, expect, it } from "bun:test";
import { AuthorizationPolicyDecisionEvaluator } from "@application/authorization/use-cases/AuthorizationPolicyDecisionEvaluator";
import type {
  AuthorizationActorRoleGrantSnapshot,
  AuthorizationActorRoleGrantSnapshotQuery,
  AuthorizationResourcePolicyMetadata,
  AuthorizationResourcePolicyMetadataListQuery,
  AuthorizationResourcePolicyMetadataLookupQuery,
  AuthorizationSharingGrantLookupQuery,
  AuthorizationSharingGrantRecord,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationRoleGrantReadRepository } from "@application/authorization/ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "@application/authorization/ports/IAuthorizationSharingGrantReadRepository";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "@application/authorization/ports/IAuthorizationResourcePolicyMetadataReadRepository";
import {
  ResourceOwnershipScopes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  SharingPolicyModes,
  SharingSubjectKinds,
  createRoleAssignment,
} from "@domain/authorization/AuthorizationDomain";
import { AuthorizationResourceFamilies } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  type IPlatformAuditEventRepository,
  PlatformRunStatuses,
  type PlatformPersistenceMutationContext,
  type PlatformAuditEventListQuery,
  type PlatformAuditEventRecord,
  type PlatformRunListQuery,
  type PlatformRunMutationResult,
  type PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import {
  mapLifecycleStateToPlatformRunStatus,
  type RunAuthoritativeMetadata,
} from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunDispatchAttemptResult,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import { ListAuthoritativeRunQueueStatusUseCase } from "@application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase";
import { ListAuthoritativeRunsUseCase } from "@application/runs/use-cases/ListAuthoritativeRunsUseCase";
import { AuthoritativeRunQueryBackendApi } from "../AuthoritativeRunQueryBackendApi";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze(
      [...this.runs.values()].filter((run) => !query.workspaceId || run.workspaceId === query.workspaceId),
    );
  }

  public async createRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: Math.max(1, record.revision),
      status: record.status || PlatformRunStatuses.pending,
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
    const existing = this.runs.get(record.runId);
    const persisted = Object.freeze({
      ...record,
      revision: (existing?.revision ?? 0) + 1,
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }
}

class InMemoryRunQueueReadRepository implements IRunOrchestrationQueuePersistenceRepository {
  public readonly dispatchAttempts = new Map<string, ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>>();
  public entries: ReadonlyArray<AuthoritativeRunQueueEntryRecord> = Object.freeze([]);

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.find((entry) => entry.runId === runId);
  }

  public async listQueueEntries(
    _query?: {
      readonly workspaceId?: string;
      readonly queueId?: string;
      readonly lifecycleStates?: ReadonlyArray<typeof RunLifecycleStates[keyof typeof RunLifecycleStates]>;
      readonly includeDequeued?: boolean;
      readonly limit?: number;
      readonly offset?: number;
    },
  ): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return this.entries;
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
    readonly lifecycleState: typeof RunLifecycleStates[keyof typeof RunLifecycleStates];
  }): Promise<boolean> {
    return false;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return this.dispatchAttempts.get(runId) ?? Object.freeze([]);
  }
}

class InMemoryAuditEventRepository implements IPlatformAuditEventRepository {
  public readonly byTargetRef = new Map<string, ReadonlyArray<PlatformAuditEventRecord>>();

  public async appendAuditEvent(
    _event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord; }> {
    throw new Error("Not implemented.");
  }

  public async listAuditEvents(query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return this.byTargetRef.get(query.targetRef ?? "") ?? Object.freeze([]);
  }
}

function createQueueStatusUseCase(runRepository: InMemoryRunRepository): ListAuthoritativeRunQueueStatusUseCase {
  return new ListAuthoritativeRunQueueStatusUseCase({
    runRepository,
    queueRepository: {
      getQueueEntryByRunId: async () => undefined,
      enqueueRunForAssignment: async () => {
        throw new Error("Not implemented.");
      },
      listAssignmentReadyRuns: async () => Object.freeze([]),
      claimAssignmentReadyRuns: async () => Object.freeze([]),
      releaseRunClaim: async () => false,
      claimQueuedRunForNodeDispatch: async () => {
        throw new Error("Not implemented.");
      },
      recordDispatchAttemptResult: async () => false,
      finalizeRunQueueEntry: async () => false,
      listDispatchAttemptsByRunId: async () => Object.freeze([]),
      listQueueEntries: async () => Object.freeze([]),
    },
    now: () => new Date("2026-04-07T10:00:00.000Z"),
  });
}

class InMemoryAuthorizationRepositories
  implements
    IAuthorizationRoleGrantReadRepository,
    IAuthorizationSharingGrantReadRepository,
    IAuthorizationResourcePolicyMetadataReadRepository {
  public roleGrantSnapshot: AuthorizationActorRoleGrantSnapshot = Object.freeze({
    roleAssignments: Object.freeze([]),
    permissionGrants: Object.freeze([]),
  });
  public sharingGrants = new Map<string, ReadonlyArray<AuthorizationSharingGrantRecord>>();
  public resourceMetadata = new Map<string, AuthorizationResourcePolicyMetadata>();

  public async getActorRoleGrantSnapshot(
    _query: AuthorizationActorRoleGrantSnapshotQuery,
  ): Promise<AuthorizationActorRoleGrantSnapshot> {
    return this.roleGrantSnapshot;
  }

  public async listSharingGrants(
    query: AuthorizationSharingGrantLookupQuery,
  ): Promise<ReadonlyArray<AuthorizationSharingGrantRecord>> {
    return this.sharingGrants.get(toResourceKey(query.resource.resourceType, query.resource.resourceId)) ?? [];
  }

  public async findResourcePolicyMetadata(
    query: AuthorizationResourcePolicyMetadataLookupQuery,
  ): Promise<AuthorizationResourcePolicyMetadata | undefined> {
    return this.resourceMetadata.get(toResourceKey(query.resource.resourceType, query.resource.resourceId));
  }

  public async listResourcePolicyMetadata(
    _query: AuthorizationResourcePolicyMetadataListQuery,
  ): Promise<ReadonlyArray<AuthorizationResourcePolicyMetadata>> {
    return Object.freeze([...this.resourceMetadata.values()]);
  }
}

function toResourceKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

function createRunRecord(input: {
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

describe("AuthoritativeRunQueryBackendApi", () => {
  it("filters list results by authorization and applies pagination on visible runs", async () => {
    const runRepository = new InMemoryRunRepository();
    const runs = [
      createRunRecord({
        runId: "run:shared",
        workspaceId: "workspace-alpha",
        workflowId: "workflow-alpha",
        state: RunLifecycleStates.running,
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T09:00:00.000Z",
        updatedAt: "2026-04-07T09:05:00.000Z",
      }),
      createRunRecord({
        runId: "run:workspace-visible",
        workspaceId: "workspace-alpha",
        workflowId: "workflow-beta",
        state: RunLifecycleStates.submitted,
        source: RunSubmissionSources.uiManual,
        submittedAt: "2026-04-07T08:00:00.000Z",
        updatedAt: "2026-04-07T08:01:00.000Z",
      }),
      createRunRecord({
        runId: "run:private-other",
        workspaceId: "workspace-alpha",
        workflowId: "workflow-gamma",
        state: RunLifecycleStates.submitted,
        source: RunSubmissionSources.api,
        submittedAt: "2026-04-07T07:00:00.000Z",
        updatedAt: "2026-04-07T07:02:00.000Z",
      }),
    ];
    for (const run of runs) {
      await runRepository.createRun(run, {
        operationKey: `seed:${run.runId}`,
        actorId: "system:test",
      });
    }

    const authRepositories = new InMemoryAuthorizationRepositories();
    authRepositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([createRoleAssignment({
        id: "role-guest-1",
        actorUserIdentityId: "user-collab",
        roleKey: "guest",
        scope: RoleAssignmentScopes.workspace,
        workspaceId: "workspace-alpha",
        assignedByUserIdentityId: "user-owner",
        assignedAt: "2026-04-07T06:00:00.000Z",
      })]),
      permissionGrants: Object.freeze([]),
    });
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:shared"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:shared",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.shared,
      sharingPolicyMode: SharingPolicyModes.explicit,
      allowResharing: false,
      isPublishedCapable: false,
    }));
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:workspace-visible"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:workspace-visible",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
      isPublishedCapable: false,
    }));
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:private-other"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:private-other",
      ownerUserIdentityId: "user-other",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: SharingPolicyModes.ownerOnly,
      allowResharing: false,
      isPublishedCapable: false,
    }));
    authRepositories.sharingGrants.set(
      toResourceKey("authoritative-run", "run:shared"),
      Object.freeze([Object.freeze({
        id: "share-run-1",
        subject: {
          kind: SharingSubjectKinds.user,
          userIdentityId: "user-collab",
        },
        permissionKeys: Object.freeze(["run.read"]),
        grantedByUserIdentityId: "user-owner",
        grantedAt: "2026-04-07T06:30:00.000Z",
      })]),
    );

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: authRepositories,
      sharingGrantReadRepository: authRepositories,
      resourcePolicyMetadataReadRepository: authRepositories,
      clock: { now: () => new Date("2026-04-07T10:00:00.000Z") },
    });
    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: createQueueStatusUseCase(runRepository),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
      authorizationDecisionEvaluator: evaluator,
      now: () => new Date("2026-04-07T10:00:00.000Z"),
    });

    const response = await api.listRuns({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-collab",
        activeWorkspaceId: "workspace-alpha",
      },
      limit: 1,
      offset: 0,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.totalCount).toBe(2);
    expect(response.data?.items).toHaveLength(1);
    expect(response.data?.items[0]?.runId).toBe("run:shared");
  });

  it("returns non-leaky not-found for unauthorized run detail reads", async () => {
    const runRepository = new InMemoryRunRepository();
    await runRepository.createRun(createRunRecord({
      runId: "run:private",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      state: RunLifecycleStates.submitted,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    }), {
      operationKey: "seed:private",
      actorId: "system:test",
    });

    const authRepositories = new InMemoryAuthorizationRepositories();
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:private"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:private",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.private,
      sharingPolicyMode: SharingPolicyModes.ownerOnly,
      allowResharing: false,
      isPublishedCapable: false,
    }));

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: authRepositories,
      sharingGrantReadRepository: authRepositories,
      resourcePolicyMetadataReadRepository: authRepositories,
    });
    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: createQueueStatusUseCase(runRepository),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
      authorizationDecisionEvaluator: evaluator,
    });

    const response = await api.getRunDetail({
      runId: "run:private",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-denied",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });

  it("returns canonical run status envelopes without exposing detail internals", async () => {
    const runRepository = new InMemoryRunRepository();
    await runRepository.createRun(createRunRecord({
      runId: "run:status",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      state: RunLifecycleStates.running,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    }), {
      operationKey: "seed:status",
      actorId: "system:test",
    });

    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: createQueueStatusUseCase(runRepository),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
    });

    const response = await api.getRunStatus({
      runId: "run:status",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.runId).toBe("run:status");
    expect(response.data?.state).toBe("running");
    expect((response.data as Record<string, unknown> | undefined)?.submission).toBeUndefined();
    expect(response.data?.statusTimeline?.length).toBeGreaterThan(0);
  });

  it("returns queue-status read projections for operational control surfaces", async () => {
    const runRepository = new InMemoryRunRepository();
    await runRepository.createRun(createRunRecord({
      runId: "run:queue",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      state: RunLifecycleStates.queued,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    }), {
      operationKey: "seed:queue",
      actorId: "system:test",
    });

    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: new ListAuthoritativeRunQueueStatusUseCase({
        runRepository,
        queueRepository: {
          getQueueEntryByRunId: async () => undefined,
          enqueueRunForAssignment: async () => {
            throw new Error("Not implemented.");
          },
          listAssignmentReadyRuns: async () => Object.freeze([]),
          claimAssignmentReadyRuns: async () => Object.freeze([]),
          releaseRunClaim: async () => false,
          claimQueuedRunForNodeDispatch: async () => {
            throw new Error("Not implemented.");
          },
          recordDispatchAttemptResult: async () => false,
          finalizeRunQueueEntry: async () => false,
          listDispatchAttemptsByRunId: async () => Object.freeze([]),
          listQueueEntries: async () => Object.freeze([{
            runId: "run:queue",
            queueId: "queue:default",
            workspaceId: "workspace-alpha",
            lifecycleState: RunLifecycleStates.queued,
            enteredAt: "2026-04-07T09:00:00.000Z",
            orderKey: "001",
            eligibilityMarker: "ready",
            eligibleAt: "2026-04-07T09:00:00.000Z",
            updatedAt: "2026-04-07T09:05:00.000Z",
            revision: 1,
          }]),
        },
        now: () => new Date("2026-04-07T10:00:00.000Z"),
      }),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
    });

    const response = await api.listQueueStatus({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: "workspace-alpha",
      },
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.items).toHaveLength(1);
    expect(response.data?.items[0]?.runId).toBe("run:queue");
    expect(response.data?.items[0]?.actionAvailability?.cancel.allowed).toBeTrue();
  });

  it("gates scheduling admin diagnostics and queue admin summary by run.manage visibility", async () => {
    const runRepository = new InMemoryRunRepository();
    const runQueueRepository = new InMemoryRunQueueReadRepository();
    await runRepository.createRun(createRunRecord({
      runId: "run:queue-admin",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      state: RunLifecycleStates.queued,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    }), {
      operationKey: "seed:queue-admin",
      actorId: "system:test",
    });
    runQueueRepository.entries = Object.freeze([Object.freeze({
      runId: "run:queue-admin",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: RunLifecycleStates.queued,
      enteredAt: "2026-04-07T09:00:00.000Z",
      orderKey: "001",
      eligibilityMarker: "deferred",
      eligibleAt: "2026-04-07T09:10:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
      revision: 2,
      deferCount: 2,
      lastNoPlacementCategory: "capability-coverage-missing",
      lastNoPlacementReasonCodes: Object.freeze(["node-missing-capability"]),
      lastNoPlacementReasonMessage: "No eligible node satisfies required capabilities.",
      lastNoPlacementDecisionId: "decision:1",
      lastNoPlacementRecordedAt: "2026-04-07T09:05:00.000Z",
      lastNoPlacementRequiresAdministrativeAttention: true,
    })]);

    const authRepositories = new InMemoryAuthorizationRepositories();
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:queue-admin"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:queue-admin",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
      isPublishedCapable: false,
    }));
    authRepositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-viewer-queue",
          actorUserIdentityId: "user-viewer",
          roleKey: "viewer",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-07T08:00:00.000Z",
        }),
        createRoleAssignment({
          id: "role-admin-queue",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-07T08:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });
    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: authRepositories,
      sharingGrantReadRepository: authRepositories,
      resourcePolicyMetadataReadRepository: authRepositories,
      clock: { now: () => new Date("2026-04-07T10:00:00.000Z") },
    });

    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: new ListAuthoritativeRunQueueStatusUseCase({
        runRepository,
        queueRepository: runQueueRepository,
        now: () => new Date("2026-04-07T10:00:00.000Z"),
      }),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
      queueRepository: runQueueRepository,
      authorizationDecisionEvaluator: evaluator,
      now: () => new Date("2026-04-07T10:00:00.000Z"),
    });

    const viewer = await api.listQueueStatus({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-viewer",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(viewer.ok).toBeTrue();
    expect(viewer.data?.items[0]?.scheduling?.admin).toBeUndefined();
    expect(viewer.data?.schedulingAdminSummary).toBeUndefined();

    const admin = await api.listQueueStatus({
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-admin",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(admin.ok).toBeTrue();
    expect(admin.data?.items[0]?.scheduling?.admin?.requiresAdministrativeAttention).toBeTrue();
    expect(admin.data?.schedulingAdminSummary?.requiresAdministrativeAttentionRuns).toBe(1);
  });

  it("keeps diagnostics redacted for readers and exposes admin diagnostics for run.manage audiences", async () => {
    const runRepository = new InMemoryRunRepository();
    const runQueueRepository = new InMemoryRunQueueReadRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();

    const failedRun = createRunRecord({
      runId: "run:failed",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      state: RunLifecycleStates.failed,
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
    });

    await runRepository.createRun(Object.freeze({
      ...failedRun,
      metadata: Object.freeze({
        ...(failedRun.metadata as Record<string, unknown>),
        canonicalRun: Object.freeze({
          ...((failedRun.metadata as RunAuthoritativeMetadata).canonicalRun),
          execution: Object.freeze({
            ...((failedRun.metadata as RunAuthoritativeMetadata).canonicalRun.execution),
            outcome: "failed",
            errorCode: "dispatch-failed-to-start",
            errorMessage: "Run failed to start on backend.",
            finishedAt: "2026-04-07T09:05:00.000Z",
          }),
        }),
        executionTelemetry: Object.freeze({
          lastInternalUpdate: Object.freeze({
            updatedAt: "2026-04-07T09:04:40.000Z",
            senderNodeId: "node:trusted-1",
            senderBackendKind: "local-worker",
            senderBackendRunId: "backend-run-1",
            diagnostics: Object.freeze({
              workerPid: 4242,
            }),
          }),
        }),
      }),
    }), {
      operationKey: "seed:failed",
      actorId: "system:test",
    });

    runQueueRepository.dispatchAttempts.set("run:failed", Object.freeze([Object.freeze({
      attemptId: "dispatch-attempt:1",
      runId: "run:failed",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      nodeId: "node:trusted-1",
      reservationOwner: "orchestrator:1",
      claimToken: "claim:1",
      preparedAt: "2026-04-07T09:04:10.000Z",
      dispatchMetadata: Object.freeze({}),
      dispatchResult: Object.freeze({
        status: "failed-to-start",
        recordedAt: "2026-04-07T09:04:12.000Z",
        failure: Object.freeze({
          safeCode: "dispatch-failed-to-start",
          safeMessage: "Run failed to start on backend.",
          internalCode: "adapter-timeout",
        }),
      }),
    })]));
    auditEventRepository.byTargetRef.set("run:run:failed", Object.freeze([Object.freeze({
      eventId: "audit:progress",
      eventKind: "runs",
      action: "run.execution-update.ingested",
      actorId: "node:trusted-1",
      targetRef: "run:run:failed",
      outcome: "succeeded",
      occurredAt: "2026-04-07T09:04:30.000Z",
      details: Object.freeze({
        toState: "running",
        hadProgress: true,
        hadHeartbeat: true,
      }),
    })]));

    const authRepositories = new InMemoryAuthorizationRepositories();
    authRepositories.resourceMetadata.set(toResourceKey("authoritative-run", "run:failed"), Object.freeze({
      resourceFamily: AuthorizationResourceFamilies.run,
      resourceType: "authoritative-run",
      resourceId: "run:failed",
      ownerUserIdentityId: "user-owner",
      ownershipScope: ResourceOwnershipScopes.workspace,
      workspaceId: "workspace-alpha",
      visibility: ResourceVisibilities.workspace,
      sharingPolicyMode: SharingPolicyModes.workspaceMembers,
      allowResharing: false,
      isPublishedCapable: false,
    }));

    authRepositories.roleGrantSnapshot = Object.freeze({
      roleAssignments: Object.freeze([
        createRoleAssignment({
          id: "role-viewer",
          actorUserIdentityId: "user-viewer",
          roleKey: "viewer",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-07T08:00:00.000Z",
        }),
        createRoleAssignment({
          id: "role-admin",
          actorUserIdentityId: "user-admin",
          roleKey: "admin",
          scope: RoleAssignmentScopes.workspace,
          workspaceId: "workspace-alpha",
          assignedByUserIdentityId: "user-owner",
          assignedAt: "2026-04-07T08:00:00.000Z",
        }),
      ]),
      permissionGrants: Object.freeze([]),
    });

    const evaluator = new AuthorizationPolicyDecisionEvaluator({
      roleGrantReadRepository: authRepositories,
      sharingGrantReadRepository: authRepositories,
      resourcePolicyMetadataReadRepository: authRepositories,
      clock: { now: () => new Date("2026-04-07T10:00:00.000Z") },
    });

    const api = new AuthoritativeRunQueryBackendApi({
      listAuthoritativeRunsUseCase: new ListAuthoritativeRunsUseCase(runRepository),
      listAuthoritativeRunQueueStatusUseCase: createQueueStatusUseCase(runRepository),
      getAuthoritativeRunUseCase: new GetAuthoritativeRunUseCase(runRepository),
      runRepository,
      queueRepository: runQueueRepository,
      auditEventRepository,
      authorizationDecisionEvaluator: evaluator,
      now: () => new Date("2026-04-07T10:00:00.000Z"),
    });

    const viewer = await api.getRunStatus({
      runId: "run:failed",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-viewer",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(viewer.ok).toBeTrue();
    expect(viewer.data?.statusTimeline?.some((entry) => entry.kind === "dispatch-attempt")).toBeTrue();
    expect(viewer.data?.failureSummary?.diagnostics).toBeUndefined();

    const admin = await api.getRunStatus({
      runId: "run:failed",
      workspaceId: "workspace-alpha",
      authorization: {
        actorUserIdentityId: "user-admin",
        activeWorkspaceId: "workspace-alpha",
      },
    });
    expect(admin.ok).toBeTrue();
    expect(admin.data?.failureSummary?.diagnostics?.visibility).toBe("admin");
    expect(admin.data?.failureSummary?.diagnostics?.latestDispatchFailure?.internalCode).toBe("adapter-timeout");
    expect(admin.data?.failureSummary?.diagnostics?.latestExecutionTelemetry?.diagnosticKeys).toEqual(["workerPid"]);
  });
});


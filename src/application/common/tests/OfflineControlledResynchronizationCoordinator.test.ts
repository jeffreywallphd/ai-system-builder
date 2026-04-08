import { describe, expect, it } from "bun:test";
import {
  type IOfflineAuthoritativeSnapshotCacheRepository,
  type OfflineAuthoritativeSnapshotCacheKey,
  type OfflineAuthoritativeSnapshotRecord,
  OfflineAuthoritativeSnapshotCacheService,
} from "../OfflineAuthoritativeSnapshotCache";
import {
  AuthoritativeReplayExecutionResultKinds,
  type AuthoritativeReplayExecutionResult,
  type IOfflineAuthoritativeResynchronizationPort,
  type IOfflineConnectivityStatePort,
  OfflineControlledResynchronizationCoordinator,
} from "../OfflineControlledResynchronizationCoordinator";
import {
  type IOfflinePendingOperationRepository,
  type OfflinePendingOperationRecord,
  OfflinePendingOperationDependencyKinds,
  OfflinePendingOperationService,
} from "../OfflinePendingOperationPersistence";
import {
  type IOfflineLocalExecutionRegistrationRepository,
  type OfflineLocalExecutionRegistrationRecord,
  OfflineLocalExecutionRegistrationService,
} from "../OfflineLocalExecutionRegistrationPersistence";
import {
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineQueuedMutationIntents,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  OfflineWorkstationModes,
  OfflineDeviceTrustPostures,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
  createOfflineQueuedMutationEnvelope,
  type OfflineResourcePolicyEvaluationInput,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineLocalExecutionRegistrationStatuses,
  OfflineConnectivityStates,
  type OfflineConnectivitySurfaceStateDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import {
  OfflineOperationalEventTypes,
  type IOfflineOperationalEventSink,
} from "../OfflineOperationalEventPorts";

class InMemoryOfflinePendingOperationRepository implements IOfflinePendingOperationRepository {
  private readonly records = new Map<string, OfflinePendingOperationRecord>();

  public async upsertOperation(record: OfflinePendingOperationRecord): Promise<void> {
    this.records.set(this.keyOf(record.actorWorkspaceContext.workspaceId, record.operation.mutationId), record);
  }

  public async findOperation(
    workspaceId: string,
    operationId: string,
  ): Promise<OfflinePendingOperationRecord | undefined> {
    return this.records.get(this.keyOf(workspaceId, operationId));
  }

  public async listOperationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflinePendingOperationRecord>> {
    return Object.freeze(
      [...this.records.values()].filter((entry) => entry.actorWorkspaceContext.workspaceId === workspaceId),
    );
  }

  public async deleteOperation(workspaceId: string, operationId: string): Promise<boolean> {
    return this.records.delete(this.keyOf(workspaceId, operationId));
  }

  private keyOf(workspaceId: string, operationId: string): string {
    return `${workspaceId}::${operationId}`;
  }
}

class InMemoryOfflineLocalExecutionRegistrationRepository implements IOfflineLocalExecutionRegistrationRepository {
  private readonly records = new Map<string, OfflineLocalExecutionRegistrationRecord>();

  public async upsertRegistration(record: OfflineLocalExecutionRegistrationRecord): Promise<void> {
    this.records.set(this.keyOf(record.actorWorkspaceContext.workspaceId, record.registration.registrationId), record);
  }

  public async findRegistration(
    workspaceId: string,
    registrationId: string,
  ): Promise<OfflineLocalExecutionRegistrationRecord | undefined> {
    return this.records.get(this.keyOf(workspaceId, registrationId));
  }

  public async listRegistrationsByWorkspace(
    workspaceId: string,
  ): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>> {
    return Object.freeze(
      [...this.records.values()].filter((entry) => entry.actorWorkspaceContext.workspaceId === workspaceId),
    );
  }

  public async deleteRegistration(workspaceId: string, registrationId: string): Promise<boolean> {
    return this.records.delete(this.keyOf(workspaceId, registrationId));
  }

  private keyOf(workspaceId: string, registrationId: string): string {
    return `${workspaceId}::${registrationId}`;
  }
}

class InMemoryOfflineAuthoritativeSnapshotCacheRepository implements IOfflineAuthoritativeSnapshotCacheRepository {
  private readonly records = new Map<string, OfflineAuthoritativeSnapshotRecord>();

  public getCapabilities() {
    return Object.freeze({
      supportsProtectedAtRestStorage: true,
      maxEntries: 1_000,
    });
  }

  public async upsertSnapshot(record: OfflineAuthoritativeSnapshotRecord): Promise<void> {
    this.records.set(this.keyOf(record), record);
  }

  public async findSnapshot(
    key: OfflineAuthoritativeSnapshotCacheKey,
  ): Promise<OfflineAuthoritativeSnapshotRecord | undefined> {
    return this.records.get(this.keyOf(key));
  }

  public async listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>> {
    return Object.freeze([...this.records.values()].filter((record) => record.workspaceId === workspaceId));
  }

  public async deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean> {
    return this.records.delete(this.keyOf(key));
  }

  private keyOf(key: OfflineAuthoritativeSnapshotCacheKey): string {
    return `${key.workspaceId}::${key.resourceClass}::${key.resourceId}`;
  }
}

class StaticConnectivityPort implements IOfflineConnectivityStatePort {
  constructor(private readonly state: OfflineConnectivitySurfaceStateDto) {}

  public async getConnectivityState(): Promise<OfflineConnectivitySurfaceStateDto> {
    return this.state;
  }
}

class FakeAuthoritativeResynchronizationPort implements IOfflineAuthoritativeResynchronizationPort {
  public readonly replayedOperations: string[] = [];
  public readonly replayedLocalExecutionRegistrations: string[] = [];
  public readonly refreshedSnapshots: string[] = [];
  private readonly revisionByResourceKey: ReadonlyMap<string, { readonly authoritativeRevision: string } & Partial<{
    readonly resourceExists: boolean;
    readonly accessRevoked: boolean;
    readonly permissionAllowsReplay: boolean;
    readonly requiresAdminIntervention: boolean;
    readonly submissionStillValid: boolean;
    readonly revisionComparable: boolean;
  }>>;
  private readonly replayResultByOperationId: ReadonlyMap<string, AuthoritativeReplayExecutionResult>;
  private readonly replayResultByRegistrationId: ReadonlyMap<string, AuthoritativeReplayExecutionResult>;
  private readonly missingSnapshotResourceKeys: ReadonlySet<string>;

  constructor(options?: {
    readonly revisionsByResourceKey?: ReadonlyMap<string, { readonly authoritativeRevision: string } & Partial<{
      readonly resourceExists: boolean;
      readonly accessRevoked: boolean;
      readonly permissionAllowsReplay: boolean;
      readonly requiresAdminIntervention: boolean;
      readonly submissionStillValid: boolean;
      readonly revisionComparable: boolean;
    }>>;
    readonly replayResultsByOperationId?: ReadonlyMap<string, AuthoritativeReplayExecutionResult>;
    readonly replayResultsByRegistrationId?: ReadonlyMap<string, AuthoritativeReplayExecutionResult>;
    readonly missingSnapshotResourceKeys?: ReadonlySet<string>;
  }) {
    this.revisionByResourceKey = options?.revisionsByResourceKey ?? new Map();
    this.replayResultByOperationId = options?.replayResultsByOperationId ?? new Map();
    this.replayResultByRegistrationId = options?.replayResultsByRegistrationId ?? new Map();
    this.missingSnapshotResourceKeys = options?.missingSnapshotResourceKeys ?? new Set();
  }

  public async fetchResourceRevisions(input: {
    readonly workspaceId: string;
    readonly resources: ReadonlyArray<{
      readonly resourceClass: typeof OfflineResourceClasses[keyof typeof OfflineResourceClasses];
      readonly resourceId: string;
    }>;
  }) {
    const revisions = input.resources.map((resource) => {
      const mapped = this.revisionByResourceKey.get(`${resource.resourceClass}::${resource.resourceId}`);
      if (mapped) {
        return Object.freeze({
          resourceClass: resource.resourceClass,
          resourceId: resource.resourceId,
          ...mapped,
        });
      }
      if (resource.resourceClass === OfflineResourceClasses.runSubmissionIntent) {
        return Object.freeze({
          resourceClass: resource.resourceClass,
          resourceId: resource.resourceId,
          authoritativeRevision: "run:rev:1",
        });
      }
      if (resource.resourceClass === OfflineResourceClasses.workflowDraft) {
        return Object.freeze({
          resourceClass: resource.resourceClass,
          resourceId: resource.resourceId,
          authoritativeRevision: "workflow:rev:2",
        });
      }
      return Object.freeze({
        resourceClass: resource.resourceClass,
        resourceId: resource.resourceId,
        authoritativeRevision: "workflow-def:rev:2",
      });
    });
    return Object.freeze(revisions);
  }

  public async replayPreparedOperation(input: {
    readonly workspaceId: string;
    readonly attemptedAt: string;
    readonly operation: { readonly operationId: string };
  }) {
    this.replayedOperations.push(input.operation.operationId);
    const configured = this.replayResultByOperationId.get(input.operation.operationId);
    if (configured) {
      return configured;
    }
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "Authoritative replay applied.",
      authoritativeRevisionAfter: "run:rev:2",
    });
  }

  public async replayPreparedLocalExecutionRegistration(input: {
    readonly workspaceId: string;
    readonly attemptedAt: string;
    readonly registration: { readonly registrationId: string };
  }) {
    this.replayedLocalExecutionRegistrations.push(input.registration.registrationId);
    const configured = this.replayResultByRegistrationId.get(input.registration.registrationId);
    if (configured) {
      return configured;
    }
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "Authoritative local execution registration applied.",
      authoritativeRevisionAfter: "local-exec:rev:2",
    });
  }

  public async fetchResourceSnapshotForCache(input: {
    readonly workspaceId: string;
    readonly resourceClass: typeof OfflineResourceClasses[keyof typeof OfflineResourceClasses];
    readonly resourceId: string;
  }) {
    const resourceKey = `${input.resourceClass}::${input.resourceId}`;
    this.refreshedSnapshots.push(resourceKey);
    const mapped = this.revisionByResourceKey.get(resourceKey);
    if (
      this.missingSnapshotResourceKeys.has(resourceKey)
      || mapped?.resourceExists === false
      || mapped?.accessRevoked === true
      || mapped?.permissionAllowsReplay === false
      || mapped?.submissionStillValid === false
    ) {
      return undefined;
    }

    return Object.freeze({
      workspaceId: "workspace:alpha",
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
      authoritativeRevision: input.resourceClass === OfflineResourceClasses.runSubmissionIntent
        ? "run:rev:2"
        : "workflow-def:rev:2",
      authoritativeSnapshotRevision: input.resourceClass === OfflineResourceClasses.runSubmissionIntent
        ? "run:rev:2"
        : "workflow-def:rev:2",
      snapshot: Object.freeze({
        resourceId: input.resourceId,
        refreshed: true,
      }),
      policy: createPolicy(),
    });
  }
}

class RecordingOfflineOperationalSink implements IOfflineOperationalEventSink {
  public readonly events: Array<Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0]> = [];

  public async recordOfflineOperationalEvent(
    event: Parameters<IOfflineOperationalEventSink["recordOfflineOperationalEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
  }
}

function createPolicy(
  overrides?: Partial<OfflineResourcePolicyEvaluationInput>,
): OfflineResourcePolicyEvaluationInput {
  return Object.freeze({
    workspaceVisibility: WorkspaceVisibilities.private,
    workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
    workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
    sensitivityMarking: OfflineSensitivityMarkings.standard,
    storageRule: OfflineStorageRules.allowOfflineCache,
    deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    ...(overrides ?? {}),
  });
}

function createConnectedState(): OfflineConnectivitySurfaceStateDto {
  return Object.freeze({
    state: OfflineConnectivityStates.connected,
    stale: false,
    localModeActive: false,
    detail: undefined,
    lastChangedAt: "2026-04-08T12:00:00.000Z",
    canQueueOperations: true,
    canResynchronize: true,
  });
}

function createLocalExecutionRegistration(input: {
  readonly registrationId: string;
  readonly executionId: string;
  readonly queuedAt: string;
  readonly status?: (typeof OfflineLocalExecutionRegistrationStatuses)[keyof typeof OfflineLocalExecutionRegistrationStatuses];
}) {
  const execution = createOfflineLocalExecutionRecord({
    executionId: input.executionId,
    executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
    resourceClass: OfflineResourceClasses.localRuntimeSession,
    resourceId: `runtime:session:${input.executionId}`,
    startedAt: "2026-04-08T12:09:50.000Z",
    completedAt: "2026-04-08T12:09:59.000Z",
    executedByActorUserIdentityId: "user:alpha",
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
    workstationMode: OfflineWorkstationModes.interactiveUserSession,
    outcome: OfflineLocalExecutionOutcomes.succeeded,
    inputDigest: `sha256:input:${input.executionId}`,
    outputs: [{
      outputId: `output:${input.executionId}`,
      outputClass: OfflineLocalExecutionOutputClasses.metricsSnapshot,
      contentDigest: `sha256:output:${input.executionId}`,
      sizeBytes: 100,
    }],
  });

  return createOfflineLocalExecutionRegistrationEnvelope({
    registrationId: input.registrationId,
    execution,
    queuedAt: input.queuedAt,
    userVisibleRegistrationStatus: input.status,
    divergenceDisclosureToken: `offline-warning:${input.registrationId}`,
    replayDescriptor: {
      method: "POST",
      path: `/v1/offline/local-executions/${input.executionId}/register`,
      idempotencyKey: `idem:${input.registrationId}`,
      payload: Object.freeze({
        executionId: input.executionId,
      }),
    },
  });
}

describe("OfflineControlledResynchronizationCoordinator", () => {
  it("revalidates cache, replays eligible operations, and records explicit outcomes", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort();
    const eventSink = new RecordingOfflineOperationalSink();
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(createConnectedState()),
      {
        now: () => new Date("2026-04-08T12:30:00.000Z"),
        eventSink,
      },
    );

    await snapshotCacheService.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:1",
      authoritativeRevision: "workflow-def:rev:1",
      snapshot: Object.freeze({ resourceId: "workflow:def:1", refreshed: false }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:00:00.000Z",
      lastSynchronizedAt: "2026-04-08T12:00:00.000Z",
    });

    const operationA = createOfflineQueuedMutationEnvelope({
      mutationId: "operation:apply:1",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:1",
      intent: OfflineQueuedMutationIntents.createOrUpdateAuthoritative,
      baseAuthoritativeRevision: "run:rev:1",
      localMutationRevision: 1,
      queuedAt: "2026-04-08T12:10:00.000Z",
      userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
      divergenceDisclosureToken: "offline-warning:operation:apply:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:1",
        idempotencyKey: "idem:operation:apply:1",
        payload: Object.freeze({ runIntentId: "run:intent:1" }),
      },
    });
    const operationB = createOfflineQueuedMutationEnvelope({
      mutationId: "operation:conflict:1",
      targetResourceClass: OfflineResourceClasses.workflowDraft,
      targetResourceId: "workflow:draft:2",
      intent: OfflineQueuedMutationIntents.promoteLocalDraft,
      baseAuthoritativeRevision: "workflow:rev:1",
      localMutationRevision: 3,
      queuedAt: "2026-04-08T12:10:01.000Z",
      userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
      divergenceDisclosureToken: "offline-warning:operation:conflict:1",
      replayDescriptor: {
        method: "PATCH",
        path: "/v1/workflows/drafts/workflow:draft:2/promote",
        idempotencyKey: "idem:operation:conflict:1",
        payload: Object.freeze({ draftId: "workflow:draft:2" }),
      },
    });

    await pendingOperationService.queueOperation({
      operation: operationA,
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: operationB,
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      dependencies: [{
        operationId: "operation:apply:1",
        kind: OfflinePendingOperationDependencyKinds.replayAfterDependencyApplied,
      }],
    });
    await localExecutionRegistrationService.queueRegistration({
      registration: createLocalExecutionRegistration({
        registrationId: "registration:apply:1",
        executionId: "execution:apply:1",
        queuedAt: "2026-04-08T12:10:02.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      attemptedAt: "2026-04-08T12:30:00.000Z",
    });

    expect(result.replayPreparedOperationIds).toEqual([
      "operation:apply:1",
      "operation:conflict:1",
    ]);
    expect(result.replayedOperationIds).toEqual(["operation:apply:1"]);
    expect(result.appliedOperationIds).toEqual(["operation:apply:1"]);
    expect(result.replayPreparedRegistrationIds).toEqual(["registration:apply:1"]);
    expect(result.replayedRegistrationIds).toEqual(["registration:apply:1"]);
    expect(result.appliedRegistrationIds).toEqual(["registration:apply:1"]);
    expect(result.blockedOperationIds).toEqual([]);
    expect(result.blockedOperations).toEqual([]);
    expect(result.blockedRegistrationIds).toEqual([]);
    expect(result.blockedRegistrations).toEqual([]);
    expect(result.outcomes.map((outcome) => outcome.action)).toEqual([
      "apply-to-authoritative",
      "conflict-requires-review",
      "apply-to-authoritative",
    ]);
    expect(result.outcomes[1]?.conflicts?.[0]?.conflictClass).toBe("stale-base-edit");
    expect(result.invalidatedSnapshotKeys).toEqual([]);
    expect(result.pendingOperationCleanupRecords).toEqual([
      expect.objectContaining({
        operationId: "operation:apply:1",
        classification: "successful",
        cleanupAction: "removed-from-queue",
      }),
      expect.objectContaining({
        operationId: "operation:conflict:1",
        classification: "conflicted",
        cleanupAction: "retained-for-review",
      }),
    ]);

    const persistedConflict = await pendingOperationService.findQueuedOperation(
      "workspace:alpha",
      "operation:conflict:1",
    );
    const removedApplied = await pendingOperationService.findQueuedOperation(
      "workspace:alpha",
      "operation:apply:1",
    );
    expect(persistedConflict?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncConflict);
    expect(removedApplied).toBeUndefined();
    expect(authoritativePort.replayedOperations).toEqual(["operation:apply:1"]);
    expect(authoritativePort.replayedLocalExecutionRegistrations).toEqual(["registration:apply:1"]);

    expect(result.refreshedSnapshotKeys).toEqual([
      "run-submission-intent::run:intent:1",
      "workflow-definition::workflow:def:1",
    ]);
    expect(authoritativePort.refreshedSnapshots).toContain("run-submission-intent::run:intent:1");
    expect(authoritativePort.refreshedSnapshots).toContain("workflow-definition::workflow:def:1");
    expect(result.syncAttemptId).toContain("offline-sync:");
    expect(eventSink.events[0]).toMatchObject({
      type: OfflineOperationalEventTypes.resynchronizationAttemptStarted,
      correlationId: result.syncAttemptId,
      syncAttemptId: result.syncAttemptId,
    });
    expect(eventSink.events[eventSink.events.length - 1]).toMatchObject({
      type: OfflineOperationalEventTypes.resynchronizationAttemptCompleted,
      correlationId: result.syncAttemptId,
      syncAttemptId: result.syncAttemptId,
      diagnostics: {
        replayFailureSummaries: {
          totalFailures: 1,
        },
      },
    });
    expect(eventSink.events.map((event) => event.type)).toContain(OfflineOperationalEventTypes.replaySucceeded);
    expect(eventSink.events.map((event) => event.type)).toContain(OfflineOperationalEventTypes.conflictDetected);
    expect(eventSink.events.map((event) => event.type)).toContain(OfflineOperationalEventTypes.protectedLocalExecutionRegistered);
  });

  it("skips replay when connectivity cannot resynchronize", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort();
    const eventSink = new RecordingOfflineOperationalSink();
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(Object.freeze({
        ...createConnectedState(),
        state: OfflineConnectivityStates.disconnected,
        stale: true,
        localModeActive: true,
        canResynchronize: false,
      })),
      {
        eventSink,
      },
    );

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:offline",
      actorUserIdentityId: "user:offline",
      attemptedAt: "2026-04-08T12:31:00.000Z",
    });

    expect(result.replayPreparedOperationIds).toEqual([]);
    expect(result.replayedOperationIds).toEqual([]);
    expect(result.blockedOperations).toEqual([]);
    expect(result.replayPreparedRegistrationIds).toEqual([]);
    expect(result.replayedRegistrationIds).toEqual([]);
    expect(result.blockedRegistrations).toEqual([]);
    expect(result.outcomes).toEqual([]);
    expect(result.invalidatedSnapshotKeys).toEqual([]);
    expect(result.pendingOperationCleanupRecords).toEqual([]);
    expect(authoritativePort.replayedOperations).toEqual([]);
    expect(eventSink.events.map((event) => event.type)).toEqual([
      OfflineOperationalEventTypes.resynchronizationAttemptCompleted,
    ]);
    expect(eventSink.events[0]).toMatchObject({
      outcome: "failed",
      summary: "Resynchronization attempt was not started because connectivity is not eligible.",
    });
  });

  it("detects supported conflict classes during resynchronization and preserves local operations", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort({
      revisionsByResourceKey: new Map([
        ["workflow-draft::workflow:draft:stale", { authoritativeRevision: "workflow:rev:2" }],
        [
          "workflow-draft::workflow:draft:revoked",
          { authoritativeRevision: "workflow:rev:1", resourceExists: false },
        ],
        [
          "workflow-draft::workflow:draft:permission",
          {
            authoritativeRevision: "workflow:rev:1",
            permissionAllowsReplay: false,
            requiresAdminIntervention: true,
          },
        ],
        [
          "run-submission-intent::run:intent:invalid",
          { authoritativeRevision: "run:rev:1", submissionStillValid: false },
        ],
        [
          "workflow-draft::workflow:draft:format",
          { authoritativeRevision: "workflow:rev:1", revisionComparable: false },
        ],
      ]),
    });
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(createConnectedState()),
      {
        now: () => new Date("2026-04-08T12:40:00.000Z"),
      },
    );

    await snapshotCacheService.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.runSubmissionIntent,
      resourceId: "run:intent:invalid",
      authoritativeRevision: "run:rev:0",
      snapshot: Object.freeze({ runIntentId: "run:intent:invalid", stale: true }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:10:00.000Z",
      lastSynchronizedAt: "2026-04-08T12:10:00.000Z",
    });

    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:stale",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:stale",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:20:00.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:stale",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:stale/promote",
          idempotencyKey: "idem:operation:stale",
          payload: Object.freeze({ draftId: "workflow:draft:stale" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:revoked",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:revoked",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:20:01.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:revoked",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:revoked/promote",
          idempotencyKey: "idem:operation:revoked",
          payload: Object.freeze({ draftId: "workflow:draft:revoked" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:permission",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:permission",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:20:02.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:permission",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:permission/promote",
          idempotencyKey: "idem:operation:permission",
          payload: Object.freeze({ draftId: "workflow:draft:permission" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:invalid-submission",
        targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
        targetResourceId: "run:intent:invalid",
        intent: OfflineQueuedMutationIntents.createOrUpdateAuthoritative,
        baseAuthoritativeRevision: "run:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:20:03.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:invalid-submission",
        replayDescriptor: {
          method: "POST",
          path: "/v1/runs/intents/run:intent:invalid",
          idempotencyKey: "idem:operation:invalid-submission",
          payload: Object.freeze({ runIntentId: "run:intent:invalid" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:version",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:format",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:20:04.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:version",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:format/promote",
          idempotencyKey: "idem:operation:version",
          payload: Object.freeze({ draftId: "workflow:draft:format" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      attemptedAt: "2026-04-08T12:40:00.000Z",
    });

    expect(result.replayedOperationIds).toEqual([]);
    expect(result.outcomes.map((outcome) => outcome.conflicts?.[0]?.conflictClass)).toEqual([
      "stale-base-edit",
      "deleted-or-revoked-resource",
      "permission-changed-during-disconnection",
      "invalidated-run-submission",
      "resource-version-mismatch",
    ]);
    expect(result.outcomes.map((outcome) => outcome.preserveLocalDraftAsUnsynced)).toEqual([
      true,
      true,
      true,
      false,
      true,
    ]);
    expect(result.outcomes[2]?.requiresAdminAttention).toBeTrue();
    expect(result.invalidatedSnapshotKeys).toEqual(["run-submission-intent::run:intent:invalid"]);

    const stale = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:stale");
    const revoked = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:revoked");
    const permission = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:permission");
    const invalidSubmission = await pendingOperationService.findQueuedOperation(
      "workspace:alpha",
      "operation:invalid-submission",
    );
    const version = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:version");
    const invalidatedSnapshot = await snapshotCacheService.getSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.runSubmissionIntent,
      resourceId: "run:intent:invalid",
    });

    expect(stale?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncConflict);
    expect(revoked?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncRejected);
    expect(permission?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncRejected);
    expect(invalidSubmission?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncRejected);
    expect(version?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncConflict);
    expect(revoked?.retryability.retryable).toBeFalse();
    expect(permission?.retryability.retryable).toBeFalse();
    expect(invalidSubmission?.retryability.retryable).toBeFalse();
    expect(revoked?.retryability.nonRetryableReasonCode).toBe("deleted-or-revoked-resource");
    expect(permission?.retryability.nonRetryableReasonCode).toBe("permission-changed-during-disconnection");
    expect(invalidSubmission?.retryability.nonRetryableReasonCode).toBe("invalidated-run-submission");
    expect(invalidatedSnapshot).toBeUndefined();
  });

  it("returns structured blocked replay details and persists terminal blocked states", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort();
    const eventSink = new RecordingOfflineOperationalSink();
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(createConnectedState()),
      {
        now: () => new Date("2026-04-08T12:45:00.000Z"),
        eventSink,
      },
    );

    await pendingOperationService.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:retry-exhausted",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:retry-exhausted",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:40:00.000Z",
        userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
        divergenceDisclosureToken: "offline-warning:operation:retry-exhausted",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:retry-exhausted/promote",
          idempotencyKey: "idem:operation:retry-exhausted",
          payload: Object.freeze({ draftId: "workflow:draft:retry-exhausted" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 3,
        maxRetryCount: 3,
        backoffPolicy: "exponential",
      },
    });

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      attemptedAt: "2026-04-08T12:45:00.000Z",
    });

    expect(result.blockedOperationIds).toEqual(["operation:retry-exhausted"]);
    expect(result.blockedOperations[0]).toMatchObject({
      operationId: "operation:retry-exhausted",
      reasonCode: "retry-exhausted",
    });
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({
      operationId: "operation:retry-exhausted",
      action: "reject-not-allowed",
      preserveLocalDraftAsUnsynced: true,
    });
    expect(result.outcomes[0]?.conflicts?.[0]?.conflictClass).toBe("authoritative-state-unavailable");
    expect(result.pendingOperationCleanupRecords).toEqual([
      expect.objectContaining({
        operationId: "operation:retry-exhausted",
        classification: "abandoned",
        cleanupAction: "retained-for-review",
        nextStatus: "sync-rejected",
      }),
    ]);

    const persisted = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:retry-exhausted");
    expect(persisted?.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncRejected);
    expect(persisted?.retryability.retryable).toBeFalse();
    expect(persisted?.retryability.nonRetryableReasonCode).toBe("retry-exhausted");
    expect(eventSink.events.map((event) => event.type)).toEqual([
      OfflineOperationalEventTypes.resynchronizationAttemptStarted,
      OfflineOperationalEventTypes.replayFailed,
      OfflineOperationalEventTypes.resynchronizationAttemptCompleted,
    ]);
  });

  it("replays local execution registrations with explicit conflict lineage when authoritative linkage conflicts", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort({
      replayResultsByRegistrationId: new Map([
        [
          "registration:conflict:1",
          Object.freeze({
            kind: AuthoritativeReplayExecutionResultKinds.conflict,
            reason: "Authoritative history linkage conflict.",
          }),
        ],
      ]),
    });
    const eventSink = new RecordingOfflineOperationalSink();
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(createConnectedState()),
      {
        now: () => new Date("2026-04-08T12:46:00.000Z"),
        eventSink,
      },
    );

    await localExecutionRegistrationService.queueRegistration({
      registration: createLocalExecutionRegistration({
        registrationId: "registration:conflict:1",
        executionId: "execution:conflict:1",
        queuedAt: "2026-04-08T12:45:00.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      attemptedAt: "2026-04-08T12:46:00.000Z",
    });

    expect(result.replayPreparedRegistrationIds).toEqual(["registration:conflict:1"]);
    expect(result.replayedRegistrationIds).toEqual(["registration:conflict:1"]);
    expect(result.appliedRegistrationIds).toEqual([]);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({
      operationId: "registration:conflict:1",
      action: "conflict-requires-review",
    });
    const persisted = await localExecutionRegistrationService.findQueuedRegistration(
      "workspace:alpha",
      "registration:conflict:1",
    );
    expect(persisted?.registration.userVisibleRegistrationStatus).toBe("registration-conflict");
    expect(eventSink.events.map((event) => event.type)).toEqual([
      OfflineOperationalEventTypes.resynchronizationAttemptStarted,
      OfflineOperationalEventTypes.conflictDetected,
      OfflineOperationalEventTypes.resynchronizationAttemptCompleted,
    ]);
  });

  it("invalidates stale cached snapshots when authoritative refresh is unavailable", async () => {
    const pendingOperationService = new OfflinePendingOperationService(
      new InMemoryOfflinePendingOperationRepository(),
    );
    const localExecutionRegistrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotCacheService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const authoritativePort = new FakeAuthoritativeResynchronizationPort({
      revisionsByResourceKey: new Map([
        ["workflow-definition::workflow:def:stale", { authoritativeRevision: "workflow-def:rev:2" }],
      ]),
      missingSnapshotResourceKeys: new Set(["workflow-definition::workflow:def:stale"]),
    });
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      localExecutionRegistrationService,
      snapshotCacheService,
      authoritativePort,
      new StaticConnectivityPort(createConnectedState()),
      {
        now: () => new Date("2026-04-08T12:50:00.000Z"),
      },
    );

    await snapshotCacheService.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:stale",
      authoritativeRevision: "workflow-def:rev:1",
      snapshot: Object.freeze({ resourceId: "workflow:def:stale", refreshed: false }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:40:00.000Z",
      lastSynchronizedAt: "2026-04-08T12:40:00.000Z",
    });

    const result = await coordinator.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      attemptedAt: "2026-04-08T12:50:00.000Z",
    });

    expect(result.refreshedSnapshotKeys).toEqual([]);
    expect(result.invalidatedSnapshotKeys).toEqual(["workflow-definition::workflow:def:stale"]);
    const removedSnapshot = await snapshotCacheService.getSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:stale",
    });
    expect(removedSnapshot).toBeUndefined();
  });
});

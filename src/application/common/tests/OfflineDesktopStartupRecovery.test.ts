import { describe, expect, it } from "bun:test";
import {
  type IOfflineAuthoritativeSnapshotCacheRepository,
  type OfflineAuthoritativeSnapshotCacheKey,
  type OfflineAuthoritativeSnapshotRecord,
  OfflineAuthoritativeSnapshotCacheService,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import {
  AuthoritativeReplayExecutionResultKinds,
  type IOfflineAuthoritativeResynchronizationPort,
  type IOfflineConnectivityStatePort,
  OfflineControlledResynchronizationCoordinator,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import {
  OfflineDesktopStartupRecoveryActionStatuses,
  type IOfflineResynchronizationRecoveryStateRepository,
  type OfflineResynchronizationAttemptMarker,
  OfflineDesktopStartupRecoveryService,
} from "@application/common/OfflineDesktopStartupRecovery";
import {
  type IOfflineLocalExecutionRegistrationRepository,
  type OfflineLocalExecutionRegistrationRecord,
  OfflineLocalExecutionRegistrationService,
} from "@application/common/OfflineLocalExecutionRegistrationPersistence";
import {
  type IOfflinePendingOperationRepository,
  type OfflinePendingOperationRecord,
  OfflinePendingOperationService,
} from "@application/common/OfflinePendingOperationPersistence";
import {
  OfflineDeviceTrustPostures,
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineQueuedMutationIntents,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
  OfflineWorkstationModes,
  createOfflineLocalExecutionRecord,
  createOfflineLocalExecutionRegistrationEnvelope,
  createOfflineQueuedMutationEnvelope,
  type OfflineResourcePolicyEvaluationInput,
} from "@domain/platform/OfflineLocalModeBoundaries";
import {
  OfflineConnectivityStates,
  OfflineLocalExecutionRegistrationStatuses,
  type OfflineConnectivitySurfaceStateDto,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

class InMemoryOfflinePendingOperationRepository implements IOfflinePendingOperationRepository {
  private readonly records = new Map<string, OfflinePendingOperationRecord>();

  public async upsertOperation(record: OfflinePendingOperationRecord): Promise<void> {
    this.records.set(this.keyOf(record.actorWorkspaceContext.workspaceId, record.operation.mutationId), record);
  }

  public async findOperation(workspaceId: string, operationId: string): Promise<OfflinePendingOperationRecord | undefined> {
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

  public async listRegistrationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflineLocalExecutionRegistrationRecord>> {
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
      maxEntries: 500,
    });
  }

  public async upsertSnapshot(record: OfflineAuthoritativeSnapshotRecord): Promise<void> {
    this.records.set(this.keyOf(record), record);
  }

  public async findSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<OfflineAuthoritativeSnapshotRecord | undefined> {
    return this.records.get(this.keyOf(key));
  }

  public async listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>> {
    return Object.freeze([...this.records.values()].filter((entry) => entry.workspaceId === workspaceId));
  }

  public async deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean> {
    return this.records.delete(this.keyOf(key));
  }

  private keyOf(key: OfflineAuthoritativeSnapshotCacheKey): string {
    return `${key.workspaceId}::${key.resourceClass}::${key.resourceId}`;
  }
}

class InMemoryRecoveryStateRepository implements IOfflineResynchronizationRecoveryStateRepository {
  private readonly records = new Map<string, OfflineResynchronizationAttemptMarker>();

  public async markAttemptStarted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly actorUserIdentityId: string;
    readonly requestId?: string;
    readonly startedAt: string;
  }): Promise<void> {
    this.records.set(this.keyOf(input.workspaceId, input.syncAttemptId), Object.freeze({
      workspaceId: input.workspaceId,
      syncAttemptId: input.syncAttemptId,
      actorUserIdentityId: input.actorUserIdentityId,
      requestId: input.requestId,
      startedAt: input.startedAt,
      status: "started",
      updatedAt: input.startedAt,
    }));
  }

  public async markAttemptCompleted(input: {
    readonly workspaceId: string;
    readonly syncAttemptId: string;
    readonly completedAt: string;
    readonly completionOutcome: "succeeded" | "failed" | "conflict";
    readonly lastErrorSummary?: string;
  }): Promise<void> {
    const existing = this.records.get(this.keyOf(input.workspaceId, input.syncAttemptId));
    this.records.set(this.keyOf(input.workspaceId, input.syncAttemptId), Object.freeze({
      workspaceId: input.workspaceId,
      syncAttemptId: input.syncAttemptId,
      actorUserIdentityId: existing?.actorUserIdentityId ?? "system:recovery",
      requestId: existing?.requestId,
      startedAt: existing?.startedAt ?? input.completedAt,
      status: "completed",
      completedAt: input.completedAt,
      completionOutcome: input.completionOutcome,
      lastErrorSummary: input.lastErrorSummary,
      updatedAt: input.completedAt,
    }));
  }

  public async listAttemptsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>> {
    return Object.freeze(
      [...this.records.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((left, right) => left.syncAttemptId.localeCompare(right.syncAttemptId)),
    );
  }

  public async listInterruptedAttempts(workspaceId: string): Promise<ReadonlyArray<OfflineResynchronizationAttemptMarker>> {
    return Object.freeze(
      [...this.records.values()]
        .filter((entry) => entry.workspaceId === workspaceId && entry.status === "started")
        .sort((left, right) => left.syncAttemptId.localeCompare(right.syncAttemptId)),
    );
  }

  private keyOf(workspaceId: string, syncAttemptId: string): string {
    return `${workspaceId}::${syncAttemptId}`;
  }
}

class StaticConnectivityPort implements IOfflineConnectivityStatePort {
  constructor(private readonly state: OfflineConnectivitySurfaceStateDto) {}

  public async getConnectivityState(): Promise<OfflineConnectivitySurfaceStateDto> {
    return this.state;
  }
}

class FakeAuthoritativePort implements IOfflineAuthoritativeResynchronizationPort {
  public readonly replayedOperationIds: string[] = [];

  public async fetchResourceRevisions(
    input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceRevisions"]>[0],
  ) {
    return Object.freeze(input.resources.map((entry) => Object.freeze({
      resourceClass: entry.resourceClass,
      resourceId: entry.resourceId,
      authoritativeRevision: "rev:2",
    })));
  }

  public async replayPreparedOperation(
    input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedOperation"]>[0],
  ) {
    this.replayedOperationIds.push(input.operation.operationId);
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "applied",
      authoritativeRevisionAfter: "rev:2",
    });
  }

  public async replayPreparedLocalExecutionRegistration(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedLocalExecutionRegistration"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "applied",
      authoritativeRevisionAfter: "rev:2",
    });
  }

  public async fetchResourceSnapshotForCache(
    input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceSnapshotForCache"]>[0],
  ) {
    return Object.freeze({
      workspaceId: input.workspaceId,
      resourceClass: input.resourceClass,
      resourceId: input.resourceId,
      authoritativeRevision: "rev:2",
      snapshot: Object.freeze({ resourceId: input.resourceId }),
      policy: createPolicy(),
    });
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
    lastChangedAt: "2026-04-08T12:00:00.000Z",
    canQueueOperations: true,
    canResynchronize: true,
  });
}

function createDisconnectedState(): OfflineConnectivitySurfaceStateDto {
  return Object.freeze({
    state: OfflineConnectivityStates.disconnected,
    stale: true,
    localModeActive: true,
    lastChangedAt: "2026-04-08T12:00:00.000Z",
    canQueueOperations: true,
    canResynchronize: false,
  });
}

function createOperation(operationId: string, status?: string) {
  return createOfflineQueuedMutationEnvelope({
    mutationId: operationId,
    targetResourceClass: OfflineResourceClasses.workflowDraft,
    targetResourceId: `workflow:draft:${operationId}`,
    intent: OfflineQueuedMutationIntents.promoteLocalDraft,
    baseAuthoritativeRevision: "rev:1",
    localMutationRevision: 1,
    queuedAt: "2026-04-08T12:10:00.000Z",
    userVisibleSyncStatus: status as typeof OfflineQueuedMutationStatuses[keyof typeof OfflineQueuedMutationStatuses] | undefined,
    divergenceDisclosureToken: `offline-warning:${operationId}`,
    replayDescriptor: {
      method: "PATCH",
      path: `/v1/workflows/drafts/${operationId}/promote`,
      idempotencyKey: `idem:${operationId}`,
      payload: Object.freeze({ operationId }),
    },
  });
}

function createRegistration(registrationId: string, status?: string) {
  const execution = createOfflineLocalExecutionRecord({
    executionId: `execution:${registrationId}`,
    executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
    resourceClass: OfflineResourceClasses.localRuntimeSession,
    resourceId: `runtime:${registrationId}`,
    startedAt: "2026-04-08T12:00:00.000Z",
    completedAt: "2026-04-08T12:00:01.000Z",
    executedByActorUserIdentityId: "user:alpha",
    nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
    workstationMode: OfflineWorkstationModes.interactiveUserSession,
    outcome: OfflineLocalExecutionOutcomes.succeeded,
    inputDigest: `sha256:${registrationId}`,
    outputs: [{
      outputId: `output:${registrationId}`,
      outputClass: OfflineLocalExecutionOutputClasses.metricsSnapshot,
      contentDigest: `sha256:output:${registrationId}`,
      sizeBytes: 1,
    }],
  });

  return createOfflineLocalExecutionRegistrationEnvelope({
    registrationId,
    execution,
    queuedAt: "2026-04-08T12:11:00.000Z",
    userVisibleRegistrationStatus: status as typeof OfflineLocalExecutionRegistrationStatuses[keyof typeof OfflineLocalExecutionRegistrationStatuses] | undefined,
    divergenceDisclosureToken: `offline-warning:${registrationId}`,
    replayDescriptor: {
      method: "POST",
      path: `/v1/offline/local-executions/${execution.executionId}/register`,
      idempotencyKey: `idem:${registrationId}`,
      payload: Object.freeze({ registrationId }),
    },
  });
}

describe("OfflineDesktopStartupRecoveryService", () => {
  it("classifies retryable vs manual-follow-up startup state and preserved drafts", async () => {
    const pendingOperationService = new OfflinePendingOperationService(new InMemoryOfflinePendingOperationRepository());
    const registrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const recoveryStateRepository = new InMemoryRecoveryStateRepository();
    const recoveryService = new OfflineDesktopStartupRecoveryService(
      pendingOperationService,
      registrationService,
      snapshotService,
      new StaticConnectivityPort(createConnectedState()),
      recoveryStateRepository,
      {
        now: () => new Date("2026-04-08T12:30:00.000Z"),
      },
    );

    await pendingOperationService.queueOperation({
      operation: createOperation("operation:retryable"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOperation("operation:non-retryable"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: false,
        retryCount: 2,
        maxRetryCount: 5,
        backoffPolicy: "exponential",
        nonRetryableReasonCode: "permission-changed",
      },
    });
    await pendingOperationService.queueOperation({
      operation: createOperation("operation:conflict", OfflineQueuedMutationStatuses.syncConflict),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await registrationService.queueRegistration({
      registration: createRegistration("registration:retryable"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await registrationService.queueRegistration({
      registration: createRegistration("registration:rejected", OfflineLocalExecutionRegistrationStatuses.registrationRejected),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await snapshotService.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:expired",
      authoritativeRevision: "workflow:1",
      snapshot: Object.freeze({ resourceId: "workflow:def:expired" }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:00:00.000Z",
      expiresAt: "2026-04-08T12:10:00.000Z",
    });
    await recoveryStateRepository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:interrupted:1",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:20:00.000Z",
    });

    const result = await recoveryService.inspectWorkspace({
      workspaceId: "workspace:alpha",
      checkedAt: "2026-04-08T12:30:00.000Z",
    });

    expect(result.summary.interruptedAttemptCount).toBe(1);
    expect(result.retryableOperationIds).toEqual(["operation:retryable"]);
    expect(result.retryableRegistrationIds).toEqual(["registration:retryable"]);
    expect(result.manualFollowUpOperationIds).toEqual(["operation:conflict", "operation:non-retryable"]);
    expect(result.manualFollowUpRegistrationIds).toEqual(["registration:rejected"]);
    expect(result.expiredSnapshotKeys).toEqual(["workflow-definition::workflow:def:expired"]);
    expect(result.preservedDraftResourceKeys).toContain("workflow-draft::workflow:draft:operation:retryable");
    expect(result.summary.manualFollowUpCount).toBeGreaterThan(0);
  });

  it("retries interrupted resynchronization during startup when connectivity and retryability permit it", async () => {
    const pendingOperationService = new OfflinePendingOperationService(new InMemoryOfflinePendingOperationRepository());
    const registrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const recoveryStateRepository = new InMemoryRecoveryStateRepository();
    const connectivityPort = new StaticConnectivityPort(createConnectedState());
    const authoritativePort = new FakeAuthoritativePort();
    const coordinator = new OfflineControlledResynchronizationCoordinator(
      pendingOperationService,
      registrationService,
      snapshotService,
      authoritativePort,
      connectivityPort,
      {
        now: () => new Date("2026-04-08T12:45:00.000Z"),
      },
    );
    const recoveryService = new OfflineDesktopStartupRecoveryService(
      pendingOperationService,
      registrationService,
      snapshotService,
      connectivityPort,
      recoveryStateRepository,
      {
        now: () => new Date("2026-04-08T12:45:00.000Z"),
      },
    );

    await pendingOperationService.queueOperation({
      operation: createOperation("operation:restart-retry"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await recoveryStateRepository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:interrupted:2",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:40:00.000Z",
    });

    const result = await recoveryService.recoverWorkspaceStartup({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      autoRetryInterruptedResynchronization: true,
      executeResynchronization: (input) => coordinator.synchronizeWorkspace(input),
      checkedAt: "2026-04-08T12:45:00.000Z",
    });

    expect(result.autoResynchronizationAttempted).toBeTrue();
    expect(result.autoResynchronizationResult?.syncAttemptId).toBe("sync:interrupted:2");
    expect(authoritativePort.replayedOperationIds).toEqual(["operation:restart-retry"]);
    const remaining = await pendingOperationService.findQueuedOperation("workspace:alpha", "operation:restart-retry");
    expect(remaining).toBeUndefined();
    const attempts = await recoveryStateRepository.listAttemptsByWorkspace("workspace:alpha");
    expect(attempts[0]?.status).toBe("completed");
    expect(result.actions.some((entry) => (
      entry.kind === "interrupted-resynchronization-retried"
      && entry.status === OfflineDesktopStartupRecoveryActionStatuses.applied
    ))).toBeTrue();
  });

  it("keeps interrupted attempts in manual-follow-up when startup retry preconditions are not satisfied", async () => {
    const pendingOperationService = new OfflinePendingOperationService(new InMemoryOfflinePendingOperationRepository());
    const registrationService = new OfflineLocalExecutionRegistrationService(
      new InMemoryOfflineLocalExecutionRegistrationRepository(),
    );
    const snapshotService = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(),
    );
    const recoveryStateRepository = new InMemoryRecoveryStateRepository();
    const recoveryService = new OfflineDesktopStartupRecoveryService(
      pendingOperationService,
      registrationService,
      snapshotService,
      new StaticConnectivityPort(createDisconnectedState()),
      recoveryStateRepository,
      {
        now: () => new Date("2026-04-08T12:55:00.000Z"),
      },
    );

    await pendingOperationService.queueOperation({
      operation: createOperation("operation:queued"),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
    await recoveryStateRepository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:interrupted:blocked",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:50:00.000Z",
    });

    const result = await recoveryService.recoverWorkspaceStartup({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      autoRetryInterruptedResynchronization: true,
      checkedAt: "2026-04-08T12:55:00.000Z",
      executeResynchronization: async () => {
        throw new Error("should-not-run");
      },
    });

    expect(result.autoResynchronizationAttempted).toBeFalse();
    expect(result.autoResynchronizationResult).toBeUndefined();
    expect(result.actions.some((entry) => (
      entry.kind === "interrupted-resynchronization-retried"
      && entry.status === OfflineDesktopStartupRecoveryActionStatuses.manualFollowUp
    ))).toBeTrue();
    const attempts = await recoveryStateRepository.listInterruptedAttempts("workspace:alpha");
    expect(attempts.map((entry) => entry.syncAttemptId)).toEqual(["sync:interrupted:blocked"]);
  });
});

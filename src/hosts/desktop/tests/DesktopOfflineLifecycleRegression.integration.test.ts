import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthoritativeReplayExecutionResultKinds,
  type AuthoritativeReplayExecutionResult,
  type IOfflineAuthoritativeResynchronizationPort,
  type IOfflineConnectivityStatePort,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import type { IOfflineOperationalEventSink } from "@application/common/OfflineOperationalEventPorts";
import {
  OfflineConnectivityStates,
  OfflineDraftSyncStatuses,
  OfflineLocalChangeKinds,
  OfflineLocalExecutionRegistrationStatuses,
  OfflinePendingOperationStatuses,
} from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { parseOfflineSynchronizationStateSnapshotDto } from "@shared/schemas/runtime/OfflineSynchronizationSchemaContracts";
import {
  toOfflineLocalExecutionRegistrationEnvelopeDto,
  toOfflinePendingOperationEnvelopeDto,
  toOfflineSynchronizationStateSnapshotDto,
  toOfflineSyncQueueStateDto,
} from "@shared/dto/runtime/OfflineSynchronizationDtos";
import {
  OfflineDeviceTrustPostures,
  OfflineLocalExecutionClasses,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineNodeOperationalModes,
  OfflineQueuedMutationIntents,
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
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflineResynchronizationHostRuntime } from "../DesktopOfflineResynchronizationHost";
import { buildDesktopOfflineStatusSurfaceModel } from "@ui/presenters/DesktopOfflineStatusPresenter";
import { DesktopConnectivityService } from "@ui/shared/connectivity/DesktopConnectivityService";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

class StaticConnectivityPort implements IOfflineConnectivityStatePort {
  constructor(
    private readonly state: {
      readonly state: "connecting" | "connected" | "reconnecting" | "degraded" | "disconnected";
      readonly stale: boolean;
      readonly localModeActive: boolean;
      readonly detail?: string;
      readonly lastChangedAt: string;
      readonly canQueueOperations: boolean;
      readonly canResynchronize: boolean;
    },
  ) {}

  public async getConnectivityState() {
    return this.state;
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

class RegressionAuthoritativePort implements IOfflineAuthoritativeResynchronizationPort {
  private readonly revisionByResource = new Map<string, string>([
    [`${OfflineResourceClasses.runSubmissionIntent}::run:intent:apply`, "run:rev:1"],
    [`${OfflineResourceClasses.workflowDraft}::workflow:draft:conflict`, "workflow:rev:2"],
    [`${OfflineResourceClasses.workflowDefinition}::workflow:def:stale`, "workflow-def:rev:2"],
  ]);
  private readonly replayByOperation = new Map<string, AuthoritativeReplayExecutionResult>([
    ["operation:apply:1", Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.applied,
      reason: "Applied by authoritative control plane.",
      authoritativeRevisionAfter: "run:rev:2",
    })],
  ]);
  private readonly replayByRegistration = new Map<string, AuthoritativeReplayExecutionResult>([
    ["registration:reject:1", Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.rejected,
      reason: "Registration requires policy re-approval.",
      conflictClass: "permission-changed-during-disconnection",
      decisionRule: "reject-replay-and-require-admin-review",
      requiresUserAttention: true,
      requiresAdminAttention: true,
      preserveLocalDraftAsUnsynced: true,
      retryable: false,
    })],
  ]);

  public readonly replayedOperationIds: string[] = [];
  public readonly replayedRegistrationIds: string[] = [];
  public readonly refreshedSnapshotResourceKeys: string[] = [];

  public async fetchResourceRevisions(input: {
    readonly workspaceId: string;
    readonly resources: ReadonlyArray<{
      readonly resourceClass: string;
      readonly resourceId: string;
    }>;
  }) {
    return Object.freeze(input.resources.map((resource) => Object.freeze({
      resourceClass: resource.resourceClass as typeof OfflineResourceClasses[keyof typeof OfflineResourceClasses],
      resourceId: resource.resourceId,
      authoritativeRevision: this.revisionByResource.get(`${resource.resourceClass}::${resource.resourceId}`) ?? "rev:2",
    })));
  }

  public async replayPreparedOperation(input: {
    readonly workspaceId: string;
    readonly attemptedAt: string;
    readonly operation: { readonly operationId: string };
  }) {
    this.replayedOperationIds.push(input.operation.operationId);
    return this.replayByOperation.get(input.operation.operationId) ?? Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.failed,
      reason: "Unexpected operation replay id.",
      retryable: true,
    });
  }

  public async replayPreparedLocalExecutionRegistration(input: {
    readonly workspaceId: string;
    readonly attemptedAt: string;
    readonly registration: { readonly registrationId: string };
  }) {
    this.replayedRegistrationIds.push(input.registration.registrationId);
    return this.replayByRegistration.get(input.registration.registrationId) ?? Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.failed,
      reason: "Unexpected local execution registration replay id.",
      retryable: true,
    });
  }

  public async fetchResourceSnapshotForCache(input: {
    readonly workspaceId: string;
    readonly resourceClass: string;
    readonly resourceId: string;
  }) {
    const key = `${input.resourceClass}::${input.resourceId}`;
    this.refreshedSnapshotResourceKeys.push(key);
    if (key === `${OfflineResourceClasses.workflowDefinition}::workflow:def:stale`) {
      return undefined;
    }

    return Object.freeze({
      workspaceId: input.workspaceId,
      resourceClass: input.resourceClass as typeof OfflineResourceClasses[keyof typeof OfflineResourceClasses],
      resourceId: input.resourceId,
      authoritativeRevision: "run:rev:2",
      authoritativeSnapshotRevision: "run:rev:2",
      snapshot: Object.freeze({
        refreshed: true,
        resourceId: input.resourceId,
      }),
      policy: createPolicy(),
    });
  }
}

function createPolicy(overrides?: Partial<OfflineResourcePolicyEvaluationInput>): OfflineResourcePolicyEvaluationInput {
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

function createConnectedState() {
  return Object.freeze({
    state: OfflineConnectivityStates.connected,
    stale: false,
    localModeActive: false,
    lastChangedAt: "2026-04-08T12:00:00.000Z",
    canQueueOperations: true,
    canResynchronize: true,
  });
}

function createDisconnectedState() {
  return Object.freeze({
    state: OfflineConnectivityStates.disconnected,
    stale: false,
    localModeActive: true,
    detail: "offline-mode-deliberate",
    lastChangedAt: "2026-04-08T12:40:00.000Z",
    canQueueOperations: true,
    canResynchronize: false,
  });
}

describe("DesktopOfflineLifecycle regression integration", () => {
  it("covers queue/cache replay, conflict visibility, contract parsing, and startup recovery posture", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-lifecycle-regression-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });
    const authoritativePort = new RegressionAuthoritativePort();
    const eventSink = new RecordingOfflineOperationalSink();
    const nowIso = "2026-04-08T12:30:00.000Z";
    const now = () => new Date(nowIso);

    const runtime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort,
      connectivityStatePort: new StaticConnectivityPort(createConnectedState()),
      supportsProtectedAtRestStorage: true,
      eventSink,
      now,
    });
    let restartedRuntime: ReturnType<typeof createDesktopOfflineResynchronizationHostRuntime> | undefined;
    let runtimeDisposed = false;

    try {
      await runtime.pendingOperationRuntime.service.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:apply:1",
        targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
        targetResourceId: "run:intent:apply",
        intent: OfflineQueuedMutationIntents.createOrUpdateAuthoritative,
        baseAuthoritativeRevision: "run:rev:1",
        localMutationRevision: 1,
        queuedAt: "2026-04-08T12:10:00.000Z",
        divergenceDisclosureToken: "offline-warning:operation:apply:1",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/run-submissions/run:intent:apply",
          idempotencyKey: "idem:operation:apply:1",
          payload: Object.freeze({ operationId: "operation:apply:1" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });
      await runtime.pendingOperationRuntime.service.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        mutationId: "operation:conflict:1",
        targetResourceClass: OfflineResourceClasses.workflowDraft,
        targetResourceId: "workflow:draft:conflict",
        intent: OfflineQueuedMutationIntents.promoteLocalDraft,
        baseAuthoritativeRevision: "workflow:rev:1",
        localMutationRevision: 2,
        queuedAt: "2026-04-08T12:12:00.000Z",
        divergenceDisclosureToken: "offline-warning:operation:conflict:1",
        replayDescriptor: {
          method: "PATCH",
          path: "/v1/workflows/drafts/workflow:draft:conflict/promote",
          idempotencyKey: "idem:operation:conflict:1",
          payload: Object.freeze({ operationId: "operation:conflict:1" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    const localExecution = createOfflineLocalExecutionRecord({
      executionId: "execution:local:1",
      executionClass: OfflineLocalExecutionClasses.localWorkflowValidation,
      resourceClass: OfflineResourceClasses.localRuntimeSession,
      resourceId: "runtime:session:1",
      startedAt: "2026-04-08T12:13:00.000Z",
      completedAt: "2026-04-08T12:13:12.000Z",
      executedByActorUserIdentityId: "user:alpha",
      nodeOperationalMode: OfflineNodeOperationalModes.workstationClient,
      workstationMode: OfflineWorkstationModes.interactiveUserSession,
      outcome: OfflineLocalExecutionOutcomes.succeeded,
      inputDigest: "sha256:input:1",
      outputs: [{
        outputId: "output:1",
        outputClass: OfflineLocalExecutionOutputClasses.metricsSnapshot,
        contentDigest: "sha256:output:1",
        sizeBytes: 128,
      }],
    });
      await runtime.localExecutionRegistrationRuntime.service.queueRegistration({
      registration: createOfflineLocalExecutionRegistrationEnvelope({
        registrationId: "registration:reject:1",
        execution: localExecution,
        queuedAt: "2026-04-08T12:13:30.000Z",
        userVisibleRegistrationStatus: OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration,
        divergenceDisclosureToken: "offline-warning:registration:reject:1",
        replayDescriptor: {
          method: "POST",
          path: "/v1/offline/local-executions/execution:local:1/register",
          idempotencyKey: "idem:registration:reject:1",
          payload: Object.freeze({ registrationId: "registration:reject:1" }),
        },
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

      await runtime.snapshotCacheRuntime.service.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.runSubmissionIntent,
      resourceId: "run:intent:apply",
      authoritativeRevision: "run:rev:1",
      snapshot: Object.freeze({ resourceId: "run:intent:apply", refreshed: false }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:08:00.000Z",
      lastSynchronizedAt: "2026-04-08T12:08:00.000Z",
    });
      await runtime.snapshotCacheRuntime.service.cacheSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:stale",
      authoritativeRevision: "workflow-def:rev:1",
      snapshot: Object.freeze({ resourceId: "workflow:def:stale", refreshed: false }),
      policy: createPolicy(),
      cachedByActorUserIdentityId: "user:alpha",
      cachedAt: "2026-04-08T12:08:30.000Z",
      lastSynchronizedAt: "2026-04-08T12:08:30.000Z",
    });

      const syncResult = await runtime.synchronizeWorkspace({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      requestId: "request:offline:lifecycle:1",
      syncAttemptId: "sync:lifecycle:1",
      attemptedAt: nowIso,
    });

    expect(syncResult.appliedOperationIds).toEqual(["operation:apply:1"]);
    expect(syncResult.replayedOperationIds).toEqual(["operation:apply:1"]);
    expect(syncResult.replayedRegistrationIds).toEqual(["registration:reject:1"]);
    expect(syncResult.invalidatedSnapshotKeys).toContain("workflow-definition::workflow:def:stale");
    expect(syncResult.refreshedSnapshotKeys).toContain("run-submission-intent::run:intent:apply");
    expect(syncResult.pendingOperationCleanupRecords).toEqual([
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

    const removedApplied = await runtime.pendingOperationRuntime.service.findQueuedOperation(
      "workspace:alpha",
      "operation:apply:1",
    );
    const retainedConflict = await runtime.pendingOperationRuntime.service.findQueuedOperation(
      "workspace:alpha",
      "operation:conflict:1",
    );
    const retainedRejectedRegistration = await runtime.localExecutionRegistrationRuntime.service.findQueuedRegistration(
      "workspace:alpha",
      "registration:reject:1",
    );
    const staleSnapshot = await runtime.snapshotCacheRuntime.service.getSnapshot({
      workspaceId: "workspace:alpha",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow:def:stale",
    });
    expect(removedApplied).toBeUndefined();
    expect(retainedConflict?.operation.userVisibleSyncStatus).toBe(OfflinePendingOperationStatuses.syncConflict);
    expect(retainedRejectedRegistration?.registration.userVisibleRegistrationStatus)
      .toBe(OfflineLocalExecutionRegistrationStatuses.registrationRejected);
    expect(staleSnapshot).toBeUndefined();

    const queueOperations = await runtime.pendingOperationRuntime.service.listQueuedOperations("workspace:alpha");
    const queueRegistrations = await runtime.localExecutionRegistrationRuntime.service
      .listQueuedRegistrations("workspace:alpha");
    const cachedSnapshots = await runtime.snapshotCacheRuntime.service.listWorkspaceSnapshots("workspace:alpha");

    const queueDto = toOfflineSyncQueueStateDto({
      queueId: "queue:workspace:alpha",
      operations: queueOperations.map((record) => toOfflinePendingOperationEnvelopeDto(record.operation, {
        retryCount: record.retryability.retryCount,
        lastAttemptedAt: record.retryability.lastAttemptedAt,
      })),
      localExecutionRegistrations: queueRegistrations.map((record) => toOfflineLocalExecutionRegistrationEnvelopeDto(
        record.registration,
        {
          retryCount: record.retryability.retryCount,
          lastAttemptedAt: record.retryability.lastAttemptedAt,
        },
      )),
      pendingRunSubmissions: queueOperations
        .filter((record) => record.pendingRunSubmission)
        .map((record) => record.pendingRunSubmission!)
        .map((submission) => Object.freeze({
          submissionId: submission.submissionId,
          operationId: submission.operationId,
          workflowDefinitionId: submission.workflowDefinitionId,
          inputDigest: submission.inputDigest,
          requestedAt: submission.requestedAt,
          requestedByActorUserIdentityId: submission.requestedByActorUserIdentityId,
        })),
      outcomes: syncResult.outcomes,
      updatedAt: nowIso,
    });
    const snapshotDto = toOfflineSynchronizationStateSnapshotDto({
      workspaceId: "workspace:alpha",
      cachedResources: cachedSnapshots.map((snapshot) => Object.freeze({
        resourceClass: snapshot.resourceClass,
        resourceId: snapshot.resourceId,
        authoritativeRevision: snapshot.authoritativeRevision,
        cachedRevision: snapshot.authoritativeSnapshotRevision,
        cachedAt: snapshot.cachedAt,
        freshness: "fresh",
      })),
      drafts: Object.freeze([{
        draftId: "draft:workflow:conflict:1",
        resourceClass: OfflineResourceClasses.workflowDraft,
        resourceId: "workflow:draft:conflict",
        baseAuthoritativeRevision: "workflow:rev:1",
        authoritativeSnapshotRevision: "workflow:rev:2",
        draftRevision: 2,
        syncStatus: OfflineDraftSyncStatuses.syncConflict,
        queuedMutationId: "operation:conflict:1",
        dirty: true,
        lastEditedAt: "2026-04-08T12:12:30.000Z",
        lastEditedByActorUserIdentityId: "user:alpha",
        localChanges: Object.freeze([{
          changeId: "change:workflow:conflict:1",
          draftId: "draft:workflow:conflict:1",
          resourceId: "workflow:draft:conflict",
          kind: OfflineLocalChangeKinds.update,
          changedAt: "2026-04-08T12:12:30.000Z",
          changedByActorUserIdentityId: "user:alpha",
          summary: "Local branch differs from authoritative baseline.",
        }]),
      }]),
      queue: queueDto,
      connectivity: createConnectedState(),
      lastAttemptedAt: nowIso,
    });

    const connectivityService = new DesktopConnectivityService();
    const parsedViaBridge = await connectivityService.getSynchronizationStateSnapshot({
      connectivity: {
        async getConnectivityState() {
          return JSON.stringify(createConnectedState());
        },
        async setOfflineMode() {
          return JSON.stringify(createConnectedState());
        },
        async getSynchronizationStateSnapshot() {
          return JSON.stringify(snapshotDto);
        },
      },
    });
    const parsedSnapshot = parseOfflineSynchronizationStateSnapshotDto(parsedViaBridge);
    const surfaceModel = buildDesktopOfflineStatusSurfaceModel(parsedSnapshot);

    expect(surfaceModel.banner.title).toBe("Connected with unsynced local changes");
    expect(surfaceModel.synchronization.conflictCount).toBeGreaterThan(0);
    expect(surfaceModel.replayOutcomes.rejectedCount).toBeGreaterThan(0);
    expect(surfaceModel.followUp.limitations.some((entry) => entry.includes("Unsupported auto-merge"))).toBeTrue();
    expect(surfaceModel.followUp.actions.find((entry) => entry.actionKey === "sync-conflicts")?.enabled).toBeTrue();

      await runtime.recoveryRepository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      syncAttemptId: "sync:interrupted:1",
      startedAt: "2026-04-08T12:35:00.000Z",
      });
      runtime.dispose();
      runtimeDisposed = true;

      restartedRuntime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort,
      connectivityStatePort: new StaticConnectivityPort(createDisconnectedState()),
      supportsProtectedAtRestStorage: true,
      now: () => new Date("2026-04-08T12:45:00.000Z"),
    });

      const startupRecovery = await restartedRuntime.recoverStartupState({
      workspaceId: "workspace:alpha",
      actorUserIdentityId: "user:alpha",
      autoRetryInterruptedResynchronization: true,
      checkedAt: "2026-04-08T12:45:00.000Z",
    });
    expect(startupRecovery.autoResynchronizationAttempted).toBeFalse();
    expect(startupRecovery.manualFollowUpOperationIds).toContain("operation:conflict:1");
    expect(startupRecovery.interruptedAttempts.map((entry) => entry.syncAttemptId)).toContain("sync:interrupted:1");
    expect(startupRecovery.actions.some((entry) => (
      entry.kind === "interrupted-resynchronization-retried" && entry.status === "manual-follow-up"
    ))).toBeTrue();

    expect(authoritativePort.replayedOperationIds).toEqual(["operation:apply:1"]);
    expect(authoritativePort.replayedRegistrationIds).toEqual(["registration:reject:1"]);
    expect(eventSink.events.some((event) => event.type === "conflict-detected")).toBeTrue();
    expect(eventSink.events.some((event) => event.type === "resynchronization-attempt-completed")).toBeTrue();
    } finally {
      restartedRuntime?.dispose();
      if (!runtimeDisposed) {
        runtime.dispose();
      }
    }
  });
});

import { describe, expect, it } from "bun:test";
import {
  type IOfflinePendingOperationRepository,
  OfflinePendingOperationDependencyKinds,
  OfflinePendingOperationRetryBackoffPolicies,
  type OfflinePendingOperationRecord,
  OfflinePendingOperationService,
} from "../OfflinePendingOperationPersistence";
import {
  createOfflineQueuedMutationEnvelope,
  OfflineQueuedMutationIntents,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
} from "@domain/platform/OfflineLocalModeBoundaries";

class InMemoryOfflinePendingOperationRepository implements IOfflinePendingOperationRepository {
  private readonly records = new Map<string, OfflinePendingOperationRecord>();

  public async upsertOperation(record: OfflinePendingOperationRecord): Promise<void> {
    this.records.set(this.makeKey(record.actorWorkspaceContext.workspaceId, record.operation.mutationId), record);
  }

  public async findOperation(
    workspaceId: string,
    operationId: string,
  ): Promise<OfflinePendingOperationRecord | undefined> {
    return this.records.get(this.makeKey(workspaceId, operationId));
  }

  public async listOperationsByWorkspace(workspaceId: string): Promise<ReadonlyArray<OfflinePendingOperationRecord>> {
    return Object.freeze(
      [...this.records.values()].filter((entry) => entry.actorWorkspaceContext.workspaceId === workspaceId),
    );
  }

  public async deleteOperation(workspaceId: string, operationId: string): Promise<boolean> {
    return this.records.delete(this.makeKey(workspaceId, operationId));
  }

  private makeKey(workspaceId: string, operationId: string): string {
    return `${workspaceId}::${operationId}`;
  }
}

function createQueuedOperation(input: {
  readonly operationId: string;
  readonly resourceClass?: (typeof OfflineResourceClasses)[keyof typeof OfflineResourceClasses];
  readonly resourceId?: string;
  readonly status?: (typeof OfflineQueuedMutationStatuses)[keyof typeof OfflineQueuedMutationStatuses];
  readonly queuedAt?: string;
}): ReturnType<typeof createOfflineQueuedMutationEnvelope> {
  return createOfflineQueuedMutationEnvelope({
    mutationId: input.operationId,
    targetResourceClass: input.resourceClass ?? OfflineResourceClasses.workflowDraft,
    targetResourceId: input.resourceId ?? `resource:${input.operationId}`,
    intent: OfflineQueuedMutationIntents.promoteLocalDraft,
    baseAuthoritativeRevision: "rev:1",
    localMutationRevision: 1,
    queuedAt: input.queuedAt ?? "2026-04-08T10:00:00.000Z",
    userVisibleSyncStatus: input.status ?? OfflineQueuedMutationStatuses.queuedPendingSync,
    divergenceDisclosureToken: `offline-warning:${input.operationId}`,
    replayDescriptor: {
      method: "PATCH",
      path: `/v1/workflows/drafts/${input.operationId}/promote`,
      idempotencyKey: `idem:${input.operationId}`,
      payload: {
        zeta: 3,
        alpha: 1,
      },
    },
  });
}

describe("OfflinePendingOperationService", () => {
  it("queues pending operations with canonical replay metadata and actor/workspace context", async () => {
    const repository = new InMemoryOfflinePendingOperationRepository();
    const service = new OfflinePendingOperationService(repository);

    const operation = createQueuedOperation({
      operationId: "operation:queue:1",
      queuedAt: "2026-04-08T10:00:00.000Z",
    });

    const record = await service.queueOperation({
      operation,
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 1,
        maxRetryCount: 4,
        backoffPolicy: OfflinePendingOperationRetryBackoffPolicies.fixed,
        nextEligibleReplayAt: "2026-04-08T10:05:00.000Z",
      },
    });

    expect(record.localStateScope).toBe("unsynced-local-pending");
    expect(record.actorWorkspaceContext.workspaceId).toBe("workspace:alpha");
    expect(record.actorWorkspaceContext.actorUserIdentityId).toBe("user:alpha");
    expect(record.canonicalReplayPayloadJson).toBe("{\"alpha\":1,\"zeta\":3}");
    expect(record.canonicalReplayPayloadDigest.length).toBeGreaterThan(10);
    expect(record.resourceBaseVersions[0]?.baseAuthoritativeRevision).toBe("rev:1");
  });

  it("prepares replay operations deterministically with dependency ordering and retryability gates", async () => {
    const repository = new InMemoryOfflinePendingOperationRepository();
    const service = new OfflinePendingOperationService(repository);

    await service.queueOperation({
      operation: createQueuedOperation({
        operationId: "operation:a",
        queuedAt: "2026-04-08T10:00:00.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
    });

    await service.queueOperation({
      operation: createQueuedOperation({
        operationId: "operation:b",
        queuedAt: "2026-04-08T10:00:01.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      dependencies: [{
        operationId: "operation:a",
        kind: OfflinePendingOperationDependencyKinds.replayAfterDependencyApplied,
      }],
    });

    await service.queueOperation({
      operation: createQueuedOperation({
        operationId: "operation:c",
        queuedAt: "2026-04-08T10:00:02.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 3,
        maxRetryCount: 3,
        backoffPolicy: OfflinePendingOperationRetryBackoffPolicies.exponential,
      },
    });

    await service.queueOperation({
      operation: createQueuedOperation({
        operationId: "operation:d",
        queuedAt: "2026-04-08T10:00:03.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:alpha",
        actorUserIdentityId: "user:alpha",
      },
      retryability: {
        retryable: true,
        retryCount: 0,
        maxRetryCount: 2,
        backoffPolicy: OfflinePendingOperationRetryBackoffPolicies.fixed,
        nextEligibleReplayAt: "2026-04-08T11:00:00.000Z",
      },
    });

    const prepared = await service.prepareReplayOperations({
      workspaceId: "workspace:alpha",
      preparedAt: "2026-04-08T10:10:00.000Z",
    });

    expect(prepared.prepared.map((entry) => entry.operationId)).toEqual(["operation:a", "operation:b"]);
    expect(prepared.prepared[1]?.dependencies[0]?.operationId).toBe("operation:a");

    const blockedReasonsByOperationId = new Map(prepared.blocked.map((entry) => [entry.operationId, entry.reasonCode]));
    expect(blockedReasonsByOperationId.get("operation:c")).toBe("retry-exhausted");
    expect(blockedReasonsByOperationId.get("operation:d")).toBe("retry-not-eligible");
  });

  it("stores run submission metadata for run-submission-intent operations", async () => {
    const repository = new InMemoryOfflinePendingOperationRepository();
    const service = new OfflinePendingOperationService(repository);

    const operation = createOfflineQueuedMutationEnvelope({
      mutationId: "operation:submission:1",
      targetResourceClass: OfflineResourceClasses.runSubmissionIntent,
      targetResourceId: "run:intent:1",
      intent: OfflineQueuedMutationIntents.createOrUpdateAuthoritative,
      baseAuthoritativeRevision: "run-intent:rev:1",
      localMutationRevision: 1,
      queuedAt: "2026-04-08T10:20:00.000Z",
      userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
      divergenceDisclosureToken: "offline-warning:run:intent:1",
      replayDescriptor: {
        method: "POST",
        path: "/v1/runs/intents/run:intent:1",
        idempotencyKey: "idem:operation:submission:1",
        payload: {
          workflowDefinitionId: "workflow:definition:1",
          inputDigest: "sha256:input:1",
        },
      },
    });

    const record = await service.queueOperation({
      operation,
      actorWorkspaceContext: {
        workspaceId: "workspace:beta",
        actorUserIdentityId: "user:beta",
      },
      pendingRunSubmission: {
        submissionId: "submission:1",
        workflowDefinitionId: "workflow:definition:1",
        inputDigest: "sha256:input:1",
        requestedAt: "2026-04-08T10:20:00.000Z",
        requestedByActorUserIdentityId: "user:beta",
      },
    });

    expect(record.pendingRunSubmission?.submissionId).toBe("submission:1");
    expect(record.pendingRunSubmission?.requestedByActorUserIdentityId).toBe("user:beta");
  });

  it("updates queued operation sync status for explicit replay outcomes", async () => {
    const repository = new InMemoryOfflinePendingOperationRepository();
    const service = new OfflinePendingOperationService(repository);

    await service.queueOperation({
      operation: createQueuedOperation({
        operationId: "operation:outcome:1",
        queuedAt: "2026-04-08T10:30:00.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:gamma",
        actorUserIdentityId: "user:gamma",
      },
    });

    const conflicted = await service.markOperationReplayOutcome({
      workspaceId: "workspace:gamma",
      operationId: "operation:outcome:1",
      nextStatus: OfflineQueuedMutationStatuses.syncConflict,
      attemptedAt: "2026-04-08T10:35:00.000Z",
      incrementRetryCount: true,
    });

    expect(conflicted.operation.userVisibleSyncStatus).toBe(OfflineQueuedMutationStatuses.syncConflict);
    expect(conflicted.retryability.retryCount).toBe(1);
    expect(conflicted.retryability.lastAttemptedAt).toBe("2026-04-08T10:35:00.000Z");

    const removed = await service.markOperationAsApplied("workspace:gamma", "operation:outcome:1");
    expect(removed).toBeTrue();
    const found = await service.findQueuedOperation("workspace:gamma", "operation:outcome:1");
    expect(found).toBeUndefined();
  });
});

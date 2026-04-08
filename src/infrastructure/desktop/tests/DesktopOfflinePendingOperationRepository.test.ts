import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  OfflinePendingOperationService,
  OfflinePendingOperationRetryBackoffPolicies,
} from "@application/common/OfflinePendingOperationPersistence";
import {
  createOfflineQueuedMutationEnvelope,
  OfflineQueuedMutationIntents,
  OfflineQueuedMutationStatuses,
  OfflineResourceClasses,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { DesktopOfflinePendingOperationRepository } from "../DesktopOfflinePendingOperationRepository";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function createOperationEnvelope(operationId: string): ReturnType<typeof createOfflineQueuedMutationEnvelope> {
  return createOfflineQueuedMutationEnvelope({
    mutationId: operationId,
    targetResourceClass: OfflineResourceClasses.workflowDraft,
    targetResourceId: `workflow:draft:${operationId}`,
    intent: OfflineQueuedMutationIntents.promoteLocalDraft,
    baseAuthoritativeRevision: "rev:9",
    localMutationRevision: 2,
    queuedAt: "2026-04-08T12:00:00.000Z",
    userVisibleSyncStatus: OfflineQueuedMutationStatuses.queuedPendingSync,
    divergenceDisclosureToken: `offline-warning:${operationId}`,
    replayDescriptor: {
      method: "PATCH",
      path: `/v1/workflows/drafts/${operationId}/promote`,
      idempotencyKey: `idem:${operationId}`,
      payload: {
        beta: true,
        alpha: "value",
      },
    },
  });
}

describe("DesktopOfflinePendingOperationRepository", () => {
  it("persists pending operation records across repository restart with replay metadata intact", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-pending-operation-"));
    tempRoots.push(root);
    const databasePath = path.join(root, "offline-pending-operation.sqlite");

    const repository = new DesktopOfflinePendingOperationRepository({
      databasePath,
      maxEntries: 100,
    });
    const service = new OfflinePendingOperationService(repository);

    await service.queueOperation({
      operation: createOperationEnvelope("operation:persist:1"),
      actorWorkspaceContext: {
        workspaceId: "workspace:persist",
        actorUserIdentityId: "user:persist",
      },
      retryability: {
        retryable: true,
        retryCount: 1,
        maxRetryCount: 5,
        backoffPolicy: OfflinePendingOperationRetryBackoffPolicies.exponential,
        lastAttemptedAt: "2026-04-08T12:01:00.000Z",
      },
    });

    repository.dispose();

    const reopened = new DesktopOfflinePendingOperationRepository({
      databasePath,
      maxEntries: 100,
    });
    const loaded = await reopened.findOperation("workspace:persist", "operation:persist:1");

    expect(loaded).toBeDefined();
    expect(loaded?.actorWorkspaceContext.workspaceId).toBe("workspace:persist");
    expect(loaded?.actorWorkspaceContext.actorUserIdentityId).toBe("user:persist");
    expect(loaded?.operation.replayDescriptor.path).toContain("/promote");
    expect(loaded?.canonicalReplayPayloadJson).toBe("{\"alpha\":\"value\",\"beta\":true}");
    expect(loaded?.retryability.retryCount).toBe(1);
    reopened.dispose();
  });

  it("enforces retention bound when pending operation count exceeds configured max entries", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-pending-operation-retention-"));
    tempRoots.push(root);

    const repository = new DesktopOfflinePendingOperationRepository({
      databasePath: path.join(root, "offline-pending-operation.sqlite"),
      maxEntries: 2,
    });
    const service = new OfflinePendingOperationService(repository);

    await service.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        ...createOperationEnvelope("operation:retention:1"),
        queuedAt: "2026-04-08T12:00:01.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });

    await service.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        ...createOperationEnvelope("operation:retention:2"),
        queuedAt: "2026-04-08T12:00:02.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });

    await service.queueOperation({
      operation: createOfflineQueuedMutationEnvelope({
        ...createOperationEnvelope("operation:retention:3"),
        queuedAt: "2026-04-08T12:00:03.000Z",
      }),
      actorWorkspaceContext: {
        workspaceId: "workspace:retention",
        actorUserIdentityId: "user:retention",
      },
    });

    const operations = await repository.listOperationsByWorkspace("workspace:retention");
    expect(operations.length).toBe(2);
    expect(operations.map((entry) => entry.operation.mutationId)).toEqual([
      "operation:retention:2",
      "operation:retention:3",
    ]);

    repository.dispose();
  });
});

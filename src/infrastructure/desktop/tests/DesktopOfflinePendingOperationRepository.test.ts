import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
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
import {
  DesktopOfflineValueProtectionPostures,
  type DesktopOfflineValueProtectionPort,
} from "../DesktopOfflineValueProtection";

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

  it("protects persisted pending-operation payload fields when local protected storage is available", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-pending-operation-protection-"));
    tempRoots.push(root);
    const databasePath = path.join(root, "offline-pending-operation.sqlite");
    const valueProtection: DesktopOfflineValueProtectionPort = Object.freeze({
      posture: DesktopOfflineValueProtectionPostures.protectedAtRest,
      protect: (value: string) => `enc::${Buffer.from(value, "utf8").toString("base64")}`,
      unprotect: (value: string) => {
        if (!value.startsWith("enc::")) {
          return value;
        }
        return Buffer.from(value.slice("enc::".length), "base64").toString("utf8");
      },
    });

    const repository = new DesktopOfflinePendingOperationRepository({
      databasePath,
      maxEntries: 100,
      valueProtection,
    });
    const service = new OfflinePendingOperationService(repository);

    await service.queueOperation({
      operation: createOperationEnvelope("operation:protected:1"),
      actorWorkspaceContext: {
        workspaceId: "workspace:protected",
        actorUserIdentityId: "user:protected",
      },
    });

    const db = new Database(databasePath, { readonly: true });
    const row = db.prepare(`
      SELECT operation_envelope_json, canonical_replay_payload_json, payload_protection_posture
      FROM offline_pending_operations
      WHERE workspace_id = ? AND operation_id = ?
    `).get("workspace:protected", "operation:protected:1") as {
      readonly operation_envelope_json: string;
      readonly canonical_replay_payload_json: string;
      readonly payload_protection_posture: string;
    };
    db.close();

    expect(row.payload_protection_posture).toBe("protected-at-rest");
    expect(row.operation_envelope_json.startsWith("enc::")).toBeTrue();
    expect(row.canonical_replay_payload_json.startsWith("enc::")).toBeTrue();
    expect(row.operation_envelope_json).not.toContain("/promote");
    expect(row.canonical_replay_payload_json).not.toContain("\"alpha\":\"value\"");

    repository.dispose();
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

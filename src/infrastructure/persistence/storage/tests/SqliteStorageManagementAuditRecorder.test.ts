import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { SqliteStorageManagementAuditRecorder } from "../SqliteStorageManagementAuditRecorder";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqliteStorageManagementAuditRecorder", () => {
  it("persists and queries storage management audit events by recency, workspace, and storage instance", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-management-audit-"));
    createdRoots.push(root);
    const recorder = new SqliteStorageManagementAuditRecorder(path.join(root, "storage-audit.sqlite"));

    await recorder.recordStorageManagementEvent({
      type: "storage-created",
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      correlationId: "corr-storage-create-alpha",
      occurredAt: "2026-04-06T12:00:00.000Z",
      outcome: "success",
      details: Object.freeze({
        backendType: "managed-filesystem",
      }),
    });
    await recorder.recordStorageManagementEvent({
      type: "storage-policy-updated",
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      correlationId: "corr-storage-policy-alpha",
      occurredAt: "2026-04-06T12:10:00.000Z",
      outcome: "success",
      details: Object.freeze({
        changedPolicyLabelKeys: Object.freeze(["tier"]),
      }),
    });
    await recorder.recordStorageManagementEvent({
      type: "storage-created",
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-beta",
      storageInstanceId: "storage-beta",
      occurredAt: "2026-04-06T12:05:00.000Z",
      outcome: "success",
    });

    const recent = recorder.listRecent(10);
    expect(recent).toHaveLength(3);
    expect(recent[0]?.type).toBe("storage-policy-updated");

    const byStorage = recorder.listByStorageInstanceId("storage-alpha", 10);
    expect(byStorage).toHaveLength(2);
    expect(byStorage.every((event) => event.storageInstanceId === "storage-alpha")).toBeTrue();

    const byWorkspace = recorder.listByWorkspaceId("workspace-alpha", 10);
    expect(byWorkspace).toHaveLength(2);
    expect(byWorkspace.every((event) => event.workspaceId === "workspace-alpha")).toBeTrue();

    recorder.dispose();
  });
});

import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DesktopOfflineResynchronizationRecoveryRepository } from "../DesktopOfflineResynchronizationRecoveryRepository";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOfflineResynchronizationRecoveryRepository", () => {
  it("persists started/completed attempt markers across repository restart", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-resync-recovery-"));
    tempRoots.push(root);
    const databasePath = path.join(root, "offline-resync-recovery.sqlite");

    const repository = new DesktopOfflineResynchronizationRecoveryRepository({
      databasePath,
      maxEntries: 100,
    });
    await repository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:1",
      actorUserIdentityId: "user:alpha",
      requestId: "request:1",
      startedAt: "2026-04-08T12:00:00.000Z",
    });
    await repository.markAttemptCompleted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:1",
      completedAt: "2026-04-08T12:01:00.000Z",
      completionOutcome: "succeeded",
    });
    await repository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:interrupted",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:02:00.000Z",
    });
    repository.dispose();

    const reopened = new DesktopOfflineResynchronizationRecoveryRepository({
      databasePath,
      maxEntries: 100,
    });
    const all = await reopened.listAttemptsByWorkspace("workspace:alpha");
    const interrupted = await reopened.listInterruptedAttempts("workspace:alpha");

    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({
      syncAttemptId: "sync:interrupted",
      status: "started",
    });
    expect(all[1]).toMatchObject({
      syncAttemptId: "sync:1",
      status: "completed",
      completionOutcome: "succeeded",
    });
    expect(interrupted).toEqual([
      expect.objectContaining({
        syncAttemptId: "sync:interrupted",
        status: "started",
      }),
    ]);
    reopened.dispose();
  });

  it("enforces retention bound for resynchronization attempt markers", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-resync-recovery-retention-"));
    tempRoots.push(root);
    const repository = new DesktopOfflineResynchronizationRecoveryRepository({
      databasePath: path.join(root, "offline-resync-recovery.sqlite"),
      maxEntries: 2,
    });

    await repository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:1",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:00:00.000Z",
    });
    await repository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:2",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:01:00.000Z",
    });
    await repository.markAttemptStarted({
      workspaceId: "workspace:alpha",
      syncAttemptId: "sync:3",
      actorUserIdentityId: "user:alpha",
      startedAt: "2026-04-08T12:02:00.000Z",
    });

    const attempts = await repository.listAttemptsByWorkspace("workspace:alpha");
    expect(attempts.map((entry) => entry.syncAttemptId)).toEqual(["sync:3", "sync:2"]);
    repository.dispose();
  });
});

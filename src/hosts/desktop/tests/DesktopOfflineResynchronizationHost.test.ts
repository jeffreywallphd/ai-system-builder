import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthoritativeReplayExecutionResultKinds,
  type IOfflineAuthoritativeResynchronizationPort,
} from "@application/common/OfflineControlledResynchronizationCoordinator";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflineResynchronizationHostRuntime } from "../DesktopOfflineResynchronizationHost";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

class NoopAuthoritativePort implements IOfflineAuthoritativeResynchronizationPort {
  public async fetchResourceRevisions(_input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceRevisions"]>[0]) {
    return Object.freeze([]);
  }

  public async replayPreparedOperation(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["replayPreparedOperation"]>[0],
  ) {
    return Object.freeze({
      kind: AuthoritativeReplayExecutionResultKinds.failed,
      reason: "noop",
    });
  }

  public async fetchResourceSnapshotForCache(
    _input: Parameters<IOfflineAuthoritativeResynchronizationPort["fetchResourceSnapshotForCache"]>[0],
  ) {
    return undefined;
  }
}

describe("DesktopOfflineResynchronizationHost", () => {
  it("creates desktop controlled resynchronization runtime composition", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-resync-host-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineResynchronizationHostRuntime({
      storagePaths,
      authoritativePort: new NoopAuthoritativePort(),
      supportsProtectedAtRestStorage: true,
    });

    expect(runtime.coordinator).toBeDefined();
    expect(runtime.pendingOperationRuntime.databasePath).toContain("offline-pending-operation-queue.sqlite");
    expect(runtime.snapshotCacheRuntime.databasePath).toContain("offline-authoritative-snapshot-cache.sqlite");
    runtime.dispose();
  });
});

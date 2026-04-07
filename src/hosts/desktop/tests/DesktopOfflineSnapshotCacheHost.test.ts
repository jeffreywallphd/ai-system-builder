import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflineSnapshotCacheHostRuntime } from "../DesktopOfflineSnapshotCacheHost";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOfflineSnapshotCacheHost", () => {
  it("creates desktop offline snapshot cache runtime with bounded repository", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-cache-host-"));
    tempRoots.push(root);
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineSnapshotCacheHostRuntime({
      storagePaths,
      maxEntries: 250,
      supportsProtectedAtRestStorage: false,
    });

    expect(runtime.databasePath).toContain("offline-authoritative-snapshot-cache.sqlite");
    expect(runtime.repository.getCapabilities().maxEntries).toBe(250);
    expect(runtime.repository.getCapabilities().supportsProtectedAtRestStorage).toBeFalse();
    runtime.dispose();
  });
});

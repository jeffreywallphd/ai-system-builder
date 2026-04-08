import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflinePendingOperationHostRuntime } from "../DesktopOfflinePendingOperationHost";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOfflinePendingOperationHost", () => {
  it("creates desktop pending-operation host runtime with durable repository", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-pending-operation-host-"));
    tempRoots.push(root);

    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflinePendingOperationHostRuntime({
      storagePaths,
      maxEntries: 321,
    });

    expect(runtime.databasePath).toContain("offline-pending-operation-queue.sqlite");
    expect(runtime.service).toBeDefined();
    runtime.dispose();
  });
});

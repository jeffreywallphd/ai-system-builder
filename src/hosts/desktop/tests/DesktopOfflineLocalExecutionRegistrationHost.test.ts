import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDesktopStoragePaths } from "@infrastructure/desktop/DesktopAppPaths";
import { createDesktopOfflineLocalExecutionRegistrationHostRuntime } from "../DesktopOfflineLocalExecutionRegistrationHost";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopOfflineLocalExecutionRegistrationHost", () => {
  it("creates desktop local-execution-registration host runtime with durable repository", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-desktop-offline-local-exec-registration-host-"));
    tempRoots.push(root);

    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: path.join(root, "user-data"),
      logsPath: path.join(root, "logs"),
    });

    const runtime = createDesktopOfflineLocalExecutionRegistrationHostRuntime({
      storagePaths,
      maxEntries: 321,
    });

    expect(runtime.databasePath).toContain("offline-local-execution-registration-queue.sqlite");
    expect(runtime.service).toBeDefined();
    runtime.dispose();
  });
});

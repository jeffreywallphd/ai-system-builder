import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDesktopStoragePaths } from "../DesktopAppPaths";
import { DesktopStorageDatabase } from "../DesktopStorageDatabase";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopStorageDatabase", () => {
  it("creates production storage directories and persists values", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-storage-test-"));
    tempRoots.push(root);

    const database = new DesktopStorageDatabase({
      paths: resolveDesktopStoragePaths({
        userDataPath: path.join(root, "user-data"),
        logsPath: path.join(root, "logs"),
      }),
    });

    const result = await database.initialize();
    database.setItem("settings", JSON.stringify({ theme: "dark" }));

    expect(fs.existsSync(result.databasePath)).toBe(true);
    expect(result.createdDirectories.length).toBeGreaterThan(0);
    expect(database.getItem("settings")).toContain("dark");

    database.removeItem("settings");
    expect(database.getItem("settings")).toBeNull();
    database.dispose();
  });
});

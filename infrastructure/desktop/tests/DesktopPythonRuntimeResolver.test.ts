import { describe, expect, it } from "bun:test";
import { resolveDesktopPythonRuntime } from "../DesktopPythonRuntimeResolver";

const storagePaths = {
  appDataDirectory: "/tmp/appdata",
  storageDirectory: "/tmp/appdata/storage",
  databasePath: "/tmp/appdata/storage/app.sqlite",
  runtimeDirectory: "/tmp/appdata/runtime",
  logsDirectory: "/tmp/appdata/logs",
  modelsDirectory: "/tmp/appdata/models",
  assetsDirectory: "/tmp/appdata/assets",
} as const;

describe("resolveDesktopPythonRuntime", () => {
  it("keeps development resolution rooted in the repository", () => {
    const resolved = resolveDesktopPythonRuntime({
      isPackaged: false,
      repoRoot: "/repo",
      resourcesPath: "/resources",
      storagePaths,
    });

    expect(resolved.mode).toBe("development-local");
    expect(resolved.runtimeRoot).toBe("/repo/python-runtime");
    expect(resolved.workspaceDirectory).toBe("/repo/python-runtime");
    expect(resolved.isAvailable).toBe(true);
  });

  it("uses packaged-private runtime locations for packaged builds", () => {
    const resolved = resolveDesktopPythonRuntime({
      isPackaged: true,
      repoRoot: "/repo",
      resourcesPath: "/resources",
      storagePaths,
    });

    expect(resolved.mode).toBe("packaged-private");
    expect(resolved.runtimeRoot).toContain("/resources/runtime-assets/python/");
    expect(resolved.workspaceDirectory).toBe("/tmp/appdata/runtime");
  });
});

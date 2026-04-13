import { describe, expect, it } from "bun:test";
import { resolvePythonRuntimeActivationStage } from "../runtime/PythonRuntimeResolutionActivationStage";

function createStoragePaths() {
  return Object.freeze({
    appDataDirectory: "app-data",
    storageDirectory: "storage",
    databasePath: "storage/db.sqlite",
    runtimeDirectory: "storage/runtime",
    logsDirectory: "storage/logs",
    modelsDirectory: "storage/models",
    assetsDirectory: "storage/assets",
  });
}

describe("resolvePythonRuntimeActivationStage", () => {
  it("marks python runtime resolution running and ready when resolution succeeds", () => {
    const operations: string[] = [];
    const resolved = resolvePythonRuntimeActivationStage({
      isPackaged: false,
      repoRoot: "repo-root",
      storagePaths: createStoragePaths(),
      bootstrapStartedAt: Date.now(),
      postLoginRuntimeStatusStore: {
        markPythonRuntimeResolutionRunning: () => operations.push("stage:running"),
        markPythonRuntimeResolutionReady: (metadata) => operations.push(`stage:ready:${metadata?.detail}`),
        markPythonRuntimeResolutionBlocked: () => operations.push("stage:blocked"),
      } as never,
      resolvePythonRuntime: ({ isPackaged }) => Object.freeze({
        mode: isPackaged ? "packaged-private" : "development-local",
        executablePath: "python",
        runtimeRoot: "python-runtime",
        workspaceDirectory: "python-runtime",
        isAvailable: true,
      }),
    });

    expect(resolved).toMatchObject({
      mode: "development-local",
      isAvailable: true,
    });
    expect(operations).toEqual([
      "stage:running",
      "stage:ready:mode=development-local, available=true",
    ]);
  });

  it("marks python runtime resolution blocked and rethrows when resolution fails", () => {
    const operations: string[] = [];
    const failure = new Error("python executable not found");
    expect(() => resolvePythonRuntimeActivationStage({
      isPackaged: true,
      repoRoot: "repo-root",
      storagePaths: createStoragePaths(),
      bootstrapStartedAt: Date.now(),
      postLoginRuntimeStatusStore: {
        markPythonRuntimeResolutionRunning: () => operations.push("stage:running"),
        markPythonRuntimeResolutionReady: () => operations.push("stage:ready"),
        markPythonRuntimeResolutionBlocked: (error) => {
          const message = error instanceof Error ? error.message : "unknown";
          operations.push(`stage:blocked:${message}`);
        },
      } as never,
      resolvePythonRuntime: () => {
        throw failure;
      },
    })).toThrow("python executable not found");

    expect(operations).toEqual([
      "stage:running",
      "stage:blocked:python executable not found",
    ]);
  });
});

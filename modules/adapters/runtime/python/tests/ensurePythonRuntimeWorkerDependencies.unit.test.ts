import type { SpawnSyncReturns } from "node:child_process";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { ensurePythonRuntimeWorkerDependencies } from "../ensurePythonRuntimeWorkerDependencies";

function createSpawnSyncResult(overrides: Partial<SpawnSyncReturns<string>> = {}): SpawnSyncReturns<string> {
  return {
    pid: 123,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    error: undefined,
    ...overrides,
  };
}

describe("ensurePythonRuntimeWorkerDependencies", () => {
  it("returns without install when runtime dependencies are already available", () => {
    const spawnSyncImplementation = testDouble.fn(() => createSpawnSyncResult());

    ensurePythonRuntimeWorkerDependencies({
      command: "python",
      spawnSyncImplementation: spawnSyncImplementation as any,
    });

    expect(spawnSyncImplementation).toHaveBeenCalledTimes(1);
    expect(spawnSyncImplementation).toHaveBeenCalledWith(
      "python",
      ["-c", "import fastapi, uvicorn"],
      expect.any(Object),
    );
  });

  it("installs dependencies when fastapi is missing", () => {
    const responses = [
      createSpawnSyncResult({
        status: 1,
        stderr: "ModuleNotFoundError: No module named 'fastapi'",
      }),
      createSpawnSyncResult({ status: 0 }),
    ];
    const spawnSyncImplementation = testDouble.fn(() => responses.shift() ?? createSpawnSyncResult({ status: 0 }));

    ensurePythonRuntimeWorkerDependencies({
      command: "python",
      cwd: "modules/adapters/runtime/python/worker",
      spawnSyncImplementation: spawnSyncImplementation as any,
    });

    expect(spawnSyncImplementation).toHaveBeenCalledTimes(2);
    expect(spawnSyncImplementation.mock.calls[1]?.[0]).toBe("python");
    expect(spawnSyncImplementation.mock.calls[1]?.[1]).toEqual([
      "-m",
      "pip",
      "install",
      "-r",
      "requirements.txt",
    ]);
  });

  it("throws when dependency installation fails", () => {
    const responses = [
      createSpawnSyncResult({
        status: 1,
        stderr: "ModuleNotFoundError: No module named 'fastapi'",
      }),
      createSpawnSyncResult({
        status: 1,
        stderr: "ERROR: Could not find a version that satisfies the requirement fastapi",
      }),
    ];
    const spawnSyncImplementation = testDouble.fn(() => responses.shift() ?? createSpawnSyncResult({ status: 1 }));

    expect(() =>
      ensurePythonRuntimeWorkerDependencies({
        command: "python",
        spawnSyncImplementation: spawnSyncImplementation as any,
      })).toThrow("Failed to install Python runtime worker dependencies");
  });
});

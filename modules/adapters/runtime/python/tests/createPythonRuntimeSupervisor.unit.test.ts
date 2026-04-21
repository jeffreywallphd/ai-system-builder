import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createPythonRuntimeSupervisor } from "../supervisor/createPythonRuntimeSupervisor";

function createMockChildProcess() {
  const emitter = new EventEmitter() as EventEmitter & {
    kill: (signal?: string) => boolean;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.kill = () => {
    queueMicrotask(() => {
      emitter.emit("exit", 0, "SIGTERM");
    });

    return true;
  };

  return emitter;
}

describe("createPythonRuntimeSupervisor", () => {
  it("starts and transitions to ready after health probing", async () => {
    const child = createMockChildProcess();
    const spawnImplementation = testDouble.fn(() => child as any);
    const getHealthStatus = testDouble
      .fn(async () => ({
        healthy: true,
        status: {
          runtimeId: "python-sidecar",
          status: "ready",
        },
      }));

    const supervisor = createPythonRuntimeSupervisor({
      command: "python",
      args: ["main.py"],
      runtimeClient: { getHealthStatus },
      spawnImplementation: spawnImplementation as any,
      startupTimeoutMs: 100,
      healthCheckIntervalMs: 1,
    });

    await supervisor.start();

    expect(supervisor.getStatus()).toBe("ready");
    expect(spawnImplementation).toHaveBeenCalledOnce();
    expect(getHealthStatus).toHaveBeenCalled();
  });

  it("stops the process and marks status stopped", async () => {
    const child = createMockChildProcess();
    const supervisor = createPythonRuntimeSupervisor({
      command: "python",
      args: ["main.py"],
      runtimeClient: {
        getHealthStatus: async () => ({
          healthy: true,
          status: { runtimeId: "python-sidecar", status: "ready" },
        }),
      },
      spawnImplementation: (() => child as any) as any,
      startupTimeoutMs: 100,
      healthCheckIntervalMs: 1,
    });

    await supervisor.start();
    await supervisor.stop();

    expect(supervisor.getStatus()).toBe("stopped");
  });

  it("fails fast with runtime output when process exits during startup", async () => {
    const child = createMockChildProcess();
    const getHealthStatus = testDouble.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      throw new Error("runtime unavailable");
    });
    const supervisor = createPythonRuntimeSupervisor({
      command: "python",
      args: ["main.py"],
      runtimeClient: { getHealthStatus },
      spawnImplementation: (() => child as any) as any,
      startupTimeoutMs: 100,
      healthCheckIntervalMs: 1,
    });

    queueMicrotask(() => {
      child.stderr.write("ImportError: attempted relative import with no known parent package");
      child.emit("exit", 1, null);
    });

    await expect(supervisor.start()).rejects.toThrow(
      "Python runtime exited before health check completed. Recent runtime output: ImportError",
    );
  });
});

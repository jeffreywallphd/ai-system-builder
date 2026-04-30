import { EventEmitter } from "node:events";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createComfyUiRuntimeSupervisor } from "../createComfyUiRuntimeSupervisor";

function createMockChildProcess() {
  const emitter = new EventEmitter() as EventEmitter & { kill: (signal?: string) => boolean };
  emitter.kill = testDouble.fn(() => true);
  return emitter;
}

describe("createComfyUiRuntimeSupervisor", () => {
  it("start is idempotent and does not spawn multiple processes", async () => {
    const spawnImplementation = testDouble.fn(() => createMockChildProcess() as any);
    const fetchImplementation = testDouble.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ devices: [] }),
    });
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: fetchImplementation as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 200,
    });

    await supervisor.start();
    await supervisor.start();

    expect(spawnImplementation).toHaveBeenCalledOnce();
  });

  it("transitions health states", async () => {
    const spawnImplementation = testDouble.fn(() => createMockChildProcess() as any);
    let call = 0;
    const fetchImplementation = testDouble.fn(async () => {
      call += 1;
      if (call < 2) {
        throw new Error("not ready");
      }
      return { ok: true, status: 200, json: async () => ({ devices: [] }) };
    });
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: fetchImplementation as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 50,
    });

    await supervisor.start();
    const health = await supervisor.getHealth();
    expect(health.status).toBe("ready");
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain("/system_stats");
  });

  it("kills process and marks unhealthy when startup times out", async () => {
    const mockChild = createMockChildProcess();
    const spawnImplementation = testDouble.fn(() => mockChild as any);
    const fetchImplementation = testDouble.fn(async () => {
      throw new Error("still booting");
    });
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: fetchImplementation as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 5,
    });

    await expect(supervisor.start()).rejects.toThrow("failed to become ready");
    expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    expect(supervisor.isRunning()).toBe(false);
    const health = await supervisor.getHealth();
    expect(health).toMatchObject({ status: "stopped" });
  });
});

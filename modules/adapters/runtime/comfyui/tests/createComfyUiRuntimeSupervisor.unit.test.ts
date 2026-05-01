import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { createComfyUiRuntimeSupervisor } from "../createComfyUiRuntimeSupervisor";

function createMockChildProcess() {
  const emitter = new EventEmitter() as EventEmitter & {
    kill: (signal?: string) => boolean;
    stdout: PassThrough;
    stderr: PassThrough;
  };
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
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

  it("emits shared structured runtime log events", async () => {
    const spawnImplementation = testDouble.fn(() => createMockChildProcess() as any);
    const fetchImplementation = testDouble.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ devices: [] }),
    });
    const log = testDouble.fn();
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: fetchImplementation as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 200,
      logging: { log },
    });

    await supervisor.start();

    expect(log).toHaveBeenCalled();
    const event = log.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(event).toMatchObject({
      level: "info",
      verbosity: "normal",
      event: "runtime.comfyui.supervisor.activity",
      component: "comfyui-runtime-supervisor",
      subsystem: "runtime",
      data: {
        pythonExecutable: "python",
        spawnWorkingDirectory: "/tmp/comfyui",
        host: "127.0.0.1",
        port: 8188,
      },
    });
    expect(event.context).toBeUndefined();
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

  it("fails startup without timeout cleanup when the process exits before health checks complete", async () => {
    const mockChild = createMockChildProcess();
    const spawnImplementation = testDouble.fn(() => mockChild as any);
    const fetchImplementation = testDouble.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      throw new Error("still booting");
    });
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: fetchImplementation as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 100,
    });

    queueMicrotask(() => {
      mockChild.stderr.write("ModuleNotFoundError: No module named 'torch'");
      mockChild.emit("exit", 1, null);
    });

    await expect(supervisor.start()).rejects.toThrow(
      /ComfyUI runtime exited before health check completed\.[\s\S]*Recent runtime output: ModuleNotFoundError/,
    );
    expect(mockChild.kill).not.toHaveBeenCalled();
  });

  it("fails startup clearly when spawning throws synchronously", async () => {
    const spawnImplementation = testDouble.fn(() => {
      throw new Error("spawn EPERM");
    });
    const supervisor = createComfyUiRuntimeSupervisor({
      workingDirectory: "/tmp/comfyui",
      spawnImplementation: spawnImplementation as never,
      fetchImplementation: testDouble.fn() as never,
      healthCheckIntervalMs: 1,
      startupTimeoutMs: 100,
    });

    await expect(supervisor.start()).rejects.toThrow("ComfyUI runtime failed during startup. ComfyUI runtime process failed to start: spawn EPERM");
  });
});

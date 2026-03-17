import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { NodeProcessRuntimeEventSink } from "../NodeProcessRuntimeEventSink";
import { PythonRuntimeLauncher } from "../PythonRuntimeLauncher";
import { PythonRuntimeProcessManager } from "../PythonRuntimeProcessManager";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";

function createProcessStub() {
  const handlers: Record<string, ((...args: any[]) => void)[]> = {};
  const streamHandlers: Record<string, ((chunk: unknown) => void)[]> = {};

  return {
    process: {
      on: (event: "error" | "exit", listener: (...args: any[]) => void) => {
        handlers[event] = [...(handlers[event] ?? []), listener];
      },
      kill: () => true,
      stdout: { on: (_: "data", listener: (chunk: unknown) => void) => (streamHandlers.stdout = [listener]) },
      stderr: { on: (_: "data", listener: (chunk: unknown) => void) => (streamHandlers.stderr = [listener]) },
    },
    emitStdout: (chunk: unknown) => streamHandlers.stdout?.[0]?.(chunk),
    emitStderr: (chunk: unknown) => streamHandlers.stderr?.[0]?.(chunk),
  };
}

describe("PythonRuntimeProcessManager", () => {
  it("treats healthy runtime as external ownership", async () => {
    const store = new RuntimeEventBuffer();
    const manager = new PythonRuntimeProcessManager({
      client: {
        health: async () => ({ status: "ok", runtime: "python" }),
        executeNode: async () => { throw new Error("unused"); },
        executeWorkflow: async () => { throw new Error("unused"); },
      },
      launcher: new PythonRuntimeLauncher({ spawn: () => ({ on: () => undefined, kill: () => true }) }),
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8000" }),
      autoStartEnabled: true,
    });

    const status = await manager.ensureRuntimeAvailability();
    expect(status.owner).toBe("external");
    expect(status.status).toBe("healthy");
  });

  it("starts and waits for health when unavailable", async () => {
    let probes = 0;
    const processStub = createProcessStub();
    const store = new RuntimeEventBuffer();
    const manager = new PythonRuntimeProcessManager({
      client: {
        health: async () => {
          probes += 1;
          return probes < 2
            ? Promise.reject(new Error("down"))
            : { status: "ok", runtime: "python" as const };
        },
        executeNode: async () => { throw new Error("unused"); },
        executeWorkflow: async () => { throw new Error("unused"); },
      },
      launcher: new PythonRuntimeLauncher({ spawn: () => processStub.process as any }),
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8000" }),
      healthPollIntervalMs: 1,
      startupTimeoutMs: 50,
      sleep: async () => undefined,
    });

    const status = await manager.ensureRuntimeAvailability();
    expect(status.owner).toBe("managed");
    expect(status.status).toBe("healthy");
    expect(store.list().some((event) => event.message.includes("process started"))).toBeTrue();
  });

  it("reports startup timeout", async () => {
    const store = new RuntimeEventBuffer();
    const manager = new PythonRuntimeProcessManager({
      client: {
        health: async () => {
          throw new Error("down");
        },
        executeNode: async () => { throw new Error("unused"); },
        executeWorkflow: async () => { throw new Error("unused"); },
      },
      launcher: new PythonRuntimeLauncher({ spawn: () => ({ on: () => undefined, kill: () => true }) }),
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8000" }),
      healthPollIntervalMs: 1,
      startupTimeoutMs: 2,
      sleep: async () => undefined,
    });

    const status = await manager.ensureRuntimeAvailability();
    expect(status.status).toBe("failed");
    expect(store.list().some((event) => event.message.includes("timed out"))).toBeTrue();
  });
});

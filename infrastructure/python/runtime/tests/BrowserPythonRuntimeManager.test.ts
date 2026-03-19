import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { NodeProcessRuntimeEventSink } from "../NodeProcessRuntimeEventSink";
import { BrowserPythonRuntimeManager } from "../BrowserPythonRuntimeManager";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";

describe("BrowserPythonRuntimeManager", () => {
  it("treats a healthy runtime as external without process spawning", async () => {
    const store = new RuntimeEventBuffer();
    const manager = new BrowserPythonRuntimeManager({
      client: {
        health: async () => ({ status: "ok", runtime: "python" }),
        executeNode: async () => {
          throw new Error("unused");
        },
        executeWorkflow: async () => {
          throw new Error("unused");
        },
      },
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8000" }),
    });

    const status = await manager.ensureRuntimeAvailability();

    expect(status.owner).toBe("external");
    expect(status.status).toBe("healthy");
    expect(store.list().some((event) => event.message.includes("healthy"))).toBeTrue();
  });

  it("reports unavailable runtime without throwing or trying to start one", async () => {
    const store = new RuntimeEventBuffer();
    const manager = new BrowserPythonRuntimeManager({
      client: {
        health: async () => {
          throw new Error("offline");
        },
        executeNode: async () => {
          throw new Error("unused");
        },
        executeWorkflow: async () => {
          throw new Error("unused");
        },
      },
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8000" }),
    });

    const status = await manager.ensureRuntimeAvailability();

    expect(status.status).toBe("unavailable");
    expect(status.owner).toBe("none");
    expect(status.detail).toContain("browser environment");
    expect(store.list().some((event) => event.message.includes("continue without managing"))).toBeTrue();
  });

  it("keeps disabled browser runtime status safe", async () => {
    const store = new RuntimeEventBuffer();
    const manager = new BrowserPythonRuntimeManager({
      client: {
        health: async () => ({ status: "unavailable", runtime: "python" }),
        executeNode: async () => {
          throw new Error("unused");
        },
        executeWorkflow: async () => {
          throw new Error("unused");
        },
      },
      eventSink: new NodeProcessRuntimeEventSink(store),
      config: new PythonRuntimeConfig({ mode: "disabled" }),
    });

    expect(await manager.checkAvailability()).toBeFalse();
    expect(manager.getStatus().detail).toBe("Python runtime is disabled in settings.");
  });
});

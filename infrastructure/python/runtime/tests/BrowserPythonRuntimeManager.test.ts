import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { NodeProcessRuntimeEventSink } from "../NodeProcessRuntimeEventSink";
import { BrowserPythonRuntimeManager } from "../BrowserPythonRuntimeManager";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";

describe("BrowserPythonRuntimeManager", () => {
  it("queries the supervisor-managed runtime lifecycle as an external service", async () => {
    const store = new RuntimeEventBuffer();
    const healthyService = {
      ok: true,
      service: {
        serviceId: "python-runtime",
        name: "Python runtime",
        args: [],
        pid: null,
        startedAt: null,
        lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
        state: "healthy",
        ownership: "external",
        detail: "Python runtime health check passed.",
        recentLogs: [{ timestamp: "2026-03-20T00:00:00.000Z", level: "success", message: "Python runtime is healthy." }],
      },
    } as const;
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
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [] }),
        listServices: async () => ({ ok: true, services: [] }),
        getService: async () => healthyService,
        start: async () => healthyService,
        stop: async () => healthyService,
        restart: async () => healthyService,
        ensureRunning: async () => healthyService,
      },
    });

    const status = await manager.ensureRuntimeAvailability();

    expect(status.owner).toBe("external");
    expect(status.status).toBe("healthy");
    expect(store.list().some((event) => event.message.includes("healthy"))).toBeTrue();
  });

  it("reports unavailable runtime without throwing when the supervisor cannot reach one", async () => {
    const store = new RuntimeEventBuffer();
    const stoppedService = {
      ok: true,
      service: {
        serviceId: "python-runtime",
        name: "Python runtime",
        args: [],
        pid: null,
        startedAt: null,
        lastHealthCheckAt: "2026-03-20T00:00:01.000Z",
        state: "stopped",
        ownership: "none",
        detail: "Python runtime is stopped.",
        recentLogs: [{ timestamp: "2026-03-20T00:00:01.000Z", level: "info", message: "Python runtime is stopped." }],
      },
    } as const;
    const failedStartService = {
      ok: true,
      service: {
        serviceId: "python-runtime",
        name: "Python runtime",
        args: [],
        pid: null,
        startedAt: null,
        lastHealthCheckAt: "2026-03-20T00:00:01.000Z",
        state: "failed",
        ownership: "managed",
        detail: "Python runtime startup failed.",
        recentLogs: [{ timestamp: "2026-03-20T00:00:01.000Z", level: "error", message: "Python runtime startup failed." }],
      },
    } as const;
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
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [] }),
        listServices: async () => ({ ok: true, services: [] }),
        getService: async () => stoppedService,
        start: async () => failedStartService,
        stop: async () => stoppedService,
        restart: async () => stoppedService,
        ensureRunning: async () => stoppedService,
      },
    });

    const status = await manager.ensureRuntimeAvailability();

    expect(status.status).toBe("stopped");
    expect(status.owner).toBe("none");
    expect(status.detail).toContain("stopped");
    expect(store.list().some((event) => event.message.includes("stopped"))).toBeTrue();
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
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [] }),
        listServices: async () => ({ ok: true, services: [] }),
        getService: async () => ({
          ok: true,
          service: {
            serviceId: "python-runtime",
            name: "Python runtime",
            args: [],
            pid: null,
            startedAt: null,
            lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
            state: "stopped",
            ownership: "none",
            detail: "Python runtime is disabled in settings.",
            recentLogs: [],
          },
        }),
        start: async () => ({
          ok: true,
          service: {
            serviceId: "python-runtime",
            name: "Python runtime",
            args: [],
            pid: null,
            startedAt: null,
            lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
            state: "stopped",
            ownership: "none",
            detail: "Python runtime is disabled in settings.",
            recentLogs: [],
          },
        }),
        stop: async () => ({
          ok: true,
          service: {
            serviceId: "python-runtime",
            name: "Python runtime",
            args: [],
            pid: null,
            startedAt: null,
            lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
            state: "stopped",
            ownership: "none",
            detail: "Python runtime is disabled in settings.",
            recentLogs: [],
          },
        }),
        restart: async () => ({
          ok: true,
          service: {
            serviceId: "python-runtime",
            name: "Python runtime",
            args: [],
            pid: null,
            startedAt: null,
            lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
            state: "stopped",
            ownership: "none",
            detail: "Python runtime is disabled in settings.",
            recentLogs: [],
          },
        }),
        ensureRunning: async () => ({
          ok: true,
          service: {
            serviceId: "python-runtime",
            name: "Python runtime",
            args: [],
            pid: null,
            startedAt: null,
            lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
            state: "stopped",
            ownership: "none",
            detail: "Python runtime is disabled in settings.",
            recentLogs: [],
          },
        }),
      },
    });

    expect(await manager.checkAvailability()).toBeFalse();
    expect(manager.getStatus().detail).toBe("Python runtime is disabled in settings.");
  });
});

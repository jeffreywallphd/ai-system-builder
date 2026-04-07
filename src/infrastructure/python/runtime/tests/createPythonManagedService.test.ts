import { describe, expect, it } from "bun:test";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import { RuntimeEventBuffer } from "../../../../application/runtime/RuntimeEventBuffer";
import { NodeProcessRuntimeEventSink } from "../NodeProcessRuntimeEventSink";
import { createPythonManagedService } from "../createPythonManagedService";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";

describe("createPythonManagedService", () => {
  it("builds the external runtime as a managed-service-backed adapter", async () => {
    const store = new RuntimeEventBuffer();
    const managedService = createPythonManagedService({
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
      config: new PythonRuntimeConfig({ mode: "external-http", baseUrl: "http://localhost:8000" }),
    });

    const status = await managedService.pythonRuntimeManager.ensureRuntimeAvailability();

    expect(managedService.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
    expect(status.owner).toBe("external");
    expect(status.status).toBe("healthy");
    expect(store.list().some((event) => event.details?.serviceId === "python-runtime")).toBeTrue();
  });

  it("builds the managed-local runtime on the generic supervisor client", async () => {
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
        ownership: "managed",
        detail: "Python runtime health check passed.",
        recentLogs: [{ timestamp: "2026-03-20T00:00:00.000Z", level: "success", message: "Python runtime is healthy." }],
        processHistory: [],
        metadata: { version: "test", compatibility: {} },
        diagnostics: {
          lastError: null,
          lastExit: null,
          lastStart: null,
          lastHealthProbe: null,
          provisioning: {
            state: "provisioned",
            required: true,
            requestedVersion: "3.12",
            resolvedVersion: "3.12.7",
            resolvedInterpreter: "/usr/bin/python3.12",
            environmentPath: "python-runtime/.venv",
            versionMismatch: false,
            needsReprovision: false,
            lastUpdatedAt: "2026-03-20T00:00:00.000Z",
            lastError: null,
          },
          circuitBreaker: {
            state: "closed",
            openedAt: null,
            retryAfter: null,
            recentFailures: 0,
            maxFailures: 5,
            failureWindowMs: 30_000,
            cooldownMs: 15_000,
          },
        },
      },
    } as const;
    const managedService = createPythonManagedService({
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
      config: new PythonRuntimeConfig({ mode: "managed-local", baseUrl: "http://localhost:8000" }),
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [] }),
        listServices: async () => ({ ok: true, services: [healthyService.service] }),
        getService: async () => healthyService,
        start: async () => healthyService,
        stop: async () => healthyService,
        restart: async () => healthyService,
        ensureRunning: async () => healthyService,
        provision: async () => healthyService,
        repair: async () => healthyService,
        recreateEnvironment: async () => healthyService,
      },
    });

    const status = await managedService.pythonRuntimeManager.ensureRuntimeAvailability();

    expect(managedService.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
    expect(status.owner).toBe("managed");
    expect(status.status).toBe("healthy");
  });

  it("keeps disabled runtime lifecycle on the same managed-service adapter", async () => {
    const managedService = createPythonManagedService({
      client: {
        health: async () => ({ status: "unavailable", runtime: "python" }),
        executeNode: async () => {
          throw new Error("unused");
        },
        executeWorkflow: async () => {
          throw new Error("unused");
        },
      },
      eventSink: new NodeProcessRuntimeEventSink(new RuntimeEventBuffer()),
      config: new PythonRuntimeConfig({ mode: "disabled" }),
    });

    expect(managedService.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
    expect(await managedService.pythonRuntimeManager.checkAvailability()).toBeFalse();
    expect(managedService.pythonRuntimeManager.getStatus().detail).toBe("Python runtime is disabled in settings.");
  });
});

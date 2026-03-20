import { describe, expect, it, mock } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import {
  createManagedServiceDefinition,
  ManagedServiceRestartPolicies,
  ManagedServiceSources,
  ManagedServiceTransports,
} from "../../../application/services/ManagedServiceDefinition";
import { createPythonRuntimeServiceDefinition } from "../../../infrastructure/python/runtime/PythonRuntimeServiceDefinition";
import { PythonRuntimeConfig } from "../../../infrastructure/config/PythonRuntimeConfig";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "../../../application/services/interfaces/ManagedServiceTypes";
import { ManagedServicesService } from "../ManagedServicesService";

function createRepository(initialDefinitions: ReadonlyArray<any> = []) {
  const definitions = new Map(initialDefinitions.map((definition) => [definition.serviceId, definition]));
  return {
    async listPersistedDefinitions() {
      return Object.freeze([...definitions.values()]);
    },
    async savePersistedDefinition(definition: any) {
      definitions.set(definition.serviceId, definition);
      return definition;
    },
    async deletePersistedDefinition(serviceId: string) {
      definitions.delete(serviceId);
    },
  };
}

describe("ManagedServicesService", () => {
  it("lists built-in and custom service metadata, health, and recent logs while delegating lifecycle actions", async () => {
    const checkAvailability = mock(async () => true);
    const ensureRuntimeAvailability = mock(async () => ({
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T10:15:00.000Z",
      detail: "Runtime is healthy.",
    }));
    const restartRuntime = mock(async () => ({
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T10:16:00.000Z",
      detail: "Runtime restarted.",
    }));
    const stopManagedRuntime = mock(async () => undefined);
    const getStatus = mock(() => ({
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T10:15:00.000Z",
      detail: "Runtime is healthy.",
    }));
    const runtimeEventStore = new RuntimeEventBuffer({
      initialEvents: [
        createRuntimeEvent({
          source: RuntimeEventSources.pythonRuntime,
          severity: "info",
          message: "Supervisor started python-runtime.",
          timestamp: "2026-03-20T10:10:00.000Z",
        }),
        createRuntimeEvent({
          source: RuntimeEventSources.pythonRuntime,
          severity: "error",
          message: "stderr: trace line",
          timestamp: "2026-03-20T10:11:00.000Z",
        }),
      ],
    });
    const repository = createRepository([
      createManagedServiceDefinition({
        serviceId: "ollama-local",
        kind: ManagedServiceKinds.custom,
        displayName: "Ollama",
        source: ManagedServiceSources.custom,
        transport: ManagedServiceTransports.http,
        baseUrl: "http://127.0.0.1:11434",
        autoStartPolicy: ManagedServiceStartPolicies.manual,
        restartPolicy: ManagedServiceRestartPolicies.never,
      }),
    ]);

    const service = new ManagedServicesService({
      pythonRuntimeManager: {
        checkAvailability,
        ensureRuntimeAvailability,
        restartRuntime,
        getStatus,
        stopManagedRuntime,
      },
      runtimeEventStore,
      builtinDefinitions: [createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
        mode: "managed-local",
        baseUrl: "http://127.0.0.1:8000",
      }))],
      definitionRepository: repository as any,
      fetchImplementation: mock(async (url: string) => ({ ok: url.includes("11434"), status: 200 })) as any,
    });

    const services = await service.listServices();
    const started = await service.startService("python-runtime");
    const refreshedCustom = await service.refreshService("ollama-local");
    await service.restartService("python-runtime");
    await service.stopService("python-runtime");
    await service.ensureRunning("python-runtime");

    expect(checkAvailability).toHaveBeenCalled();
    expect(services).toHaveLength(2);
    expect(services[0]?.endpointSummary).toBe("http://127.0.0.1:8000/health");
    expect(services[0]?.ownership).toBe("managed");
    expect(services[0]?.recentLogs.map((event) => event.message)).toEqual([
      "Supervisor started python-runtime.",
      "stderr: trace line",
    ]);
    expect(services[1]?.endpointSummary).toBe("http://127.0.0.1:11434/health");
    expect(refreshedCustom.state).toBe("healthy");
    expect(refreshedCustom.canManageLifecycle).toBeFalse();
    expect(started.state).toBe("healthy");
    expect(ensureRuntimeAvailability).toHaveBeenCalledTimes(2);
    expect(restartRuntime).toHaveBeenCalledTimes(1);
    expect(stopManagedRuntime).toHaveBeenCalledTimes(1);
  });

  it("supports custom-service CRUD while protecting built-in services", async () => {
    const repository = createRepository();
    const service = new ManagedServicesService({
      pythonRuntimeManager: {
        checkAvailability: async () => true,
        ensureRuntimeAvailability: async () => ({ status: "healthy", isAvailable: true, owner: "managed", lastUpdatedAt: "2026-03-20T10:15:00.000Z" }),
        restartRuntime: async () => ({ status: "healthy", isAvailable: true, owner: "managed", lastUpdatedAt: "2026-03-20T10:15:00.000Z" }),
        getStatus: () => ({ status: "healthy", isAvailable: true, owner: "managed", lastUpdatedAt: "2026-03-20T10:15:00.000Z" }),
        stopManagedRuntime: async () => undefined,
      },
      runtimeEventStore: new RuntimeEventBuffer({ capacity: 5 }),
      builtinDefinitions: [createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
        mode: "managed-local",
        baseUrl: "http://127.0.0.1:8000",
      }))],
      definitionRepository: repository as any,
      fetchImplementation: mock(async () => ({ ok: true, status: 200 })) as any,
    });

    const created = await service.createService({
      serviceId: "local-webhook",
      kind: ManagedServiceKinds.custom,
      displayName: "Local webhook",
      command: "node",
      args: ["server.js"],
      workingDirectory: "/tmp/local-webhook",
      environmentVariables: { PORT: "9000" },
      baseUrl: "http://127.0.0.1:9000",
      autoStartPolicy: ManagedServiceStartPolicies.manual,
    });
    const updated = await service.updateService("local-webhook", {
      serviceId: "local-webhook",
      kind: ManagedServiceKinds.custom,
      displayName: "Local webhook dev",
      baseUrl: "http://127.0.0.1:9100",
    });
    await service.updateService("python-runtime", {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime (local)",
      command: "python3",
      startupTimeoutMs: 30000,
    });
    await service.removeService("local-webhook");

    expect(created.id).toBe("local-webhook");
    expect(created.command).toBe("node");
    expect(updated.name).toBe("Local webhook dev");
    await expect(service.removeService("python-runtime")).rejects.toThrow("cannot be removed");
    const services = await service.listServices();
    expect(services.map((entry) => entry.id)).toEqual(["python-runtime"]);
    expect((await service.getService("python-runtime")).name).toContain("local");
  });
});

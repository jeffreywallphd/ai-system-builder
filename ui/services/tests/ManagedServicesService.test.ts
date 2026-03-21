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
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
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
    const pythonDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "managed-local",
      baseUrl: "http://127.0.0.1:8000",
    }));
    let currentStatus: any = {
      serviceId: pythonDefinition.serviceId,
      kind: pythonDefinition.kind,
      state: ManagedServiceStates.running,
      isAvailable: true,
      ownership: ManagedServiceOwnership.managed,
      startPolicy: pythonDefinition.autoStartPolicy,
      lastUpdatedAt: "2026-03-20T10:15:00.000Z",
      detail: "Runtime is healthy.",
    } as const;
    const refreshServiceStatus = mock(async () => currentStatus);
    const start = mock(async () => currentStatus);
    const restart = mock(async () => {
      currentStatus = {
        ...currentStatus,
        lastUpdatedAt: "2026-03-20T10:16:00.000Z",
        detail: "Runtime restarted.",
      };
      return currentStatus;
    });
    const stop = mock(async () => {
      currentStatus = {
        ...currentStatus,
        state: ManagedServiceStates.stopped,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        detail: "Runtime stopped.",
      };
      return currentStatus;
    });
    const ensureRunning = mock(async () => currentStatus);
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
        dependencies: ["python-runtime"],
        source: ManagedServiceSources.custom,
        transport: ManagedServiceTransports.http,
        baseUrl: "http://127.0.0.1:11434",
        autoStartPolicy: ManagedServiceStartPolicies.manual,
        restartPolicy: ManagedServiceRestartPolicies.never,
      }),
    ]);

    const service = new ManagedServicesService({
      serviceManager: {
        listServices: () => ([{
          id: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          name: pythonDefinition.displayName,
          startPolicy: pythonDefinition.autoStartPolicy,
        }]),
        getServiceStatus: () => currentStatus,
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
        refreshServiceStatus,
      } as any,
      serviceSupervisor: { start, stop, restart, ensureRunning },
      runtimeEventStore,
      builtinDefinitions: [pythonDefinition],
      definitionRepository: repository as any,
      fetchImplementation: mock(async (url: string) => ({ ok: url.includes("11434"), status: 200 })) as any,
    });

    const services = await service.listServices();
    const started = await service.startService("python-runtime");
    const refreshedCustom = await service.refreshService("ollama-local");
    await service.restartService("python-runtime");
    await service.stopService("python-runtime");
    await service.ensureRunning("python-runtime");

    expect(refreshServiceStatus).toHaveBeenCalled();
    expect(services).toHaveLength(2);
    expect(services[0]?.endpointSummary).toBe("http://127.0.0.1:8000/health");
    expect(services[0]?.ownership).toBe("managed");
    expect(services[0]?.state).toBe("running");
    expect(services[0]?.dependents).toEqual(["ollama-local"]);
    expect(services[0]?.recentLogs.map((event) => event.message)).toEqual([
      "Supervisor started python-runtime.",
      "stderr: trace line",
    ]);
    expect(services[1]?.endpointSummary).toBe("http://127.0.0.1:11434/health");
    expect(services[1]?.dependencies).toEqual(["python-runtime"]);
    expect(services[1]?.readiness.isReady).toBeTrue();
    expect(refreshedCustom.state).toBe("running");
    expect(refreshedCustom.canManageLifecycle).toBeFalse();
    expect(started.state).toBe("running");
    expect(ensureRunning).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("starts all services required for a capability in dependency order", async () => {
    const pythonDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "managed-local",
      baseUrl: "http://127.0.0.1:8000",
    }));
    const vectorDefinition = createManagedServiceDefinition({
      serviceId: "vector-store",
      kind: ManagedServiceKinds.custom,
      displayName: "Vector store",
      dependencies: ["python-runtime"],
      source: ManagedServiceSources.custom,
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:6333",
      autoStartPolicy: ManagedServiceStartPolicies.manual,
      restartPolicy: ManagedServiceRestartPolicies.never,
      capabilities: ["retrieval"],
    });
    const gatewayDefinition = createManagedServiceDefinition({
      serviceId: "model-gateway",
      kind: ManagedServiceKinds.custom,
      displayName: "Model gateway",
      dependencies: ["vector-store"],
      source: ManagedServiceSources.custom,
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:11435",
      autoStartPolicy: ManagedServiceStartPolicies.manual,
      restartPolicy: ManagedServiceRestartPolicies.never,
      capabilities: ["retrieval"],
    });
    const ensureRunningOrder: string[] = [];
    const service = new ManagedServicesService({
      serviceManager: {
        listServices: () => ([
          { id: pythonDefinition.serviceId, kind: pythonDefinition.kind, name: pythonDefinition.displayName, startPolicy: pythonDefinition.autoStartPolicy },
        ]),
        getServiceStatus: () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
          detail: "Runtime is healthy.",
        }),
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
        refreshServiceStatus: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
          detail: "Runtime is healthy.",
        }),
      } as any,
      serviceSupervisor: {
        start: async () => ({}) as any,
        stop: async () => ({}) as any,
        restart: async () => ({}) as any,
        ensureRunning: async (serviceId: string) => {
          ensureRunningOrder.push(serviceId);
          return {
            serviceId,
            kind: pythonDefinition.kind,
            state: ManagedServiceStates.running,
            isAvailable: true,
            ownership: ManagedServiceOwnership.managed,
            startPolicy: pythonDefinition.autoStartPolicy,
            lastUpdatedAt: "2026-03-20T10:15:00.000Z",
          };
        },
      },
      runtimeEventStore: new RuntimeEventBuffer({ capacity: 5 }),
      builtinDefinitions: [pythonDefinition],
      definitionRepository: createRepository([vectorDefinition, gatewayDefinition]) as any,
      fetchImplementation: mock(async () => ({ ok: true, status: 200 })) as any,
    });

    const records = await service.startCapability("retrieval");

    expect(ensureRunningOrder).toEqual(["python-runtime"]);
    expect(records.map((record) => record.id)).toEqual(["python-runtime", "vector-store", "model-gateway"]);
  });

  it("supports custom-service CRUD while protecting built-in services", async () => {
    const repository = createRepository();
    const pythonDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "managed-local",
      baseUrl: "http://127.0.0.1:8000",
    }));
    const service = new ManagedServicesService({
      serviceManager: {
        listServices: () => ([{
          id: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          name: pythonDefinition.displayName,
          startPolicy: pythonDefinition.autoStartPolicy,
        }]),
        getServiceStatus: () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
        refreshServiceStatus: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
      } as any,
      serviceSupervisor: {
        start: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
        stop: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.stopped,
          isAvailable: false,
          ownership: ManagedServiceOwnership.none,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
        restart: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
        ensureRunning: async () => ({
          serviceId: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.managed,
          startPolicy: pythonDefinition.autoStartPolicy,
          lastUpdatedAt: "2026-03-20T10:15:00.000Z",
        }),
      },
      runtimeEventStore: new RuntimeEventBuffer({ capacity: 5 }),
      builtinDefinitions: [pythonDefinition],
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

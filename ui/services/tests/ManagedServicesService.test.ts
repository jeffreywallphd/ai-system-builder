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
      serviceSupervisor: {
        start,
        stop,
        restart,
        ensureRunning,
        provision: async () => currentStatus,
        repair: async () => currentStatus,
        recreateEnvironment: async () => currentStatus,
      },
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
        provision: async () => ({}) as any,
        repair: async () => ({}) as any,
        recreateEnvironment: async () => ({}) as any,
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
        provision: async () => ({}) as any,
        repair: async () => ({}) as any,
        recreateEnvironment: async () => ({}) as any,
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

  it("manages python and custom supervisor-backed services entirely through the managed-local supervisor", async () => {
    const pythonDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "managed-local",
      baseUrl: "http://127.0.0.1:8000",
    }));
    const customDefinition = createManagedServiceDefinition({
      serviceId: "vector-store",
      kind: ManagedServiceKinds.custom,
      displayName: "Vector store",
      dependencies: ["python-runtime"],
      source: ManagedServiceSources.custom,
      transport: ManagedServiceTransports.hybrid,
      baseUrl: "http://127.0.0.1:6333",
      command: "node",
      args: ["server.mjs"],
      autoStartPolicy: ManagedServiceStartPolicies.manual,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
    });
    const repository = createRepository([pythonDefinition, customDefinition]);
    const supervisorServices = new Map<string, any>([
      ["python-runtime", {
        serviceId: "python-runtime",
        name: "Python runtime",
        args: ["-m", "uvicorn"],
        dependencies: [],
        dependents: ["vector-store"],
        pid: 4100,
        startedAt: "2026-03-20T10:15:00.000Z",
        lastHealthCheckAt: "2026-03-20T10:16:00.000Z",
        state: "healthy",
        ownership: "managed",
        detail: "Python runtime is healthy.",
        readiness: { isReady: true, detail: "Python runtime is ready.", blockedBy: [] },
        recentLogs: [],
        processHistory: [],
        metadata: { version: "1.0.0", compatibility: { supervisorApiVersion: 1 }, kind: "python-runtime" },
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
            lastUpdatedAt: "2026-03-20T10:16:00.000Z",
            lastError: null,
          },
          circuitBreaker: {
            state: "closed",
            openedAt: null,
            retryAfter: null,
            recentFailures: 0,
            maxFailures: 3,
            failureWindowMs: 60_000,
            cooldownMs: 30_000,
          },
        },
      }],
      ["vector-store", {
        serviceId: "vector-store",
        name: "Vector store",
        command: "node",
        args: ["server.mjs"],
        dependencies: ["python-runtime"],
        dependents: [],
        cwd: "/workspace/ai-loom-studio",
        baseUrl: "http://127.0.0.1:6333",
        pid: 4200,
        startedAt: "2026-03-20T10:16:00.000Z",
        lastHealthCheckAt: "2026-03-20T10:16:30.000Z",
        state: "healthy",
        ownership: "managed",
        detail: "Vector store is healthy.",
        readiness: { isReady: true, detail: "Vector store is ready.", blockedBy: [] },
        recentLogs: [],
        processHistory: [],
        metadata: { version: "1.0.0", compatibility: { supervisorApiVersion: 1 }, kind: "custom" },
        diagnostics: {
          lastError: null,
          lastExit: null,
          lastStart: null,
          lastHealthProbe: null,
          provisioning: {
            state: "unsupported",
            required: false,
            requestedVersion: null,
            resolvedVersion: null,
            resolvedInterpreter: null,
            environmentPath: null,
            versionMismatch: false,
            needsReprovision: false,
            lastUpdatedAt: null,
            lastError: null,
          },
          circuitBreaker: {
            state: "closed",
            openedAt: null,
            retryAfter: null,
            recentFailures: 0,
            maxFailures: 3,
            failureWindowMs: 60_000,
            cooldownMs: 30_000,
          },
        },
      }],
    ]);
    const lifecycleCalls: string[] = [];
    const service = new ManagedServicesService({
      serviceManager: {
        listServices: () => ([{
          id: pythonDefinition.serviceId,
          kind: pythonDefinition.kind,
          name: pythonDefinition.displayName,
          startPolicy: pythonDefinition.autoStartPolicy,
        }]),
        getServiceStatus: () => undefined,
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
      } as any,
      serviceSupervisor: {
        start: async () => ({}) as any,
        stop: async () => ({}) as any,
        restart: async () => ({}) as any,
        ensureRunning: async () => ({}) as any,
        provision: async () => ({}) as any,
        repair: async () => ({}) as any,
        recreateEnvironment: async () => ({}) as any,
      },
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: supervisorServices.size, services: [...supervisorServices.values()] }),
        listServices: async () => ({ ok: true, services: [...supervisorServices.values()] }),
        getService: async (serviceId: string) => ({ ok: true, service: supervisorServices.get(serviceId) }),
        listDefinitions: async () => ({ ok: true, definitions: [pythonDefinition, customDefinition] }),
        getDefinition: async (serviceId: string) => ({ ok: true, definition: serviceId === "python-runtime" ? pythonDefinition : customDefinition }),
        saveDefinition: async (definition) => ({ ok: true, definition }),
        deleteDefinition: async () => undefined,
        start: async (serviceId: string) => {
          lifecycleCalls.push(`start:${serviceId}`);
          return { ok: true, service: supervisorServices.get(serviceId) };
        },
        stop: async (serviceId: string) => {
          lifecycleCalls.push(`stop:${serviceId}`);
          return { ok: true, service: supervisorServices.get(serviceId) };
        },
        restart: async (serviceId: string) => {
          lifecycleCalls.push(`restart:${serviceId}`);
          return { ok: true, service: supervisorServices.get(serviceId) };
        },
        ensureRunning: async (serviceId: string) => {
          lifecycleCalls.push(`ensure:${serviceId}`);
          return { ok: true, service: supervisorServices.get(serviceId) };
        },
        provision: async (serviceId: string) => ({ ok: true, service: supervisorServices.get(serviceId) }),
        repair: async (serviceId: string) => ({ ok: true, service: supervisorServices.get(serviceId) }),
        recreateEnvironment: async (serviceId: string) => ({ ok: true, service: supervisorServices.get(serviceId) }),
      },
      runtimeEventStore: new RuntimeEventBuffer({ capacity: 5 }),
      builtinDefinitions: [pythonDefinition],
      definitionRepository: repository as any,
      fetchImplementation: mock(async () => ({ ok: true, status: 200 })) as any,
    });

    const services = await service.listServices();
    const ensured = await service.ensureRunning("vector-store");

    expect(services).toHaveLength(2);
    expect(services.find((entry) => entry.id === "python-runtime")?.pid).toBe(4100);
    expect(services.find((entry) => entry.id === "vector-store")?.uptimeSeconds).toBeNumber();
    expect(ensured.canManageLifecycle).toBeTrue();
    expect(ensured.healthSummary).toBe("Vector store is ready.");
    expect(lifecycleCalls).toEqual(["ensure:vector-store"]);
  });

  it("keeps python runtime retry messaging stable until the retry limit is reached", async () => {
    const pythonDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "managed-local",
      baseUrl: "http://127.0.0.1:8000",
    }));
    const repository = createRepository([pythonDefinition]);
    const retryingService = {
      serviceId: "python-runtime",
      name: "Python runtime",
      args: ["-m", "uvicorn"],
      dependencies: [],
      dependents: [],
      pid: null,
      startedAt: null,
      lastHealthCheckAt: "2026-03-20T10:16:00.000Z",
      state: "failed",
      ownership: "none",
      detail: "Python runtime health check failed at http://127.0.0.1:8000/health.",
      readiness: { isReady: false, detail: "Runtime failed.", blockedBy: [] },
      recentLogs: [],
      processHistory: [],
      metadata: { version: "1.0.0", compatibility: {} },
      diagnostics: {
        lastError: null,
        lastExit: null,
        lastStart: null,
        lastHealthProbe: null,
        provisioning: {
          state: "provision-failed",
          required: true,
          requestedVersion: "3.12",
          resolvedVersion: "3.11.9",
          resolvedInterpreter: "/usr/bin/python3.11",
          environmentPath: "python-runtime/.venv",
          versionMismatch: true,
          needsReprovision: true,
          lastUpdatedAt: "2026-03-20T10:16:00.000Z",
          lastError: null,
        },
        circuitBreaker: {
          state: "closed",
          openedAt: null,
          retryAfter: null,
          recentFailures: 1,
          maxFailures: 3,
          failureWindowMs: 60_000,
          cooldownMs: 30_000,
        },
      },
    } as const;

    const service = new ManagedServicesService({
      serviceManager: {
        listServices: () => ([]),
        getServiceStatus: () => undefined,
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
      } as any,
      serviceSupervisor: {
        start: async () => ({}) as any,
        stop: async () => ({}) as any,
        restart: async () => ({}) as any,
        ensureRunning: async () => ({}) as any,
        provision: async () => ({}) as any,
        repair: async () => ({}) as any,
        recreateEnvironment: async () => ({}) as any,
      },
      supervisorClient: {
        health: async () => ({ ok: true, mode: "service-supervisor", host: "127.0.0.1", port: 8790, serviceCount: 1, services: [retryingService] }),
        listServices: async () => ({ ok: true, services: [retryingService] }),
        getService: async () => ({ ok: true, service: retryingService }),
        listDefinitions: async () => ({ ok: true, definitions: [pythonDefinition] }),
        getDefinition: async () => ({ ok: true, definition: pythonDefinition }),
        saveDefinition: async (definition) => ({ ok: true, definition }),
        deleteDefinition: async () => undefined,
        start: async () => ({ ok: true, service: retryingService }),
        stop: async () => ({ ok: true, service: retryingService }),
        restart: async () => ({ ok: true, service: retryingService }),
        ensureRunning: async () => ({ ok: true, service: retryingService }),
        provision: async () => ({ ok: true, service: retryingService }),
        repair: async () => ({ ok: true, service: retryingService }),
        recreateEnvironment: async () => ({ ok: true, service: retryingService }),
      },
      runtimeEventStore: new RuntimeEventBuffer({ capacity: 5 }),
      builtinDefinitions: [pythonDefinition],
      definitionRepository: repository as any,
      fetchImplementation: mock(async () => ({ ok: true, status: 200 })) as any,
    });

    const mapped = await service.getService("python-runtime");

    expect(mapped.state).toBe("starting");
    expect(mapped.detail).toBe("Trying to restart Python runtime (2 of 3).");
    expect(mapped.lastErrorDetail).toBeUndefined();
    expect(mapped.healthSummary).toBe("Trying to restart Python runtime (2 of 3).");
  });
});

import { describe, expect, it, mock } from "bun:test";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { ManagedServiceRecord } from "../../services/ManagedServicesService";
import type { ManagedServiceEventStreamListener } from "../../services/ManagedServiceEventStream";
import { ManagedServicesStore } from "../ManagedServicesStore";

function createServiceRecord(overrides: Partial<ManagedServiceRecord> = {}): ManagedServiceRecord {
  return Object.freeze({
    id: "python-runtime",
    name: "Python runtime",
    kind: "python-runtime",
    source: "builtin",
    capabilities: Object.freeze(["workflow-execution"]),
    dependencies: Object.freeze([]),
    dependents: Object.freeze([]),
    startPolicy: "on-demand",
    restartPolicy: "on-failure",
    state: "running",
    ownership: "managed",
    isAvailable: true,
    transport: "http",
    baseUrl: "http://127.0.0.1:8000",
    endpointSummary: "http://127.0.0.1:8000/health",
    workingDirectory: "python-runtime",
    command: "python",
    args: Object.freeze(["-m", "uvicorn"]),
    environmentVariables: Object.freeze({}),
    startupTimeoutMs: 20000,
    canEdit: true,
    canRemove: false,
    canManageLifecycle: true,
    lastCheckedAt: "2026-03-20T10:15:00.000Z",
    lastErrorDetail: undefined,
    detail: "Runtime is healthy.",
    provisioning: Object.freeze({
      state: "provisioned",
      required: true,
      needsReprovision: false,
      requestedVersion: "3.12",
      resolvedVersion: "3.12.7",
      resolvedInterpreter: "/usr/bin/python3.12",
      environmentPath: "python-runtime/.venv",
      detail: "Python runtime environment is provisioned.",
      availableActions: Object.freeze(["repair", "recreate-environment"] as const),
    }),
    readiness: Object.freeze({
      isReady: true,
      detail: "Python runtime is ready.",
      blockedBy: Object.freeze([]),
    }),
    recentLogs: Object.freeze([
      createRuntimeEvent({
        source: RuntimeEventSources.pythonRuntime,
        severity: "info",
        message: "stdout: runtime ready",
        timestamp: "2026-03-20T10:14:00.000Z",
      }),
    ]),
    ...overrides,
  });
}

describe("ManagedServicesStore", () => {
  it("loads managed services, tracks selection, applies lifecycle mutations, and supports CRUD", async () => {
    const listServices = mock(async () => Object.freeze([
      createServiceRecord(),
      createServiceRecord({
        id: "local-ollama",
        name: "Local Ollama",
        kind: "custom",
        source: "custom",
        ownership: "external",
        canManageLifecycle: false,
        canRemove: true,
      }),
    ]));
    const createService = mock(async () => createServiceRecord({
      id: "local-webhook",
      name: "Local webhook",
      kind: "custom",
      source: "custom",
      canManageLifecycle: false,
      canRemove: true,
    }));
    const updateService = mock(async () => createServiceRecord({
      id: "local-ollama",
      name: "Local Ollama Dev",
      kind: "custom",
      source: "custom",
      canManageLifecycle: false,
      canRemove: true,
    }));
    const removeService = mock(async () => undefined);
    const startService = mock(async () => createServiceRecord({ state: "starting", detail: "Booting…" }));
    const stopService = mock(async () => createServiceRecord({ state: "stopped", ownership: "none", isAvailable: false }));
    const restartService = mock(async () => createServiceRecord({ state: "running", detail: "Restart complete." }));
    const ensureRunning = mock(async () => createServiceRecord({ state: "running", detail: "Already running." }));
    const provisionService = mock(async () => createServiceRecord({ detail: "Provisioned." }));
    const repairService = mock(async () => createServiceRecord({ detail: "Repaired." }));
    const recreateEnvironment = mock(async () => createServiceRecord({ detail: "Environment recreated." }));
    const startCapability = mock(async () => Object.freeze([
      createServiceRecord({ id: "python-runtime" }),
      createServiceRecord({
        id: "vector-store",
        name: "Vector store",
        kind: "custom",
        source: "custom",
        capabilities: Object.freeze(["retrieval"]),
        dependencies: Object.freeze(["python-runtime"]),
        canManageLifecycle: false,
        canRemove: true,
        readiness: Object.freeze({
          isReady: false,
          detail: "Vector store is waiting on python-runtime.",
          blockedBy: Object.freeze(["python-runtime"]),
        }),
      }),
    ]));

    const store = new ManagedServicesStore({
      listServices,
      createService,
      updateService,
      removeService,
      startService,
      stopService,
      restartService,
      ensureRunning,
      provisionService,
      repairService,
      recreateEnvironment,
      startCapability,
    } as any);

    await store.initialize();
    store.selectService("local-ollama");
    await store.createService({ serviceId: "local-webhook", kind: "custom", displayName: "Local webhook" });
    await store.updateService("local-ollama", { serviceId: "local-ollama", kind: "custom", displayName: "Local Ollama Dev" });
    await store.start("python-runtime");
    await store.stop("python-runtime");
    await store.restart("python-runtime");
    await store.ensureRunning("python-runtime");
    await store.provision("python-runtime");
    await store.repair("python-runtime");
    await store.recreateEnvironment("python-runtime");
    await store.startCapability("retrieval");
    await store.removeService("local-ollama");

    const state = store.getState();
    expect(listServices).toHaveBeenCalledTimes(2);
    expect(createService).toHaveBeenCalledTimes(1);
    expect(updateService).toHaveBeenCalledWith("local-ollama", expect.any(Object));
    expect(removeService).toHaveBeenCalledWith("local-ollama");
    expect(startService).toHaveBeenCalledWith("python-runtime");
    expect(stopService).toHaveBeenCalledWith("python-runtime");
    expect(restartService).toHaveBeenCalledWith("python-runtime");
    expect(ensureRunning).toHaveBeenCalledWith("python-runtime");
    expect(provisionService).toHaveBeenCalledWith("python-runtime");
    expect(repairService).toHaveBeenCalledWith("python-runtime");
    expect(recreateEnvironment).toHaveBeenCalledWith("python-runtime");
    expect(startCapability).toHaveBeenCalledWith("retrieval");
    expect(state.selectedServiceId).toBe("python-runtime");
    expect(state.recentLogs[0]?.message).toContain("runtime ready");
  });

  it("captures service errors for the UI", async () => {
    const store = new ManagedServicesStore({
      listServices: mock(async () => { throw new Error("Supervisor offline"); }),
    } as any);

    await expect(store.refresh()).rejects.toThrow("Supervisor offline");
    expect(store.getState().error).toBe("Supervisor offline");
  });

  it("invalidates runtime dependency orchestration when python runtime lifecycle changes occur", async () => {
    const invalidate = mock(() => undefined);
    let streamListener: ManagedServiceEventStreamListener | undefined;
    const store = new ManagedServicesStore(
      {
        listServices: mock(async () => Object.freeze([createServiceRecord()])),
        startService: mock(async () => createServiceRecord({ state: "starting", detail: "Booting…" })),
        mapSupervisorServiceRecord: mock(async () => createServiceRecord()),
      } as any,
      {
        connect(listener: ManagedServiceEventStreamListener) {
          streamListener = listener;
          return () => undefined;
        },
      } as any,
      { invalidate },
    );

    await store.initialize();
    await store.start("python-runtime");
    streamListener?.onHealthChange?.({
      serviceId: "python-runtime",
      changedAt: "2026-03-20T10:15:02.000Z",
      service: {
        serviceId: "python-runtime",
        name: "Python runtime",
        state: "healthy",
        ownership: "managed",
        detail: "Runtime is healthy.",
      } as any,
    });

    expect(invalidate).toHaveBeenCalledWith("python-runtime");
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("synchronizes live supervisor snapshots, logs, and reconnect state", async () => {
    let streamListener: ManagedServiceEventStreamListener | undefined;
    const listServices = mock(async () => Object.freeze([createServiceRecord({ state: "starting", detail: "Booting…" })]));
    const mapSupervisorServiceRecord = mock(async (service: any) => createServiceRecord({
      id: service.serviceId,
      name: service.name,
      state: service.state === "healthy" ? "running" : service.state,
      ownership: service.ownership,
      isAvailable: service.state === "healthy",
      detail: service.detail,
      lastCheckedAt: service.lastHealthCheckAt,
      recentLogs: Object.freeze((service.recentLogs ?? []).map((entry: any) => createRuntimeEvent({
        id: `${service.serviceId}:${entry.timestamp}:${entry.message}`,
        source: RuntimeEventSources.pythonRuntime,
        severity: entry.level === "stderr" ? "error" : "info",
        message: entry.message,
        timestamp: entry.timestamp,
      }))),
    }));
    const listServicesFromSupervisor = mock(async (services: ReadonlyArray<any>) => Object.freeze(await Promise.all(
      services.map((service) => mapSupervisorServiceRecord(service)),
    )));

    const store = new ManagedServicesStore(
      {
        listServices,
        mapSupervisorServiceRecord,
        listServicesFromSupervisor,
      } as any,
      {
        connect(listener: ManagedServiceEventStreamListener) {
          streamListener = listener;
          listener.onConnectionStateChange?.("connecting");
          return () => undefined;
        },
      } as any,
    );

    await store.initialize();
    streamListener?.onConnectionStateChange?.("open");
    streamListener?.onSnapshot?.({
      services: [{
        serviceId: "python-runtime",
        name: "Python runtime",
        args: ["-m", "uvicorn"],
        pid: 4321,
        startedAt: "2026-03-20T10:15:00.000Z",
        lastHealthCheckAt: "2026-03-20T10:15:02.000Z",
        state: "healthy",
        ownership: "managed",
        detail: "Runtime is healthy.",
        recentLogs: [{
          timestamp: "2026-03-20T10:15:01.000Z",
          level: "stdout",
          message: "runtime ready",
        }],
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
            lastUpdatedAt: "2026-03-20T10:15:02.000Z",
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
      }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    streamListener?.onLog?.({
      serviceId: "python-runtime",
      entry: {
        timestamp: "2026-03-20T10:15:03.000Z",
        level: "stderr",
        message: "traceback line",
      },
    });
    streamListener?.onConnectionStateChange?.("closed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const state = store.getState();
    expect(listServices).toHaveBeenCalledTimes(1);
    expect(listServicesFromSupervisor).toHaveBeenCalledTimes(1);
    expect(mapSupervisorServiceRecord).toHaveBeenCalledTimes(1);
    expect(state.streamState).toBe("reconnecting");
    expect(state.services[0]?.state).toBe("running");
    expect(state.recentLogs.map((entry) => entry.message)).toEqual([
      "runtime ready",
      "traceback line",
    ]);
  });

  it("suppresses repeated supervisor log messages until the message changes", async () => {
    let streamListener: ManagedServiceEventStreamListener | undefined;
    const service = createServiceRecord({ recentLogs: Object.freeze([]) });
    const store = new ManagedServicesStore(
      {
        listServices: mock(async () => Object.freeze([service])),
        mapSupervisorServiceRecord: mock(async () => service),
        listServicesFromSupervisor: mock(async () => Object.freeze([service])),
      } as any,
      {
        connect(listener: ManagedServiceEventStreamListener) {
          streamListener = listener;
          return () => undefined;
        },
      } as any,
    );

    await store.initialize();
    streamListener?.onLog?.({
      serviceId: "python-runtime",
      entry: {
        timestamp: "2026-03-20T10:15:01.000Z",
        level: "stdout",
        message: "Trying to reconnect…",
      },
    });
    streamListener?.onLog?.({
      serviceId: "python-runtime",
      entry: {
        timestamp: "2026-03-20T10:15:02.000Z",
        level: "stdout",
        message: "Trying to reconnect…",
      },
    });
    streamListener?.onLog?.({
      serviceId: "python-runtime",
      entry: {
        timestamp: "2026-03-20T10:15:03.000Z",
        level: "stdout",
        message: "Runtime ready",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState().recentLogs.map((entry) => entry.message)).toEqual([
      "Trying to reconnect…",
      "Runtime ready",
    ]);
  });
});

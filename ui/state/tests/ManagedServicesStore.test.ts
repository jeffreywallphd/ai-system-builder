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
    startPolicy: "on-demand",
    restartPolicy: "on-failure",
    state: "healthy",
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
    const restartService = mock(async () => createServiceRecord({ state: "healthy", detail: "Restart complete." }));
    const ensureRunning = mock(async () => createServiceRecord({ state: "healthy", detail: "Already running." }));

    const store = new ManagedServicesStore({
      listServices,
      createService,
      updateService,
      removeService,
      startService,
      stopService,
      restartService,
      ensureRunning,
    } as any);

    await store.initialize();
    store.selectService("local-ollama");
    await store.createService({ serviceId: "local-webhook", kind: "custom", displayName: "Local webhook" });
    await store.updateService("local-ollama", { serviceId: "local-ollama", kind: "custom", displayName: "Local Ollama Dev" });
    await store.start("python-runtime");
    await store.stop("python-runtime");
    await store.restart("python-runtime");
    await store.ensureRunning("python-runtime");
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

  it("synchronizes live supervisor snapshots, logs, and reconnect state", async () => {
    let streamListener: ManagedServiceEventStreamListener | undefined;
    const listServices = mock(async () => Object.freeze([createServiceRecord({ state: "starting", detail: "Booting…" })]));
    const mapSupervisorServiceRecord = mock(async (service: any) => createServiceRecord({
      id: service.serviceId,
      name: service.name,
      state: service.state,
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
    expect(state.services[0]?.state).toBe("healthy");
    expect(state.recentLogs.map((entry) => entry.message)).toEqual([
      "runtime ready",
      "traceback line",
    ]);
  });
});

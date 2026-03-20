import { describe, expect, it, mock } from "bun:test";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { ManagedServiceRecord } from "../../services/ManagedServicesService";
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
});

import { describe, expect, it, mock } from "bun:test";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { ManagedServiceRecord } from "../../services/ManagedServicesService";
import { ManagedServicesStore } from "../ManagedServicesStore";

function createServiceRecord(overrides: Partial<ManagedServiceRecord> = {}): ManagedServiceRecord {
  return Object.freeze({
    id: "python-runtime",
    name: "Python runtime",
    kind: "python-runtime",
    startPolicy: "on-demand",
    state: "healthy",
    ownership: "managed",
    isAvailable: true,
    baseUrl: "http://127.0.0.1:8000",
    endpointSummary: "http://127.0.0.1:8000/health",
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
  it("loads managed services, tracks selection, and applies lifecycle mutations", async () => {
    const listServices = mock(async () => Object.freeze([
      createServiceRecord(),
      createServiceRecord({ id: "python-runtime-alt", name: "Python runtime alt" }),
    ]));
    const startService = mock(async () => createServiceRecord({ state: "starting", detail: "Booting…" }));
    const stopService = mock(async () => createServiceRecord({ state: "stopped", ownership: "none", isAvailable: false }));
    const restartService = mock(async () => createServiceRecord({ state: "healthy", detail: "Restart complete." }));
    const ensureRunning = mock(async () => createServiceRecord({ state: "healthy", detail: "Already running." }));

    const store = new ManagedServicesStore({
      listServices,
      startService,
      stopService,
      restartService,
      ensureRunning,
    } as any);

    await store.initialize();
    store.selectService("python-runtime-alt");
    await store.start("python-runtime");
    await store.stop("python-runtime");
    await store.restart("python-runtime");
    await store.ensureRunning("python-runtime");

    const state = store.getState();
    expect(listServices).toHaveBeenCalledTimes(1);
    expect(startService).toHaveBeenCalledWith("python-runtime");
    expect(stopService).toHaveBeenCalledWith("python-runtime");
    expect(restartService).toHaveBeenCalledWith("python-runtime");
    expect(ensureRunning).toHaveBeenCalledWith("python-runtime");
    expect(state.selectedServiceId).toBe("python-runtime");
    expect(state.services[0]?.detail).toBe("Already running.");
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

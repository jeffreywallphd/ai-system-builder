import { describe, expect, it, mock } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import { createRuntimeEvent, RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { createPythonRuntimeServiceDefinition } from "../../../infrastructure/python/runtime/PythonRuntimeServiceDefinition";
import { PythonRuntimeConfig } from "../../../infrastructure/config/PythonRuntimeConfig";
import { ManagedServicesService } from "../ManagedServicesService";

describe("ManagedServicesService", () => {
  it("lists runtime service metadata, status, and recent logs while delegating lifecycle actions", async () => {
    const checkAvailability = mock(async () => true);
    const ensureRuntimeAvailability = mock(async () => ({
      status: "healthy",
      isAvailable: true,
      owner: "managed",
      lastUpdatedAt: "2026-03-20T10:15:00.000Z",
      detail: "Runtime is healthy.",
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

    const service = new ManagedServicesService(
      {
        checkAvailability,
        ensureRuntimeAvailability,
        getStatus,
        stopManagedRuntime,
      },
      runtimeEventStore,
      createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
        mode: "managed-local",
        baseUrl: "http://127.0.0.1:8000",
      })),
    );

    const services = await service.listServices();
    const started = await service.startService("python-runtime");
    await service.restartService("python-runtime");
    await service.stopService("python-runtime");
    await service.ensureRunning("python-runtime");

    expect(checkAvailability).toHaveBeenCalled();
    expect(services).toHaveLength(1);
    expect(services[0]?.endpointSummary).toBe("http://127.0.0.1:8000/health");
    expect(services[0]?.ownership).toBe("managed");
    expect(services[0]?.recentLogs.map((event) => event.message)).toEqual([
      "Supervisor started python-runtime.",
      "stderr: trace line",
    ]);
    expect(started.state).toBe("healthy");
    expect(ensureRuntimeAvailability).toHaveBeenCalledTimes(3);
    expect(stopManagedRuntime).toHaveBeenCalledTimes(2);
  });
});

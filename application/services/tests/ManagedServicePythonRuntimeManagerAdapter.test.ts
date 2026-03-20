import { describe, expect, it } from "bun:test";
import { ManagedServicePythonRuntimeManagerAdapter } from "../adapters/ManagedServicePythonRuntimeManagerAdapter";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
  type ManagedServiceStatus,
} from "../interfaces/ManagedServiceTypes";

describe("ManagedServicePythonRuntimeManagerAdapter", () => {
  it("maps managed service lifecycle operations to the legacy python runtime contract", async () => {
    let currentStatus: ManagedServiceStatus = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      state: ManagedServiceStates.unavailable,
      isAvailable: false,
      ownership: ManagedServiceOwnership.none,
      startPolicy: ManagedServiceStartPolicies.externalOnly,
      lastUpdatedAt: new Date().toISOString(),
      detail: "Python runtime is not connected.",
    };

    const adapter = new ManagedServicePythonRuntimeManagerAdapter({
      manager: {
        listServices: () => ([
          {
            id: currentStatus.serviceId,
            kind: currentStatus.kind,
            name: "Python runtime",
            startPolicy: currentStatus.startPolicy,
          },
        ]),
        getServiceStatus: () => currentStatus,
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
      },
      supervisor: {
        ensureRunning: async () => {
          currentStatus = {
            ...currentStatus,
            state: ManagedServiceStates.running,
            isAvailable: true,
            ownership: ManagedServiceOwnership.external,
            lastUpdatedAt: new Date().toISOString(),
          };
          return currentStatus;
        },
        start: async () => currentStatus,
        stop: async () => {
          currentStatus = {
            ...currentStatus,
            state: ManagedServiceStates.stopped,
            isAvailable: false,
            ownership: ManagedServiceOwnership.managed,
            lastUpdatedAt: new Date().toISOString(),
          };
          return currentStatus;
        },
        restart: async () => currentStatus,
      },
    });

    expect(adapter.getStatus().status).toBe("unavailable");
    expect((await adapter.ensureRuntimeAvailability()).status).toBe("healthy");
    await adapter.stopManagedRuntime();
    expect(adapter.getStatus().status).toBe("stopped");
    expect(adapter.getStatus().owner).toBe("managed");
  });

  it("maps degraded and disabled managed service states to compatible runtime statuses", () => {
    let currentStatus: ManagedServiceStatus = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      state: ManagedServiceStates.degraded,
      isAvailable: false,
      ownership: ManagedServiceOwnership.none,
      startPolicy: ManagedServiceStartPolicies.externalOnly,
      lastUpdatedAt: new Date().toISOString(),
      detail: "Unhealthy.",
    };

    const adapter = new ManagedServicePythonRuntimeManagerAdapter({
      manager: {
        listServices: () => ([]),
        getServiceStatus: () => currentStatus,
        subscribeToStatus: () => () => undefined,
        subscribeToLogs: () => () => undefined,
      },
      supervisor: {
        ensureRunning: async () => currentStatus,
        start: async () => currentStatus,
        stop: async () => {
          currentStatus = { ...currentStatus, state: ManagedServiceStates.disabled };
          return currentStatus;
        },
        restart: async () => currentStatus,
      },
    });

    expect(adapter.getStatus().status).toBe("unhealthy");
  });
});

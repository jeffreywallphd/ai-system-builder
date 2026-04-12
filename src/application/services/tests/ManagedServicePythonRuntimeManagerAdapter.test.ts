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
  it("waits for startup readiness when supervisor reports a starting managed runtime", async () => {
    let refreshCount = 0;
    let currentStatus: ManagedServiceStatus = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      state: ManagedServiceStates.starting,
      isAvailable: false,
      ownership: ManagedServiceOwnership.managed,
      startPolicy: ManagedServiceStartPolicies.onDemand,
      lastUpdatedAt: new Date().toISOString(),
      detail: "Python runtime is starting.",
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
        refreshServiceStatus: async () => {
          refreshCount += 1;
          currentStatus = {
            ...currentStatus,
            state: ManagedServiceStates.running,
            isAvailable: true,
            detail: "Python runtime is healthy.",
          };
          return currentStatus;
        },
      },
      supervisor: {
        ensureRunning: async () => currentStatus,
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
      startupTimeoutMs: 1_000,
      healthPollIntervalMs: 1,
      sleep: async () => undefined,
    });

    expect(adapter.getStatus().status).toBe("starting");
    expect((await adapter.ensureRuntimeAvailability()).status).toBe("healthy");
    expect(refreshCount).toBe(1);

    await adapter.stopManagedRuntime();
    expect(adapter.getStatus().status).toBe("stopped");
    expect(adapter.getStatus().owner).toBe("managed");
  });

  it("keeps degraded and failed managed service states compatible with legacy runtime statuses", async () => {
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
        refreshServiceStatus: async () => currentStatus,
      },
      supervisor: {
        ensureRunning: async () => currentStatus,
        start: async () => currentStatus,
        stop: async () => {
          currentStatus = { ...currentStatus, state: ManagedServiceStates.disabled };
          return currentStatus;
        },
        restart: async () => {
          currentStatus = {
            ...currentStatus,
            state: ManagedServiceStates.failed,
            detail: "Runtime restart failed.",
          };
          return currentStatus;
        },
      },
      startupTimeoutMs: 5,
      healthPollIntervalMs: 1,
      sleep: async () => undefined,
    });

    expect(adapter.getStatus().status).toBe("unhealthy");
    expect((await adapter.restartRuntime()).status).toBe("failed");
  });
});

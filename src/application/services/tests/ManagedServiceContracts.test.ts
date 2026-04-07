import { describe, expect, it } from "bun:test";
import type { IManagedServiceManager } from "../interfaces/IManagedServiceManager";
import type { IManagedServiceSupervisor } from "../interfaces/IManagedServiceSupervisor";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
  type ManagedServiceStatus,
} from "../interfaces/ManagedServiceTypes";

describe("managed service contracts", () => {
  it("supports generic service descriptors, statuses, and lifecycle supervision", async () => {
    const status: ManagedServiceStatus = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      state: ManagedServiceStates.running,
      isAvailable: true,
      ownership: ManagedServiceOwnership.external,
      startPolicy: ManagedServiceStartPolicies.externalOnly,
      lastUpdatedAt: new Date().toISOString(),
    };

    const manager: IManagedServiceManager = {
      listServices: () => ([
        {
          id: "python-runtime",
          kind: ManagedServiceKinds.pythonRuntime,
          name: "Python runtime",
          startPolicy: ManagedServiceStartPolicies.externalOnly,
        },
        {
          id: "custom-service",
          kind: ManagedServiceKinds.custom,
          name: "Custom service",
          startPolicy: ManagedServiceStartPolicies.manual,
        },
      ]),
      getServiceStatus: (serviceId: string) => serviceId === status.serviceId ? status : undefined,
      subscribeToStatus: (_serviceId, listener) => {
        listener(status);
        return () => undefined;
      },
      subscribeToLogs: (_serviceId, listener) => {
        listener({
          serviceId: status.serviceId,
          kind: status.kind,
          level: "info",
          message: "ok",
          occurredAt: status.lastUpdatedAt,
        });
        return () => undefined;
      },
    };
    const supervisor: IManagedServiceSupervisor = {
      ensureRunning: async () => status,
      start: async () => status,
      stop: async () => ({ ...status, isAvailable: false, state: ManagedServiceStates.stopped }),
      restart: async () => status,
    };

    expect(manager.listServices().map((service) => service.kind)).toEqual(["python-runtime", "custom"]);
    expect(manager.getServiceStatus("python-runtime")?.ownership).toBe("external");
    expect((await supervisor.ensureRunning("python-runtime")).state).toBe("running");
    expect((await supervisor.stop("python-runtime")).state).toBe("stopped");
  });
});

import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import { NodeProcessRuntimeEventSink } from "../../python/runtime/NodeProcessRuntimeEventSink";
import { BrowserManagedServiceManager } from "../BrowserManagedServiceManager";

describe("BrowserManagedServiceManager", () => {
  it("tracks generic services, emits logs, and updates status subscribers", async () => {
    const eventStore = new RuntimeEventBuffer();
    const manager = new BrowserManagedServiceManager({
      eventSink: new NodeProcessRuntimeEventSink(eventStore),
      registrations: [
        {
          descriptor: {
            id: "python-runtime",
            kind: ManagedServiceKinds.pythonRuntime,
            name: "Python runtime",
            startPolicy: ManagedServiceStartPolicies.externalOnly,
          },
          initialDetail: "Python runtime is not connected.",
          probe: async () => ({
            state: ManagedServiceStates.running,
            isAvailable: true,
            ownership: ManagedServiceOwnership.external,
          }),
        },
        {
          descriptor: {
            id: "custom-service",
            kind: ManagedServiceKinds.custom,
            name: "Custom service",
            startPolicy: ManagedServiceStartPolicies.manual,
          },
          probe: async () => ({
            state: ManagedServiceStates.degraded,
            isAvailable: false,
            ownership: ManagedServiceOwnership.none,
            detail: "Custom service is degraded.",
          }),
        },
      ],
    });

    const statuses: string[] = [];
    const logs: string[] = [];
    manager.subscribeToStatus("python-runtime", (status) => {
      statuses.push(status.state);
    });
    manager.subscribeToLogs("python-runtime", (event) => {
      logs.push(event.message);
    });

    const pythonStatus = await manager.ensureRunning("python-runtime");
    const customStatus = await manager.start("custom-service");

    expect(manager.listServices().map((service) => service.kind)).toEqual(["python-runtime", "custom"]);
    expect(pythonStatus.state).toBe("running");
    expect(customStatus.state).toBe("degraded");
    expect(statuses).toContain("running");
    expect(logs.some((message) => message.includes("Checking Python runtime health"))).toBeTrue();
    expect(eventStore.list().some((event) => event.message.includes("Checking Python runtime health"))).toBeTrue();
  });

  it("keeps disabled services disabled and does not pretend to stop unmanaged ones", async () => {
    const manager = new BrowserManagedServiceManager({
      registrations: [
        {
          descriptor: {
            id: "python-runtime",
            kind: ManagedServiceKinds.pythonRuntime,
            name: "Python runtime",
            startPolicy: ManagedServiceStartPolicies.disabled,
          },
          initialDetail: "Python runtime is disabled in settings.",
          probe: async () => ({
            state: ManagedServiceStates.running,
            isAvailable: true,
            ownership: ManagedServiceOwnership.external,
          }),
        },
      ],
    });

    const disabledStatus = await manager.ensureRunning("python-runtime");
    const stoppedStatus = await manager.stop("python-runtime");

    expect(disabledStatus.state).toBe("disabled");
    expect(disabledStatus.detail).toContain("disabled");
    expect(stoppedStatus.state).toBe("disabled");
  });
});

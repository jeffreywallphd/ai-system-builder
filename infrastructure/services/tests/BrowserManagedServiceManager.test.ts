import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "../../../application/runtime/RuntimeEventBuffer";
import {
  ManagedServiceRestartPolicies,
  ManagedServiceTransports,
} from "../../../application/services/ManagedServiceDefinition";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import { NodeProcessRuntimeEventSink } from "../../python/runtime/NodeProcessRuntimeEventSink";
import { BrowserManagedServiceManager } from "../BrowserManagedServiceManager";
import { InMemoryManagedServiceDefinitionRegistry } from "../InMemoryManagedServiceDefinitionRegistry";

describe("BrowserManagedServiceManager", () => {
  it("tracks generic services, emits logs, and updates status subscribers", async () => {
    const eventStore = new RuntimeEventBuffer();
    const registry = new InMemoryManagedServiceDefinitionRegistry([
      {
        serviceId: "python-runtime",
        kind: ManagedServiceKinds.pythonRuntime,
        displayName: "Python runtime",
        transport: ManagedServiceTransports.http,
        args: [],
        environmentVariables: {},
        autoStartPolicy: ManagedServiceStartPolicies.externalOnly,
        restartPolicy: ManagedServiceRestartPolicies.never,
        startupTimeoutMs: 20_000,
        tags: ["runtime"],
        capabilities: ["workflow-execution"],
      },
      {
        serviceId: "custom-service",
        kind: ManagedServiceKinds.custom,
        displayName: "Custom service",
        transport: ManagedServiceTransports.process,
        args: ["serve"],
        environmentVariables: {},
        autoStartPolicy: ManagedServiceStartPolicies.manual,
        restartPolicy: ManagedServiceRestartPolicies.never,
        startupTimeoutMs: 20_000,
        tags: ["custom"],
        capabilities: [],
      },
    ]);
    const manager = new BrowserManagedServiceManager({
      eventSink: new NodeProcessRuntimeEventSink(eventStore),
      registry,
      registrations: [
        {
          serviceId: "python-runtime",
          initialDetail: "Python runtime is not connected.",
          probe: async () => ({
            state: ManagedServiceStates.running,
            isAvailable: true,
            ownership: ManagedServiceOwnership.external,
          }),
        },
        {
          serviceId: "custom-service",
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
      registry: new InMemoryManagedServiceDefinitionRegistry([
        {
          serviceId: "python-runtime",
          kind: ManagedServiceKinds.pythonRuntime,
          displayName: "Python runtime",
          transport: ManagedServiceTransports.http,
          args: [],
          environmentVariables: {},
          autoStartPolicy: ManagedServiceStartPolicies.disabled,
          restartPolicy: ManagedServiceRestartPolicies.never,
          startupTimeoutMs: 20_000,
          tags: ["runtime"],
          capabilities: [],
        },
      ]),
      registrations: [
        {
          serviceId: "python-runtime",
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

import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type {
  IPythonRuntimeManager,
  PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import {
  ManagedServiceOwnership,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { createPythonRuntimeServiceDefinition } from "./PythonRuntimeServiceDefinition";
import { BrowserManagedServiceManager } from "../../services/BrowserManagedServiceManager";
import { InMemoryManagedServiceDefinitionRegistry } from "../../services/InMemoryManagedServiceDefinitionRegistry";

export interface BrowserPythonRuntimeManagerOptions {
  readonly client: IPythonRuntimeClient;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
}

export class BrowserPythonRuntimeManager implements IPythonRuntimeManager {
  private readonly adapter: ManagedServicePythonRuntimeManagerAdapter;

  constructor(options: BrowserPythonRuntimeManagerOptions) {
    const definition = createPythonRuntimeServiceDefinition(options.config);
    const serviceManager = new BrowserManagedServiceManager({
      eventSink: options.eventSink,
      registry: new InMemoryManagedServiceDefinitionRegistry([definition]),
      registrations: [
        {
          serviceId: definition.serviceId,
          initialDetail: definition.autoStartPolicy === "disabled"
            ? "Python runtime is disabled in settings."
            : "Python runtime is not connected.",
          runtimeEventSource: RuntimeEventSources.pythonRuntime,
          probe: async () => {
            if (definition.autoStartPolicy === "disabled") {
              return {
                state: ManagedServiceStates.disabled,
                isAvailable: false,
                ownership: ManagedServiceOwnership.none,
                detail: "Python runtime is disabled in settings.",
              };
            }

            const health = await options.client.health();
            const isHealthy = health.status === "ok";
            return {
              state: isHealthy ? ManagedServiceStates.running : ManagedServiceStates.degraded,
              isAvailable: isHealthy,
              ownership: isHealthy ? ManagedServiceOwnership.external : ManagedServiceOwnership.none,
              detail: isHealthy ? undefined : "Python runtime endpoint is reachable but not healthy.",
            };
          },
        },
      ],
    });

    this.adapter = new ManagedServicePythonRuntimeManagerAdapter({
      manager: serviceManager,
      supervisor: serviceManager,
      serviceId: definition.serviceId,
    });
  }

  public checkAvailability(): Promise<boolean> {
    return this.adapter.checkAvailability();
  }

  public ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    return this.adapter.ensureRuntimeAvailability();
  }

  public getStatus(): PythonRuntimeManagerStatus {
    return this.adapter.getStatus();
  }

  public stopManagedRuntime(): Promise<void> {
    return this.adapter.stopManagedRuntime();
  }
}

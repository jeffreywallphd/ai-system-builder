import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type {
  IPythonRuntimeManager,
  PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { PythonRuntimeMode } from "../../config/PythonRuntimeMode";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { BrowserManagedServiceManager } from "../../services/BrowserManagedServiceManager";

export interface BrowserPythonRuntimeManagerOptions {
  readonly client: IPythonRuntimeClient;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
}

export class BrowserPythonRuntimeManager implements IPythonRuntimeManager {
  private readonly adapter: ManagedServicePythonRuntimeManagerAdapter;

  constructor(options: BrowserPythonRuntimeManagerOptions) {
    const serviceManager = new BrowserManagedServiceManager({
      eventSink: options.eventSink,
      registrations: [
        {
          descriptor: {
            id: "python-runtime",
            kind: ManagedServiceKinds.pythonRuntime,
            name: "Python runtime",
            description: "Browser-observed Python runtime service.",
            startPolicy: options.config.mode === PythonRuntimeMode.disabled
              ? ManagedServiceStartPolicies.disabled
              : ManagedServiceStartPolicies.externalOnly,
          },
          initialDetail: options.config.mode === PythonRuntimeMode.disabled
            ? "Python runtime is disabled in settings."
            : "Python runtime is not connected.",
          runtimeEventSource: RuntimeEventSources.pythonRuntime,
          probe: async () => {
            if (options.config.mode === PythonRuntimeMode.disabled) {
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
      serviceId: "python-runtime",
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

import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type {
  IPythonRuntimeManager,
  PythonRuntimeManagerStatus,
} from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import type { IManagedServiceSupervisorClient } from "../../../application/services/interfaces/IManagedServiceSupervisorClient";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { createPythonRuntimeServiceDefinition } from "./PythonRuntimeServiceDefinition";
import { HttpManagedServiceSupervisorClient } from "../../services/HttpManagedServiceSupervisorClient";
import { HttpManagedServiceManager } from "../../services/HttpManagedServiceManager";
import { InMemoryManagedServiceDefinitionRegistry } from "../../services/InMemoryManagedServiceDefinitionRegistry";

export interface BrowserPythonRuntimeManagerOptions {
  readonly client: IPythonRuntimeClient;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
  readonly supervisorClient?: IManagedServiceSupervisorClient;
  readonly supervisorFetch?: typeof fetch;
}

export class BrowserPythonRuntimeManager implements IPythonRuntimeManager {
  private readonly adapter: ManagedServicePythonRuntimeManagerAdapter;

  constructor(options: BrowserPythonRuntimeManagerOptions) {
    const definition = createPythonRuntimeServiceDefinition(options.config);
    const serviceManager = new HttpManagedServiceManager({
      eventSink: options.eventSink,
      client: options.supervisorClient ?? new HttpManagedServiceSupervisorClient({
        baseUrl: options.config.supervisorBaseUrl,
        timeoutMs: options.config.timeoutMs,
        authToken: options.config.authToken,
      }, options.supervisorFetch ?? fetch),
      registry: new InMemoryManagedServiceDefinitionRegistry([definition]),
      registrations: [
        {
          serviceId: definition.serviceId,
          initialDetail: definition.autoStartPolicy === "disabled"
            ? "Python runtime is disabled in settings."
            : "Python runtime is not connected.",
          runtimeEventSource: RuntimeEventSources.pythonRuntime,
        },
      ],
    });

    this.adapter = new ManagedServicePythonRuntimeManagerAdapter({
      manager: serviceManager,
      supervisor: serviceManager,
      serviceId: definition.serviceId,
      startupTimeoutMs: options.config.startupTimeoutMs,
      healthPollIntervalMs: options.config.healthPollIntervalMs,
    });
  }

  public checkAvailability(): Promise<boolean> {
    return this.adapter.checkAvailability();
  }

  public ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    return this.adapter.ensureRuntimeAvailability();
  }

  public restartRuntime(): Promise<PythonRuntimeManagerStatus> {
    return this.adapter.restartRuntime();
  }

  public getStatus(): PythonRuntimeManagerStatus {
    return this.adapter.getStatus();
  }

  public stopManagedRuntime(): Promise<void> {
    return this.adapter.stopManagedRuntime();
  }
}

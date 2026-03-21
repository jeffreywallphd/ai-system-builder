import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type { IPythonRuntimeManager } from "../../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventSink } from "../../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources } from "../../../application/runtime/RuntimeEvent";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import type { IManagedServiceManager } from "../../../application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "../../../application/services/interfaces/IManagedServiceStatusRefresher";
import type { IManagedServiceSupervisor } from "../../../application/services/interfaces/IManagedServiceSupervisor";
import type { IManagedServiceSupervisorClient } from "../../../application/services/interfaces/IManagedServiceSupervisorClient";
import {
  ManagedServiceOwnership,
  ManagedServiceStates,
} from "../../../application/services/interfaces/ManagedServiceTypes";
import type { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { BrowserManagedServiceManager } from "../../services/BrowserManagedServiceManager";
import { HttpManagedServiceManager } from "../../services/HttpManagedServiceManager";
import { HttpManagedServiceSupervisorClient } from "../../services/HttpManagedServiceSupervisorClient";
import { InMemoryManagedServiceDefinitionRegistry } from "../../services/InMemoryManagedServiceDefinitionRegistry";
import { createPythonRuntimeServiceDefinition } from "./PythonRuntimeServiceDefinition";

type PythonManagedServiceManager =
  IManagedServiceManager
  & IManagedServiceSupervisor
  & IManagedServiceStatusRefresher;

export interface CreatePythonManagedServiceOptions {
  readonly client: IPythonRuntimeClient;
  readonly eventSink: IRuntimeEventSink;
  readonly config: PythonRuntimeConfig;
  readonly supervisorClient?: IManagedServiceSupervisorClient;
  readonly supervisorFetch?: typeof fetch;
}

export interface PythonManagedService {
  readonly manager: PythonManagedServiceManager;
  readonly pythonRuntimeManager: IPythonRuntimeManager;
}

export function createPythonManagedService(
  options: CreatePythonManagedServiceOptions,
): PythonManagedService {
  const definition = createPythonRuntimeServiceDefinition(options.config);
  const registry = new InMemoryManagedServiceDefinitionRegistry([definition]);

  const manager = options.config.isManagedLocal
    ? new HttpManagedServiceManager({
      eventSink: options.eventSink,
      client: options.supervisorClient ?? new HttpManagedServiceSupervisorClient({
        baseUrl: options.config.supervisorBaseUrl,
        timeoutMs: options.config.timeoutMs,
        authToken: options.config.authToken,
      }, options.supervisorFetch ?? fetch),
      registry,
      registrations: [
        {
          serviceId: definition.serviceId,
          initialDetail: definition.autoStartPolicy === "disabled"
            ? "Python runtime is disabled in settings."
            : "Python runtime is not connected.",
          runtimeEventSource: RuntimeEventSources.pythonRuntime,
        },
      ],
    })
    : new BrowserManagedServiceManager({
      eventSink: options.eventSink,
      registry,
      registrations: [
        {
          serviceId: definition.serviceId,
          initialDetail: definition.autoStartPolicy === "disabled"
            ? "Python runtime is disabled in settings."
            : "Python runtime is not connected.",
          runtimeEventSource: RuntimeEventSources.pythonRuntime,
          probe: async () => {
            if (!options.config.isEnabled) {
              return {
                state: ManagedServiceStates.disabled,
                isAvailable: false,
                ownership: ManagedServiceOwnership.none,
                detail: "Python runtime is disabled in settings.",
              };
            }

            try {
              const response = await options.client.health();
              const isHealthy = response.status === "ok";
              return {
                state: isHealthy ? ManagedServiceStates.running : ManagedServiceStates.degraded,
                isAvailable: isHealthy,
                ownership: isHealthy ? ManagedServiceOwnership.external : ManagedServiceOwnership.none,
                detail: isHealthy
                  ? "Python runtime is healthy."
                  : "Python runtime endpoint is reachable but not healthy.",
              };
            } catch {
              return {
                state: ManagedServiceStates.unavailable,
                isAvailable: false,
                ownership: ManagedServiceOwnership.none,
                detail: "Python runtime is not connected.",
              };
            }
          },
        },
      ],
    });

  return Object.freeze({
    manager,
    pythonRuntimeManager: new ManagedServicePythonRuntimeManagerAdapter({
      manager,
      supervisor: manager,
      serviceId: definition.serviceId,
      startupTimeoutMs: options.config.startupTimeoutMs,
      healthPollIntervalMs: options.config.healthPollIntervalMs,
    }),
  });
}

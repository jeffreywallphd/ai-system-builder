import type { IRuntimeEventSink } from "../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources, type RuntimeEventSource } from "../../application/runtime/RuntimeEvent";
import {
  mapSupervisorLogLevelToManagedServiceLogLevel,
  mapSupervisorServiceToManagedServiceStatus,
} from "../../application/services/adapters/ManagedServiceSupervisorCompatibility";
import {
  toManagedServiceDescriptor,
  type ManagedServiceDefinition,
} from "../../application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRegistry } from "../../application/services/interfaces/IManagedServiceDefinitionRegistry";
import type { IManagedServiceManager } from "../../application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "../../application/services/interfaces/IManagedServiceStatusRefresher";
import type { IManagedServiceSupervisor } from "../../application/services/interfaces/IManagedServiceSupervisor";
import type { IManagedServiceSupervisorClient } from "../../application/services/interfaces/IManagedServiceSupervisorClient";
import {
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
  type ManagedServiceDescriptor,
  type ManagedServiceLogEvent,
  type ManagedServiceLogListener,
  type ManagedServiceStatus,
  type ManagedServiceStatusListener,
  type ManagedServiceSubscription,
} from "../../application/services/interfaces/ManagedServiceTypes";

export interface HttpManagedServiceRegistration {
  readonly serviceId: string;
  readonly initialDetail?: string;
  readonly runtimeEventSource?: RuntimeEventSource;
}

export interface HttpManagedServiceManagerOptions {
  readonly registry: IManagedServiceDefinitionRegistry;
  readonly client: IManagedServiceSupervisorClient;
  readonly registrations?: ReadonlyArray<HttpManagedServiceRegistration>;
  readonly eventSink?: IRuntimeEventSink;
}

export class HttpManagedServiceManager
  implements IManagedServiceManager, IManagedServiceSupervisor, IManagedServiceStatusRefresher {
  private readonly registry: IManagedServiceDefinitionRegistry;
  private readonly client: IManagedServiceSupervisorClient;
  private readonly eventSink?: IRuntimeEventSink;
  private readonly registrations = new Map<string, HttpManagedServiceRegistration>();
  private readonly statusListeners = new Map<string, Set<ManagedServiceStatusListener>>();
  private readonly logListeners = new Map<string, Set<ManagedServiceLogListener>>();
  private readonly statuses = new Map<string, ManagedServiceStatus>();
  private readonly seenLogKeys = new Map<string, Set<string>>();

  constructor(options: HttpManagedServiceManagerOptions) {
    this.registry = options.registry;
    this.client = options.client;
    this.eventSink = options.eventSink;

    for (const registration of options.registrations ?? []) {
      this.registrations.set(registration.serviceId, registration);
    }

    for (const definition of this.registry.listDefinitions()) {
      const registration = this.registrations.get(definition.serviceId);
      this.statuses.set(
        definition.serviceId,
        createInitialStatus(definition, registration?.initialDetail),
      );
    }
  }

  public listServices(): ReadonlyArray<ManagedServiceDescriptor> {
    return Object.freeze(this.registry.listDefinitions().map((definition) => toManagedServiceDescriptor(definition)));
  }

  public getServiceStatus(serviceId: string): ManagedServiceStatus | undefined {
    return this.statuses.get(serviceId);
  }

  public subscribeToStatus(serviceId: string, listener: ManagedServiceStatusListener): ManagedServiceSubscription {
    const listeners = this.statusListeners.get(serviceId) ?? new Set<ManagedServiceStatusListener>();
    listeners.add(listener);
    this.statusListeners.set(serviceId, listeners);
    const status = this.statuses.get(serviceId);
    if (status) {
      listener(status);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.statusListeners.delete(serviceId);
      }
    };
  }

  public subscribeToLogs(serviceId: string, listener: ManagedServiceLogListener): ManagedServiceSubscription {
    const listeners = this.logListeners.get(serviceId) ?? new Set<ManagedServiceLogListener>();
    listeners.add(listener);
    this.logListeners.set(serviceId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.logListeners.delete(serviceId);
      }
    };
  }

  public async refreshServiceStatus(serviceId: string): Promise<ManagedServiceStatus> {
    const disabledStatus = this.resolveDisabledStatus(serviceId);
    if (disabledStatus) {
      return disabledStatus;
    }

    const response = await this.client.getService(serviceId);
    return this.applyServiceSnapshot(serviceId, response.service);
  }

  public async ensureRunning(serviceId: string): Promise<ManagedServiceStatus> {
    const disabledStatus = this.resolveDisabledStatus(serviceId);
    if (disabledStatus) {
      return disabledStatus;
    }

    const response = await this.client.ensureRunning(serviceId);
    return this.applyServiceSnapshot(serviceId, response.service);
  }

  public async start(serviceId: string): Promise<ManagedServiceStatus> {
    const disabledStatus = this.resolveDisabledStatus(serviceId);
    if (disabledStatus) {
      return disabledStatus;
    }

    const response = await this.client.start(serviceId);
    return this.applyServiceSnapshot(serviceId, response.service);
  }

  public async stop(serviceId: string): Promise<ManagedServiceStatus> {
    const disabledStatus = this.resolveDisabledStatus(serviceId);
    if (disabledStatus) {
      return disabledStatus;
    }

    const response = await this.client.stop(serviceId);
    return this.applyServiceSnapshot(serviceId, response.service);
  }

  public async restart(serviceId: string): Promise<ManagedServiceStatus> {
    const disabledStatus = this.resolveDisabledStatus(serviceId);
    if (disabledStatus) {
      return disabledStatus;
    }

    const response = await this.client.restart(serviceId);
    return this.applyServiceSnapshot(serviceId, response.service);
  }

  private applyServiceSnapshot(
    serviceId: string,
    service: Awaited<ReturnType<IManagedServiceSupervisorClient["getService"]>>["service"],
  ): ManagedServiceStatus {
    const definition = this.getDefinitionOrThrow(serviceId);
    const mappedStatus = mapSupervisorServiceToManagedServiceStatus(definition, service);
    this.statuses.set(serviceId, mappedStatus);
    this.statusListeners.get(serviceId)?.forEach((listener) => listener(mappedStatus));
    this.emitSnapshotLogs(serviceId, definition, service);
    return mappedStatus;
  }

  private emitSnapshotLogs(
    serviceId: string,
    definition: ManagedServiceDefinition,
    service: Awaited<ReturnType<IManagedServiceSupervisorClient["getService"]>>["service"],
  ): void {
    const seen = this.seenLogKeys.get(serviceId) ?? new Set<string>();
    this.seenLogKeys.set(serviceId, seen);

    for (const log of service.recentLogs) {
      const key = `${log.timestamp}:${log.level}:${log.message}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      this.emitLog(serviceId, definition, mapSupervisorLogLevelToManagedServiceLogLevel(log.level), log.message, log.timestamp);
    }
  }

  private emitLog(
    serviceId: string,
    definition: ManagedServiceDefinition,
    level: ManagedServiceLogEvent["level"],
    message: string,
    occurredAt: string,
  ): void {
    const event = Object.freeze({
      serviceId,
      kind: definition.kind,
      level,
      message,
      occurredAt,
    } satisfies ManagedServiceLogEvent);
    this.logListeners.get(serviceId)?.forEach((listener) => listener(event));

    if (this.eventSink) {
      const registration = this.registrations.get(serviceId);
      this.eventSink.emit({
        source: registration?.runtimeEventSource ?? RuntimeEventSources.app,
        severity: level === "warning" ? "info" : level,
        message,
        details: {
          serviceId,
        },
      });
    }
  }

  private resolveDisabledStatus(serviceId: string): ManagedServiceStatus | undefined {
    const definition = this.getDefinitionOrThrow(serviceId);
    if (definition.autoStartPolicy !== ManagedServiceStartPolicies.disabled) {
      return undefined;
    }

    const status = Object.freeze({
      ...this.statuses.get(serviceId),
      serviceId,
      kind: definition.kind,
      state: ManagedServiceStates.disabled,
      isAvailable: false,
      ownership: ManagedServiceOwnership.none,
      startPolicy: definition.autoStartPolicy,
      lastUpdatedAt: new Date().toISOString(),
      detail: this.statuses.get(serviceId)?.detail ?? `${definition.displayName} is disabled in settings.`,
    } satisfies ManagedServiceStatus);
    this.statuses.set(serviceId, status);
    this.statusListeners.get(serviceId)?.forEach((listener) => listener(status));
    return status;
  }

  private getDefinitionOrThrow(serviceId: string): ManagedServiceDefinition {
    const definition = this.registry.getDefinition(serviceId);
    if (!definition) {
      throw new Error(`Unknown managed service definition '${serviceId}'.`);
    }
    return definition;
  }
}

function createInitialStatus(
  definition: ManagedServiceDefinition,
  detail?: string,
): ManagedServiceStatus {
  return Object.freeze({
    serviceId: definition.serviceId,
    kind: definition.kind,
    state: definition.autoStartPolicy === ManagedServiceStartPolicies.disabled
      ? ManagedServiceStates.disabled
      : ManagedServiceStates.unavailable,
    isAvailable: false,
    ownership: ManagedServiceOwnership.none,
    startPolicy: definition.autoStartPolicy,
    lastUpdatedAt: new Date().toISOString(),
    detail: detail?.trim() || undefined,
  });
}

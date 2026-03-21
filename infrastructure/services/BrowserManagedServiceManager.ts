import type { IRuntimeEventSink } from "../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources, type RuntimeEventSource } from "../../application/runtime/RuntimeEvent";
import {
  toManagedServiceDescriptor,
  type ManagedServiceDefinition,
} from "../../application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRegistry } from "../../application/services/interfaces/IManagedServiceDefinitionRegistry";
import type { IManagedServiceManager } from "../../application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "../../application/services/interfaces/IManagedServiceStatusRefresher";
import type { IManagedServiceSupervisor } from "../../application/services/interfaces/IManagedServiceSupervisor";
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

export interface BrowserManagedServiceProbeResult {
  readonly state: ManagedServiceStatus["state"];
  readonly isAvailable: boolean;
  readonly ownership?: ManagedServiceStatus["ownership"];
  readonly detail?: string;
}

export interface BrowserManagedServiceRegistration {
  readonly serviceId: string;
  readonly initialDetail?: string;
  readonly runtimeEventSource?: RuntimeEventSource;
  readonly probe: () => Promise<BrowserManagedServiceProbeResult>;
}

export interface BrowserManagedServiceManagerOptions {
  readonly registry: IManagedServiceDefinitionRegistry;
  readonly registrations: ReadonlyArray<BrowserManagedServiceRegistration>;
  readonly eventSink?: IRuntimeEventSink;
}

export class BrowserManagedServiceManager implements IManagedServiceManager, IManagedServiceSupervisor, IManagedServiceStatusRefresher {
  private readonly registrations = new Map<string, BrowserManagedServiceRegistration>();
  private readonly statusListeners = new Map<string, Set<ManagedServiceStatusListener>>();
  private readonly logListeners = new Map<string, Set<ManagedServiceLogListener>>();
  private readonly statuses = new Map<string, ManagedServiceStatus>();
  private readonly eventSink?: IRuntimeEventSink;
  private readonly registry: IManagedServiceDefinitionRegistry;

  constructor(options: BrowserManagedServiceManagerOptions) {
    this.eventSink = options.eventSink;
    this.registry = options.registry;

    for (const registration of options.registrations) {
      const definition = this.getDefinitionOrThrow(registration.serviceId);
      this.registrations.set(registration.serviceId, registration);
      this.statuses.set(
        registration.serviceId,
        createInitialStatus(definition, registration.initialDetail),
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

  public async ensureRunning(serviceId: string): Promise<ManagedServiceStatus> {
    const registration = this.getRegistration(serviceId);
    const definition = this.getDefinitionOrThrow(serviceId);
    const current = this.getRequiredStatus(serviceId);

    if (definition.autoStartPolicy === ManagedServiceStartPolicies.disabled) {
      const disabledStatus = this.updateStatus(serviceId, {
        state: ManagedServiceStates.disabled,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        detail: current.detail ?? `${definition.displayName} is disabled in settings.`,
      });
      this.emitLog(serviceId, "info", `${definition.displayName} is disabled in browser settings.`);
      return disabledStatus;
    }

    this.emitLog(serviceId, "info", `Checking ${definition.displayName} health.`);

    const nextStatus = this.updateStatus(serviceId, await this.runProbe(registration, definition));

    if (nextStatus.isAvailable) {
      this.emitLog(serviceId, "success", `${definition.displayName} is healthy.`);
      return nextStatus;
    }

    if (nextStatus.state === ManagedServiceStates.degraded) {
      this.emitLog(serviceId, "info", `${definition.displayName} endpoint is reachable but not healthy.`);
    }

    this.emitLog(
      serviceId,
      "info",
      `Browser UI will continue without managing the ${definition.displayName.toLowerCase()} process.`,
    );

    return nextStatus;
  }

  public async refreshServiceStatus(serviceId: string): Promise<ManagedServiceStatus> {
    const registration = this.getRegistration(serviceId);
    const definition = this.getDefinitionOrThrow(serviceId);
    return this.updateStatus(serviceId, await this.runProbe(registration, definition));
  }

  public async start(serviceId: string): Promise<ManagedServiceStatus> {
    const registration = this.getRegistration(serviceId);
    const definition = this.getDefinitionOrThrow(serviceId);

    if (definition.autoStartPolicy === ManagedServiceStartPolicies.disabled) {
      return this.ensureRunning(serviceId);
    }

    const status = this.updateStatus(serviceId, await this.runProbe(registration, definition));

    if (
      definition.autoStartPolicy === ManagedServiceStartPolicies.externalOnly
      && !status.isAvailable
    ) {
      this.emitLog(
        serviceId,
        "info",
        `No managed ${definition.displayName.toLowerCase()} process is available in the browser environment.`,
      );
    }

    return status;
  }

  public async stop(serviceId: string): Promise<ManagedServiceStatus> {
    const definition = this.getDefinitionOrThrow(serviceId);
    const status = this.getRequiredStatus(serviceId);

    if (status.ownership !== ManagedServiceOwnership.managed) {
      this.emitLog(
        serviceId,
        "info",
        `No managed ${definition.displayName.toLowerCase()} process is available in the browser environment.`,
      );
      return status;
    }

    return this.updateStatus(serviceId, {
      state: ManagedServiceStates.stopped,
      isAvailable: false,
      ownership: ManagedServiceOwnership.managed,
      detail: `${definition.displayName} stopped.`,
    });
  }

  public async restart(serviceId: string): Promise<ManagedServiceStatus> {
    await this.stop(serviceId);
    return this.start(serviceId);
  }

  public async provision(serviceId: string): Promise<ManagedServiceStatus> {
    this.emitLog(serviceId, "info", "Provisioning is only available for managed local services.");
    return this.refreshServiceStatus(serviceId);
  }

  public async repair(serviceId: string): Promise<ManagedServiceStatus> {
    this.emitLog(serviceId, "info", "Repair is only available for managed local services.");
    return this.refreshServiceStatus(serviceId);
  }

  public async recreateEnvironment(serviceId: string): Promise<ManagedServiceStatus> {
    this.emitLog(serviceId, "info", "Environment recreation is only available for managed local services.");
    return this.refreshServiceStatus(serviceId);
  }

  private getRegistration(serviceId: string): BrowserManagedServiceRegistration {
    const registration = this.registrations.get(serviceId);
    if (!registration) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }
    return registration;
  }

  private getDefinitionOrThrow(serviceId: string): ManagedServiceDefinition {
    const definition = this.registry.getDefinition(serviceId);
    if (!definition) {
      throw new Error(`Unknown managed service definition '${serviceId}'.`);
    }
    return definition;
  }

  private getRequiredStatus(serviceId: string): ManagedServiceStatus {
    const status = this.statuses.get(serviceId);
    if (!status) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }
    return status;
  }

  private async runProbe(
    registration: BrowserManagedServiceRegistration,
    definition: ManagedServiceDefinition,
  ): Promise<Partial<ManagedServiceStatus>> {
    try {
      return await registration.probe();
    } catch {
      return {
        state: ManagedServiceStates.unavailable,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        detail: `${definition.displayName} is unavailable from the browser environment.`,
      };
    }
  }

  private updateStatus(serviceId: string, partial: Partial<ManagedServiceStatus>): ManagedServiceStatus {
    const definition = this.getDefinitionOrThrow(serviceId);
    const current = this.getRequiredStatus(serviceId);
    const next = Object.freeze({
      serviceId,
      kind: definition.kind,
      startPolicy: definition.autoStartPolicy,
      state: partial.state ?? current.state,
      isAvailable: partial.isAvailable ?? current.isAvailable,
      ownership: partial.ownership ?? current.ownership,
      lastUpdatedAt: partial.lastUpdatedAt ?? new Date().toISOString(),
      detail: partial.detail?.trim() || undefined,
    } satisfies ManagedServiceStatus);
    this.statuses.set(serviceId, next);
    this.statusListeners.get(serviceId)?.forEach((listener) => listener(next));
    return next;
  }

  private emitLog(serviceId: string, level: ManagedServiceLogEvent["level"], message: string): void {
    const definition = this.getDefinitionOrThrow(serviceId);
    const registration = this.getRegistration(serviceId);
    const event = Object.freeze({
      serviceId,
      kind: definition.kind,
      level,
      message,
      occurredAt: new Date().toISOString(),
    } satisfies ManagedServiceLogEvent);
    this.logListeners.get(serviceId)?.forEach((listener) => listener(event));

    if (this.eventSink) {
      this.eventSink.emit({
        source: registration.runtimeEventSource ?? RuntimeEventSources.app,
        severity: level === "warning" ? "info" : level,
        message,
        details: {
          serviceId,
        },
      });
    }
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

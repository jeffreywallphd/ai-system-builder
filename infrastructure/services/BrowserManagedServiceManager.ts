import type { IRuntimeEventSink } from "../../application/ports/interfaces/IRuntimeEventSink";
import { RuntimeEventSources, type RuntimeEventSource } from "../../application/runtime/RuntimeEvent";
import type { IManagedServiceManager } from "../../application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceSupervisor } from "../../application/services/interfaces/IManagedServiceSupervisor";
import {
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
  type ManagedServiceDescriptor,
  type ManagedServiceLogEvent,
  type ManagedServiceStatus,
  type ManagedServiceSubscription,
  type ManagedServiceLogListener,
  type ManagedServiceStatusListener,
} from "../../application/services/interfaces/ManagedServiceTypes";

export interface BrowserManagedServiceProbeResult {
  readonly state: ManagedServiceStatus["state"];
  readonly isAvailable: boolean;
  readonly ownership?: ManagedServiceStatus["ownership"];
  readonly detail?: string;
}

export interface BrowserManagedServiceRegistration {
  readonly descriptor: ManagedServiceDescriptor;
  readonly initialDetail?: string;
  readonly runtimeEventSource?: RuntimeEventSource;
  readonly probe: () => Promise<BrowserManagedServiceProbeResult>;
}

export interface BrowserManagedServiceManagerOptions {
  readonly registrations: ReadonlyArray<BrowserManagedServiceRegistration>;
  readonly eventSink?: IRuntimeEventSink;
}

export class BrowserManagedServiceManager implements IManagedServiceManager, IManagedServiceSupervisor {
  private readonly registrations = new Map<string, BrowserManagedServiceRegistration>();
  private readonly statusListeners = new Map<string, Set<ManagedServiceStatusListener>>();
  private readonly logListeners = new Map<string, Set<ManagedServiceLogListener>>();
  private readonly statuses = new Map<string, ManagedServiceStatus>();
  private readonly eventSink?: IRuntimeEventSink;

  constructor(options: BrowserManagedServiceManagerOptions) {
    this.eventSink = options.eventSink;

    for (const registration of options.registrations) {
      this.registrations.set(registration.descriptor.id, registration);
      this.statuses.set(
        registration.descriptor.id,
        createInitialStatus(registration.descriptor, registration.initialDetail),
      );
    }
  }

  public listServices(): ReadonlyArray<ManagedServiceDescriptor> {
    return Object.freeze([...this.registrations.values()].map(({ descriptor }) => descriptor));
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
    const current = this.getRequiredStatus(serviceId);

    if (registration.descriptor.startPolicy === ManagedServiceStartPolicies.disabled) {
      const disabledStatus = this.updateStatus(serviceId, {
        state: ManagedServiceStates.disabled,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        detail: current.detail ?? `${registration.descriptor.name} is disabled in settings.`,
      });
      this.emitLog(serviceId, "info", `${registration.descriptor.name} is disabled in browser settings.`);
      return disabledStatus;
    }

    this.emitLog(serviceId, "info", `Checking ${registration.descriptor.name} health.`);

    const nextStatus = this.updateStatus(serviceId, await this.runProbe(registration));

    if (nextStatus.isAvailable) {
      this.emitLog(serviceId, "success", `${registration.descriptor.name} is healthy.`);
      return nextStatus;
    }

    if (nextStatus.state === ManagedServiceStates.degraded) {
      this.emitLog(
        serviceId,
        "info",
        `${registration.descriptor.name} endpoint is reachable but not healthy.`,
      );
    }

    this.emitLog(
      serviceId,
      "info",
      `Browser UI will continue without managing the ${registration.descriptor.name.toLowerCase()} process.`,
    );

    return nextStatus;
  }

  public async start(serviceId: string): Promise<ManagedServiceStatus> {
    const registration = this.getRegistration(serviceId);

    if (registration.descriptor.startPolicy === ManagedServiceStartPolicies.disabled) {
      return this.ensureRunning(serviceId);
    }

    const status = this.updateStatus(serviceId, await this.runProbe(registration));

    if (
      registration.descriptor.startPolicy === ManagedServiceStartPolicies.externalOnly
      && !status.isAvailable
    ) {
      this.emitLog(
        serviceId,
        "info",
        `No managed ${registration.descriptor.name.toLowerCase()} process is available in the browser environment.`,
      );
    }

    return status;
  }

  public async stop(serviceId: string): Promise<ManagedServiceStatus> {
    const registration = this.getRegistration(serviceId);
    const status = this.getRequiredStatus(serviceId);

    if (status.ownership !== ManagedServiceOwnership.managed) {
      this.emitLog(
        serviceId,
        "info",
        `No managed ${registration.descriptor.name.toLowerCase()} process is available in the browser environment.`,
      );
      return status;
    }

    return this.updateStatus(serviceId, {
      state: ManagedServiceStates.stopped,
      isAvailable: false,
      ownership: ManagedServiceOwnership.managed,
      detail: `${registration.descriptor.name} stopped.`,
    });
  }

  public async restart(serviceId: string): Promise<ManagedServiceStatus> {
    await this.stop(serviceId);
    return this.start(serviceId);
  }

  private getRegistration(serviceId: string): BrowserManagedServiceRegistration {
    const registration = this.registrations.get(serviceId);
    if (!registration) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }
    return registration;
  }

  private getRequiredStatus(serviceId: string): ManagedServiceStatus {
    const status = this.statuses.get(serviceId);
    if (!status) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }
    return status;
  }

  private async runProbe(registration: BrowserManagedServiceRegistration): Promise<Partial<ManagedServiceStatus>> {
    try {
      return await registration.probe();
    } catch {
      return {
        state: ManagedServiceStates.unavailable,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        detail: `${registration.descriptor.name} is unavailable from the browser environment.`,
      };
    }
  }

  private updateStatus(serviceId: string, partial: Partial<ManagedServiceStatus>): ManagedServiceStatus {
    const registration = this.getRegistration(serviceId);
    const current = this.getRequiredStatus(serviceId);
    const next = Object.freeze({
      serviceId,
      kind: registration.descriptor.kind,
      startPolicy: registration.descriptor.startPolicy,
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
    const registration = this.getRegistration(serviceId);
    const event = Object.freeze({
      serviceId,
      kind: registration.descriptor.kind,
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
      });
    }
  }
}

function createInitialStatus(
  descriptor: ManagedServiceDescriptor,
  detail?: string,
): ManagedServiceStatus {
  return Object.freeze({
    serviceId: descriptor.id,
    kind: descriptor.kind,
    state: descriptor.startPolicy === ManagedServiceStartPolicies.disabled
      ? ManagedServiceStates.disabled
      : ManagedServiceStates.unavailable,
    isAvailable: false,
    ownership: ManagedServiceOwnership.none,
    startPolicy: descriptor.startPolicy,
    lastUpdatedAt: new Date().toISOString(),
    detail: detail?.trim() || undefined,
  });
}

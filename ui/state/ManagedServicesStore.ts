import type { RuntimeEvent } from "../../application/runtime/RuntimeEvent";
import {
  appendDistinctRuntimeEvent,
  collapseConsecutiveRuntimeEvents,
} from "../../application/runtime/RuntimeEventStability";
import type { ManagedServiceDefinitionInput } from "../../application/services/ManagedServiceDefinition";
import type { ManagedServiceRecord, ManagedServicesService } from "../services/ManagedServicesService";
import type { ManagedServiceEventStream } from "../services/ManagedServiceEventStream";

export interface ManagedServicesStoreState {
  readonly services: ReadonlyArray<ManagedServiceRecord>;
  readonly selectedServiceId?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly streamState: "idle" | "connecting" | "live" | "reconnecting";
  readonly error?: string;
}

export type ManagedServicesStoreListener = (state: ManagedServicesStoreState) => void;

const defaultState: ManagedServicesStoreState = Object.freeze({
  services: Object.freeze([]),
  selectedServiceId: undefined,
  recentLogs: Object.freeze([]),
  isLoading: false,
  isMutating: false,
  streamState: "idle",
  error: undefined,
});

export class ManagedServicesStore {
  private state: ManagedServicesStoreState = defaultState;
  private readonly listeners = new Set<ManagedServicesStoreListener>();
  private readonly eventStream?: ManagedServiceEventStream;
  private unsubscribeEventStream?: () => void;
  private isInitialized = false;

  constructor(
    private readonly managedServicesService: ManagedServicesService,
    eventStream?: ManagedServiceEventStream,
  ) {
    this.eventStream = eventStream;
  }

  public getState(): ManagedServicesStoreState {
    return this.state;
  }

  public subscribe(listener: ManagedServicesStoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public async initialize(): Promise<void> {
    await this.refresh();
    this.connectEventStream();
    this.isInitialized = true;
  }

  public dispose(): void {
    this.unsubscribeEventStream?.();
    this.unsubscribeEventStream = undefined;
  }

  public async refresh(serviceId = this.state.selectedServiceId): Promise<void> {
    this.patch({ isLoading: true, error: undefined });

    try {
      const services = await this.managedServicesService.listServices();
      const selectedServiceId = resolveSelectedServiceId(services, serviceId);
      const selectedService = selectedServiceId
        ? services.find((service) => service.id === selectedServiceId)
        : services[0];

      this.patch({
        services: Object.freeze([...services]),
        selectedServiceId: selectedService?.id,
        recentLogs: collapseConsecutiveRuntimeEvents(selectedService?.recentLogs ?? []),
        isLoading: false,
      });
    } catch (error) {
      this.patch({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public selectService(serviceId: string | undefined): void {
    const normalizedId = serviceId?.trim() || undefined;
    const selectedService = normalizedId
      ? this.state.services.find((service) => service.id === normalizedId)
      : this.state.services[0];

    this.patch({
      selectedServiceId: selectedService?.id,
      recentLogs: collapseConsecutiveRuntimeEvents(selectedService?.recentLogs ?? []),
    });
  }

  public async createService(definition: ManagedServiceDefinitionInput): Promise<void> {
    await this.runMutation(undefined, () => this.managedServicesService.createService(definition));
  }

  public async updateService(serviceId: string, patch: ManagedServiceDefinitionInput): Promise<void> {
    await this.runMutation(serviceId, (id) => this.managedServicesService.updateService(id, patch));
  }

  public async removeService(serviceId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      await this.managedServicesService.removeService(serviceId);
      const nextSelected = this.state.selectedServiceId === serviceId ? undefined : this.state.selectedServiceId;
      this.patch({ isMutating: false });
      await this.refresh(nextSelected);
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  public async start(serviceId: string): Promise<void> {
    await this.runMutation(serviceId, (id) => this.managedServicesService.startService(id));
  }

  public async stop(serviceId: string): Promise<void> {
    await this.runMutation(serviceId, (id) => this.managedServicesService.stopService(id));
  }

  public async restart(serviceId: string): Promise<void> {
    await this.runMutation(serviceId, (id) => this.managedServicesService.restartService(id));
  }

  public async ensureRunning(serviceId: string): Promise<void> {
    await this.runMutation(serviceId, (id) => this.managedServicesService.ensureRunning(id));
  }

  public async startCapability(capabilityId: string): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      const updatedServices = await this.managedServicesService.startCapability(capabilityId);
      const serviceIds = new Set(updatedServices.map((service) => service.id));
      const services = this.state.services
        .map((service) => updatedServices.find((updated) => updated.id === service.id) ?? service)
        .concat(updatedServices.filter((service) => !this.state.services.some((entry) => entry.id === service.id)))
        .filter((service, index, entries) => entries.findIndex((entry) => entry.id === service.id) === index);
      const selectedService = (updatedServices.length > 0
        ? updatedServices[updatedServices.length - 1]
        : undefined)
        ?? services.find((service) => serviceIds.has(service.id))
        ?? services[0];

      this.patch({
        services: Object.freeze([...services]),
        selectedServiceId: selectedService?.id,
        recentLogs: collapseConsecutiveRuntimeEvents(selectedService?.recentLogs ?? []),
        isMutating: false,
      });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private async runMutation(
    serviceId: string | undefined,
    action: (serviceId: string) => Promise<ManagedServiceRecord>,
  ): Promise<void> {
    this.patch({ isMutating: true, error: undefined });

    try {
      const updatedService = await action(serviceId ?? "");
      const existing = this.state.services.some((service) => service.id === updatedService.id);
      const services = existing
        ? this.state.services.map((service) => service.id === updatedService.id ? updatedService : service)
        : [...this.state.services, updatedService];
      this.patch({
        services: Object.freeze([...services]),
        selectedServiceId: updatedService.id,
        recentLogs: collapseConsecutiveRuntimeEvents(updatedService.recentLogs),
        isMutating: false,
      });
    } catch (error) {
      this.patch({ isMutating: false, error: toErrorMessage(error) });
      throw error;
    }
  }

  private patch(patch: Partial<ManagedServicesStoreState>): void {
    this.state = Object.freeze({
      ...this.state,
      ...patch,
      services: patch.services ? Object.freeze([...patch.services]) : this.state.services,
      recentLogs: patch.recentLogs ? collapseConsecutiveRuntimeEvents(patch.recentLogs) : this.state.recentLogs,
      selectedServiceId: Object.prototype.hasOwnProperty.call(patch, "selectedServiceId")
        ? patch.selectedServiceId
        : this.state.selectedServiceId,
      error: Object.prototype.hasOwnProperty.call(patch, "error")
        ? patch.error
        : this.state.error,
    });

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private connectEventStream(): void {
    if (!this.eventStream || this.unsubscribeEventStream) {
      return;
    }

    this.unsubscribeEventStream = this.eventStream.connect({
      onSnapshot: (event) => {
        void this.syncSupervisorSnapshot(event.services);
      },
      onStateChange: (event) => {
        void this.upsertSupervisorService(event.service);
      },
      onLog: (event) => {
        void this.upsertSupervisorService(event.service).then(() => {
          if (!event.service) {
            this.appendLogToSelectedService(event.serviceId, event.entry);
          }
        });
      },
      onRestart: (event) => {
        if (event.service) {
          void this.upsertSupervisorService(event.service);
        }
      },
      onHealthChange: (event) => {
        void this.upsertSupervisorService(event.service);
      },
      onConnectionStateChange: (state) => {
        this.patch({
          streamState: state === "open"
            ? "live"
            : this.isInitialized
              ? "reconnecting"
              : "connecting",
        });
      },
      onError: (error) => {
        this.patch({ error: error.message, streamState: "reconnecting" });
      },
    });
  }

  private async syncSupervisorSnapshot(services: ReadonlyArray<any>): Promise<void> {
    const records = await this.managedServicesService.listServicesFromSupervisor(services);
    const selectedServiceId = resolveSelectedServiceId(records, this.state.selectedServiceId);
    const selectedService = selectedServiceId
      ? records.find((service) => service.id === selectedServiceId)
      : records[0];

    this.patch({
      services: Object.freeze([...records]),
      selectedServiceId: selectedService?.id,
      recentLogs: collapseConsecutiveRuntimeEvents(selectedService?.recentLogs ?? []),
      error: undefined,
    });
  }

  private async upsertSupervisorService(service: any): Promise<void> {
    if (!service) {
      return;
    }

    const mapped = await this.managedServicesService.mapSupervisorServiceRecord(service);
    const existing = this.state.services.some((entry) => entry.id === mapped.id);
    const services = existing
      ? this.state.services.map((entry) => entry.id === mapped.id ? mapped : entry)
      : [...this.state.services, mapped];
    const selectedService = services.find((entry) => entry.id === (this.state.selectedServiceId ?? mapped.id))
      ?? services[0];

    this.patch({
      services: Object.freeze([...services]),
      selectedServiceId: selectedService?.id,
      recentLogs: collapseConsecutiveRuntimeEvents(selectedService?.recentLogs ?? []),
      error: undefined,
    });
  }

  private appendLogToSelectedService(serviceId: string, entry: { timestamp: string; level: string; message: string }): void {
    const service = this.state.services.find((candidate) => candidate.id === serviceId);
    if (!service) {
      return;
    }

    const severity = entry.level === "stderr" ? "error" : entry.level === "stdout" ? "info" : entry.level as RuntimeEvent["severity"];
    const runtimeEvent = Object.freeze({
      id: `${serviceId}:${entry.timestamp}:${entry.level}:${entry.message}`,
      timestamp: entry.timestamp,
      source: "python-runtime",
      severity,
      message: entry.message,
    } satisfies RuntimeEvent);
    const updatedLogs = appendDistinctRuntimeEvent(service.recentLogs, runtimeEvent, 200);
    if (updatedLogs === service.recentLogs) {
      return;
    }

    const updatedService = Object.freeze({
      ...service,
      recentLogs: updatedLogs,
    });
    const services = this.state.services.map((candidate) => candidate.id === serviceId ? updatedService : candidate);

    this.patch({
      services: Object.freeze(services),
      recentLogs: this.state.selectedServiceId === serviceId
        ? collapseConsecutiveRuntimeEvents(updatedService.recentLogs)
        : this.state.recentLogs,
    });
  }
}

function resolveSelectedServiceId(
  services: ReadonlyArray<ManagedServiceRecord>,
  currentServiceId?: string,
): string | undefined {
  if (currentServiceId && services.some((service) => service.id === currentServiceId)) {
    return currentServiceId;
  }

  return services[0]?.id;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown managed service error.";
}

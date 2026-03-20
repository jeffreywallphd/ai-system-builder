import type { RuntimeEvent } from "../../application/runtime/RuntimeEvent";
import type { ManagedServiceDefinitionInput } from "../../application/services/ManagedServiceDefinition";
import type { ManagedServiceRecord, ManagedServicesService } from "../services/ManagedServicesService";

export interface ManagedServicesStoreState {
  readonly services: ReadonlyArray<ManagedServiceRecord>;
  readonly selectedServiceId?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error?: string;
}

export type ManagedServicesStoreListener = (state: ManagedServicesStoreState) => void;

const defaultState: ManagedServicesStoreState = Object.freeze({
  services: Object.freeze([]),
  selectedServiceId: undefined,
  recentLogs: Object.freeze([]),
  isLoading: false,
  isMutating: false,
  error: undefined,
});

export class ManagedServicesStore {
  private state: ManagedServicesStoreState = defaultState;
  private readonly listeners = new Set<ManagedServicesStoreListener>();

  constructor(private readonly managedServicesService: ManagedServicesService) {}

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
        recentLogs: Object.freeze([...(selectedService?.recentLogs ?? [])]),
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
      recentLogs: Object.freeze([...(selectedService?.recentLogs ?? [])]),
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
        recentLogs: Object.freeze([...updatedService.recentLogs]),
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
      recentLogs: patch.recentLogs ? Object.freeze([...patch.recentLogs]) : this.state.recentLogs,
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

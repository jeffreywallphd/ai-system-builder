import type { IPythonRuntimeManager, PythonRuntimeManagerStatus } from "../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventStore } from "../../application/ports/interfaces/IRuntimeEventStore";
import { RuntimeEventSources, type RuntimeEvent } from "../../application/runtime/RuntimeEvent";
import type { ManagedServiceDefinition } from "../../application/services/ManagedServiceDefinition";

export interface ManagedServiceRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ManagedServiceDefinition["kind"];
  readonly description?: string;
  readonly startPolicy: ManagedServiceDefinition["autoStartPolicy"];
  readonly state: PythonRuntimeManagerStatus["status"];
  readonly ownership: PythonRuntimeManagerStatus["owner"];
  readonly isAvailable: boolean;
  readonly baseUrl?: string;
  readonly endpointSummary?: string;
  readonly lastCheckedAt: string;
  readonly lastErrorDetail?: string;
  readonly detail?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
}

export class ManagedServicesService {
  constructor(
    private readonly pythonRuntimeManager: IPythonRuntimeManager,
    private readonly runtimeEventStore: IRuntimeEventStore,
    private readonly pythonRuntimeDefinition: ManagedServiceDefinition,
  ) {}

  public async listServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    await this.refreshPythonRuntime();
    return this.getServices();
  }

  public getServices(): ReadonlyArray<ManagedServiceRecord> {
    return Object.freeze([this.buildPythonRuntimeRecord(this.pythonRuntimeManager.getStatus())]);
  }

  public async refreshService(serviceId: string): Promise<ManagedServiceRecord> {
    this.assertServiceId(serviceId);
    await this.refreshPythonRuntime();
    return this.getService(serviceId);
  }

  public getService(serviceId: string): ManagedServiceRecord {
    this.assertServiceId(serviceId);
    return this.buildPythonRuntimeRecord(this.pythonRuntimeManager.getStatus());
  }

  public async startService(serviceId: string): Promise<ManagedServiceRecord> {
    this.assertServiceId(serviceId);
    await this.pythonRuntimeManager.ensureRuntimeAvailability();
    return this.getService(serviceId);
  }

  public async stopService(serviceId: string): Promise<ManagedServiceRecord> {
    this.assertServiceId(serviceId);
    await this.pythonRuntimeManager.stopManagedRuntime();
    return this.getService(serviceId);
  }

  public async restartService(serviceId: string): Promise<ManagedServiceRecord> {
    this.assertServiceId(serviceId);
    await this.pythonRuntimeManager.stopManagedRuntime();
    await this.pythonRuntimeManager.ensureRuntimeAvailability();
    return this.getService(serviceId);
  }

  public async ensureRunning(serviceId: string): Promise<ManagedServiceRecord> {
    this.assertServiceId(serviceId);
    await this.pythonRuntimeManager.ensureRuntimeAvailability();
    return this.getService(serviceId);
  }

  private async refreshPythonRuntime(): Promise<void> {
    await this.pythonRuntimeManager.checkAvailability();
  }

  private buildPythonRuntimeRecord(status: PythonRuntimeManagerStatus): ManagedServiceRecord {
    const lastErrorDetail = isServiceInErrorState(status.status)
      ? status.detail ?? "Runtime is not currently healthy."
      : undefined;

    return Object.freeze({
      id: this.pythonRuntimeDefinition.serviceId,
      name: this.pythonRuntimeDefinition.displayName,
      kind: this.pythonRuntimeDefinition.kind,
      description: this.pythonRuntimeDefinition.description,
      startPolicy: this.pythonRuntimeDefinition.autoStartPolicy,
      state: status.status,
      ownership: status.owner,
      isAvailable: status.isAvailable,
      baseUrl: this.pythonRuntimeDefinition.baseUrl,
      endpointSummary: summarizeEndpoints(this.pythonRuntimeDefinition),
      lastCheckedAt: status.lastUpdatedAt,
      lastErrorDetail,
      detail: status.detail,
      recentLogs: Object.freeze(this.getRuntimeEvents()),
    });
  }

  private getRuntimeEvents(): ReadonlyArray<RuntimeEvent> {
    return this.runtimeEventStore
      .list()
      .filter((event) => event.source === RuntimeEventSources.pythonRuntime)
      .slice(-40);
  }

  private assertServiceId(serviceId: string): void {
    if (serviceId !== this.pythonRuntimeDefinition.serviceId) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }
  }
}

function summarizeEndpoints(definition: ManagedServiceDefinition): string | undefined {
  const baseUrl = definition.baseUrl?.trim();
  if (!baseUrl) {
    return undefined;
  }

  const healthPath = definition.healthCheckPath?.trim();
  return healthPath ? `${baseUrl}${healthPath}` : baseUrl;
}

function isServiceInErrorState(status: PythonRuntimeManagerStatus["status"]): boolean {
  return status === "failed" || status === "unhealthy" || status === "unavailable";
}

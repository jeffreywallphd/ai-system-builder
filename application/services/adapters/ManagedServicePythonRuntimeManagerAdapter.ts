import type { IPythonRuntimeManager, PythonRuntimeManagerStatus } from "../../ports/interfaces/IPythonRuntimeManager";
import type { IManagedServiceManager } from "../interfaces/IManagedServiceManager";
import type { IManagedServiceSupervisor } from "../interfaces/IManagedServiceSupervisor";
import { PYTHON_RUNTIME_MANAGED_SERVICE_ID } from "../ManagedServiceIds";
import {
  ManagedServiceOwnership,
  ManagedServiceStates,
  type ManagedServiceStatus,
} from "../interfaces/ManagedServiceTypes";

export interface ManagedServicePythonRuntimeManagerAdapterOptions {
  readonly manager: IManagedServiceManager;
  readonly supervisor: IManagedServiceSupervisor;
  readonly serviceId?: string;
}

export class ManagedServicePythonRuntimeManagerAdapter implements IPythonRuntimeManager {
  private readonly manager: IManagedServiceManager;
  private readonly supervisor: IManagedServiceSupervisor;
  private readonly serviceId: string;
  private cachedStatus: PythonRuntimeManagerStatus;

  constructor(options: ManagedServicePythonRuntimeManagerAdapterOptions) {
    this.manager = options.manager;
    this.supervisor = options.supervisor;
    this.serviceId = options.serviceId ?? PYTHON_RUNTIME_MANAGED_SERVICE_ID;
    this.cachedStatus = mapManagedServiceStatus(
      this.manager.getServiceStatus(this.serviceId) ?? createUnavailableStatus(this.serviceId),
    );
  }

  public async checkAvailability(): Promise<boolean> {
    const status = await this.supervisor.start(this.serviceId);
    this.cachedStatus = mapManagedServiceStatus(status);
    return this.cachedStatus.isAvailable;
  }

  public async ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    const status = await this.supervisor.ensureRunning(this.serviceId);
    this.cachedStatus = mapManagedServiceStatus(status);
    return this.cachedStatus;
  }

  public getStatus(): PythonRuntimeManagerStatus {
    const status = this.manager.getServiceStatus(this.serviceId);
    if (status) {
      this.cachedStatus = mapManagedServiceStatus(status);
    }

    return this.cachedStatus;
  }

  public async stopManagedRuntime(): Promise<void> {
    const status = await this.supervisor.stop(this.serviceId);
    this.cachedStatus = mapManagedServiceStatus(status);
  }
}

function createUnavailableStatus(serviceId: string): ManagedServiceStatus {
  return {
    serviceId,
    kind: "python-runtime",
    state: ManagedServiceStates.unavailable,
    isAvailable: false,
    ownership: ManagedServiceOwnership.none,
    startPolicy: "external-only",
    lastUpdatedAt: new Date().toISOString(),
    detail: "Python runtime is not connected.",
  };
}

function mapManagedServiceStatus(status: ManagedServiceStatus): PythonRuntimeManagerStatus {
  return {
    status: mapManagedServiceState(status),
    isAvailable: status.isAvailable,
    owner: status.ownership,
    lastUpdatedAt: status.lastUpdatedAt,
    detail: status.detail,
  };
}

function mapManagedServiceState(status: ManagedServiceStatus): PythonRuntimeManagerStatus["status"] {
  switch (status.state) {
    case ManagedServiceStates.running:
      return status.isAvailable ? "healthy" : "unhealthy";
    case ManagedServiceStates.degraded:
      return "unhealthy";
    case ManagedServiceStates.starting:
      return "starting";
    case ManagedServiceStates.failed:
      return "failed";
    case ManagedServiceStates.stopping:
      return "stopping";
    case ManagedServiceStates.stopped:
      return "stopped";
    case ManagedServiceStates.disabled:
    case ManagedServiceStates.unavailable:
    default:
      return "unavailable";
  }
}

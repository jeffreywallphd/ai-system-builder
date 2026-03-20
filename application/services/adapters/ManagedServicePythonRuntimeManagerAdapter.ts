import type { IPythonRuntimeManager, PythonRuntimeManagerStatus } from "../../ports/interfaces/IPythonRuntimeManager";
import type { IManagedServiceManager } from "../interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "../interfaces/IManagedServiceStatusRefresher";
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
  readonly startupTimeoutMs?: number;
  readonly healthPollIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export class ManagedServicePythonRuntimeManagerAdapter implements IPythonRuntimeManager {
  private readonly manager: IManagedServiceManager;
  private readonly supervisor: IManagedServiceSupervisor;
  private readonly serviceId: string;
  private readonly startupTimeoutMs: number;
  private readonly healthPollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private cachedStatus: PythonRuntimeManagerStatus;

  constructor(options: ManagedServicePythonRuntimeManagerAdapterOptions) {
    this.manager = options.manager;
    this.supervisor = options.supervisor;
    this.serviceId = options.serviceId ?? PYTHON_RUNTIME_MANAGED_SERVICE_ID;
    this.startupTimeoutMs = options.startupTimeoutMs ?? 20_000;
    this.healthPollIntervalMs = options.healthPollIntervalMs ?? 500;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.cachedStatus = mapManagedServiceStatus(
      this.manager.getServiceStatus(this.serviceId) ?? createUnavailableStatus(this.serviceId),
    );
  }

  public async checkAvailability(): Promise<boolean> {
    const status = hasStatusRefresher(this.manager)
      ? await this.manager.refreshServiceStatus(this.serviceId)
      : await this.supervisor.start(this.serviceId);
    this.cachedStatus = mapManagedServiceStatus(status);
    return this.cachedStatus.isAvailable;
  }

  public async ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus> {
    const status = await this.supervisor.ensureRunning(this.serviceId);
    this.cachedStatus = await this.waitForReadiness(status, "startup");
    return this.cachedStatus;
  }

  public async restartRuntime(): Promise<PythonRuntimeManagerStatus> {
    const status = await this.supervisor.restart(this.serviceId);
    this.cachedStatus = await this.waitForReadiness(status, "restart");
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

  private async waitForReadiness(
    initialStatus: ManagedServiceStatus,
    action: "startup" | "restart",
  ): Promise<PythonRuntimeManagerStatus> {
    let mappedStatus = mapManagedServiceStatus(initialStatus);
    if (isReadyStatus(mappedStatus) || !shouldPollForReadiness(mappedStatus) || !hasStatusRefresher(this.manager)) {
      return mappedStatus;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < this.startupTimeoutMs) {
      await this.sleep(this.healthPollIntervalMs);
      mappedStatus = mapManagedServiceStatus(await this.manager.refreshServiceStatus(this.serviceId));
      if (isReadyStatus(mappedStatus) || !shouldPollForReadiness(mappedStatus)) {
        return mappedStatus;
      }
    }

    return {
      ...mappedStatus,
      detail: mappedStatus.detail
        ? `${mappedStatus.detail} Timed out waiting for runtime readiness after ${this.startupTimeoutMs}ms.`
        : `Timed out waiting for runtime ${action} readiness after ${this.startupTimeoutMs}ms.`,
    };
  }
}

function hasStatusRefresher(
  manager: IManagedServiceManager,
): manager is IManagedServiceManager & IManagedServiceStatusRefresher {
  return typeof (manager as Partial<IManagedServiceStatusRefresher>).refreshServiceStatus === "function";
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

function isReadyStatus(status: PythonRuntimeManagerStatus): boolean {
  return status.status === "healthy";
}

function shouldPollForReadiness(status: PythonRuntimeManagerStatus): boolean {
  return status.status === "starting" || status.status === "unhealthy";
}

import type { IRuntimeEventStore } from "../../application/ports/interfaces/IRuntimeEventStore";
import { RuntimeEventSources, type RuntimeEvent } from "../../application/runtime/RuntimeEvent";
import type {
  ManagedSupervisorServiceLogEntry,
  ManagedSupervisorServiceRecord,
} from "../../application/services/interfaces/IManagedServiceSupervisorClient";
import {
  createManagedServiceDefinition,
  getManagedServiceHealthUrl,
  ManagedServiceSources,
  mergeBuiltinManagedServiceDefinition,
  type ManagedServiceDefinition,
  type ManagedServiceDefinitionInput,
} from "../../application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRepository } from "../../application/services/interfaces/IManagedServiceDefinitionRepository";
import type { IManagedServiceManager } from "../../application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "../../application/services/interfaces/IManagedServiceStatusRefresher";
import type { IManagedServiceSupervisor } from "../../application/services/interfaces/IManagedServiceSupervisor";
import {
  ManagedServiceOwnership,
  ManagedServiceStates,
  type ManagedServiceState,
  type ManagedServiceStatus,
} from "../../application/services/interfaces/ManagedServiceTypes";

export interface ManagedServiceRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ManagedServiceDefinition["kind"];
  readonly description?: string;
  readonly source: ManagedServiceDefinition["source"];
  readonly startPolicy: ManagedServiceDefinition["autoStartPolicy"];
  readonly restartPolicy: ManagedServiceDefinition["restartPolicy"];
  readonly state: ManagedServiceState;
  readonly ownership: ManagedServiceStatus["ownership"];
  readonly isAvailable: boolean;
  readonly transport: ManagedServiceDefinition["transport"];
  readonly baseUrl?: string;
  readonly endpointSummary?: string;
  readonly workingDirectory?: string;
  readonly command?: string;
  readonly args: ReadonlyArray<string>;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly startupTimeoutMs: number;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly canManageLifecycle: boolean;
  readonly lastCheckedAt: string;
  readonly lastErrorDetail?: string;
  readonly detail?: string;
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
}

export interface ManagedServicesServiceOptions {
  readonly serviceManager: IManagedServiceManager;
  readonly serviceSupervisor?: IManagedServiceSupervisor;
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly builtinDefinitions: ReadonlyArray<ManagedServiceDefinition>;
  readonly definitionRepository: IManagedServiceDefinitionRepository;
  readonly fetchImplementation?: typeof fetch;
}

export class ManagedServicesService {
  private readonly serviceManager: IManagedServiceManager;
  private readonly serviceSupervisor?: IManagedServiceSupervisor;
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly builtinDefinitions = new Map<string, ManagedServiceDefinition>();
  private readonly definitionRepository: IManagedServiceDefinitionRepository;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ManagedServicesServiceOptions) {
    this.serviceManager = options.serviceManager;
    this.serviceSupervisor = options.serviceSupervisor;
    this.runtimeEventStore = options.runtimeEventStore;
    this.definitionRepository = options.definitionRepository;
    this.fetchImplementation = options.fetchImplementation ?? fetch;

    for (const definition of options.builtinDefinitions) {
      this.builtinDefinitions.set(definition.serviceId, definition);
    }
  }

  public async listServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    await this.refreshManagedServices();
    return this.getServices();
  }

  public async getServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    const definitions = await this.listDefinitions();
    const records = await Promise.all(definitions.map((definition) => this.buildRecord(definition)));
    return Object.freeze(records);
  }

  public async refreshService(serviceId: string): Promise<ManagedServiceRecord> {
    const definition = await this.requireDefinition(serviceId);
    if (this.isRegisteredManagedService(definition.serviceId)) {
      await this.refreshManagedService(definition.serviceId);
    }
    return this.buildRecord(definition);
  }

  public async getService(serviceId: string): Promise<ManagedServiceRecord> {
    const definition = await this.requireDefinition(serviceId);
    return this.buildRecord(definition);
  }

  public async createService(definition: ManagedServiceDefinitionInput): Promise<ManagedServiceRecord> {
    const normalized = createManagedServiceDefinition({
      ...definition,
      source: ManagedServiceSources.custom,
    });

    if (this.builtinDefinitions.has(normalized.serviceId)) {
      throw new Error(`Managed service '${normalized.serviceId}' is reserved for a built-in service.`);
    }

    await this.definitionRepository.savePersistedDefinition(normalized);
    return this.buildRecord(normalized);
  }

  public async updateService(serviceId: string, patch: ManagedServiceDefinitionInput): Promise<ManagedServiceRecord> {
    const current = await this.requireDefinition(serviceId);
    const builtin = this.builtinDefinitions.get(serviceId);

    if (builtin) {
      const merged = mergeBuiltinManagedServiceDefinition(builtin, createManagedServiceDefinition({
        ...builtin,
        ...patch,
        serviceId: builtin.serviceId,
        kind: builtin.kind,
        source: ManagedServiceSources.builtin,
        args: builtin.args,
        tags: builtin.tags,
        capabilities: builtin.capabilities,
        restartPolicy: builtin.restartPolicy,
        transport: builtin.transport,
      }));
      await this.definitionRepository.savePersistedDefinition(merged);
      return this.buildRecord(merged);
    }

    const updated = createManagedServiceDefinition({
      ...current,
      ...patch,
      serviceId: current.serviceId,
      kind: current.kind,
      source: ManagedServiceSources.custom,
    });
    await this.definitionRepository.savePersistedDefinition(updated);
    return this.buildRecord(updated);
  }

  public async removeService(serviceId: string): Promise<void> {
    if (this.builtinDefinitions.has(serviceId)) {
      throw new Error(`Built-in managed service '${serviceId}' cannot be removed.`);
    }

    await this.definitionRepository.deletePersistedDefinition(serviceId);
  }

  public async startService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      await this.requireServiceSupervisor().start(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async stopService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      await this.requireServiceSupervisor().stop(serviceId);
      return this.getService(serviceId);
    }

    const definition = await this.requireDefinition(serviceId);
    return this.buildCustomRecord(definition, {
      state: ManagedServiceStates.stopped,
      isAvailable: false,
      ownership: ManagedServiceOwnership.none,
      detail: `${definition.displayName} stop must be handled outside the browser runtime.`,
    });
  }

  public async restartService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      await this.requireServiceSupervisor().restart(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async ensureRunning(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      await this.requireServiceSupervisor().ensureRunning(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async listServicesFromSupervisor(
    services: ReadonlyArray<ManagedSupervisorServiceRecord>,
  ): Promise<ReadonlyArray<ManagedServiceRecord>> {
    const records = await Promise.all(services.map((service) => this.mapSupervisorServiceRecord(service)));
    return Object.freeze(records);
  }

  public async mapSupervisorServiceRecord(
    service: ManagedSupervisorServiceRecord,
  ): Promise<ManagedServiceRecord> {
    const definitions = await this.listDefinitions();
    const definition = definitions.find((candidate) => candidate.serviceId === service.serviceId);
    const fallbackSource = service.serviceId === this.getPythonRuntimeDefinition().serviceId
      ? ManagedServiceSources.builtin
      : ManagedServiceSources.custom;
    const mappedState = mapSupervisorState(service.state);

    return Object.freeze({
      id: service.serviceId,
      name: definition?.displayName ?? service.name,
      kind: definition?.kind ?? (service.serviceId === this.getPythonRuntimeDefinition().serviceId ? "python-runtime" : "custom"),
      description: definition?.description,
      source: definition?.source ?? fallbackSource,
      startPolicy: definition?.autoStartPolicy ?? "manual",
      restartPolicy: definition?.restartPolicy ?? "on-failure",
      state: mappedState,
      ownership: service.ownership,
      isAvailable: service.state === "healthy",
      transport: definition?.transport ?? "http",
      baseUrl: definition?.baseUrl ?? service.baseUrl,
      endpointSummary: definition ? summarizeEndpoints(definition) : service.baseUrl,
      workingDirectory: definition?.workingDirectory ?? service.cwd,
      command: definition?.command ?? service.command,
      args: Object.freeze([...(definition?.args ?? service.args)]),
      environmentVariables: definition?.environmentVariables ?? Object.freeze({}),
      startupTimeoutMs: definition?.startupTimeoutMs ?? 20_000,
      canEdit: true,
      canRemove: definition?.source !== ManagedServiceSources.builtin,
      canManageLifecycle: true,
      lastCheckedAt: service.lastHealthCheckAt ?? service.startedAt ?? new Date().toISOString(),
      lastErrorDetail: isServiceInErrorState(mappedState) ? service.detail : undefined,
      detail: service.detail,
      recentLogs: Object.freeze(service.recentLogs.map((entry) => this.toRuntimeEvent(service.serviceId, entry))),
    });
  }

  private async listDefinitions(): Promise<ReadonlyArray<ManagedServiceDefinition>> {
    const persistedDefinitions = await this.definitionRepository.listPersistedDefinitions();
    const definitionsById = new Map(persistedDefinitions.map((definition) => [definition.serviceId, definition]));
    const builtins = [...this.builtinDefinitions.values()].map((definition) =>
      mergeBuiltinManagedServiceDefinition(definition, definitionsById.get(definition.serviceId)),
    );
    const customs = persistedDefinitions.filter((definition) => !this.builtinDefinitions.has(definition.serviceId));
    return Object.freeze([...builtins, ...customs]);
  }

  private async requireDefinition(serviceId: string): Promise<ManagedServiceDefinition> {
    const definitions = await this.listDefinitions();
    const definition = definitions.find((candidate) => candidate.serviceId === serviceId);
    if (!definition) {
      throw new Error(`Unknown managed service '${serviceId}'.`);
    }

    return definition;
  }

  private isRegisteredManagedService(serviceId: string): boolean {
    return this.serviceManager.listServices().some((service) => service.id === serviceId);
  }

  private async refreshManagedService(serviceId: string): Promise<void> {
    if (!hasStatusRefresher(this.serviceManager)) {
      return;
    }

    await this.serviceManager.refreshServiceStatus(serviceId);
  }

  private requireServiceSupervisor(): IManagedServiceSupervisor {
    if (!this.serviceSupervisor) {
      throw new Error("Managed service lifecycle supervision is not configured.");
    }

    return this.serviceSupervisor;
  }

  private async buildRecord(definition: ManagedServiceDefinition): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(definition.serviceId)) {
      return this.buildManagedRecord(
        definition,
        this.serviceManager.getServiceStatus(definition.serviceId) ?? createUnavailableManagedServiceStatus(definition),
      );
    }

    return this.buildCustomRecord(definition);
  }

  private async refreshManagedServices(): Promise<void> {
    const manager = this.serviceManager;
    if (!hasStatusRefresher(manager)) {
      return;
    }

    await Promise.all(
      manager.listServices().map((service) => manager.refreshServiceStatus(service.id)),
    );
  }

  private getPythonRuntimeDefinition(): ManagedServiceDefinition {
    const definition = [...this.builtinDefinitions.values()].find((candidate) => candidate.kind === "python-runtime");
    if (!definition) {
      throw new Error("Built-in Python runtime definition is not configured.");
    }
    return definition;
  }

  private buildManagedRecord(
    definition: ManagedServiceDefinition,
    status: ManagedServiceStatus,
  ): ManagedServiceRecord {
    const lastErrorDetail = isServiceInErrorState(status.state)
      ? status.detail ?? "Service is not currently healthy."
      : undefined;

    return Object.freeze({
      id: definition.serviceId,
      name: definition.displayName,
      kind: definition.kind,
      description: definition.description,
      source: definition.source ?? ManagedServiceSources.builtin,
      startPolicy: definition.autoStartPolicy,
      restartPolicy: definition.restartPolicy,
      state: status.state,
      ownership: status.ownership,
      isAvailable: status.isAvailable,
      transport: definition.transport,
      baseUrl: definition.baseUrl,
      endpointSummary: summarizeEndpoints(definition),
      workingDirectory: definition.workingDirectory,
      command: definition.command,
      args: definition.args,
      environmentVariables: definition.environmentVariables,
      startupTimeoutMs: definition.startupTimeoutMs,
      canEdit: true,
      canRemove: definition.source !== ManagedServiceSources.builtin,
      canManageLifecycle: true,
      lastCheckedAt: status.lastUpdatedAt,
      lastErrorDetail,
      detail: status.detail,
      recentLogs: Object.freeze(this.getRuntimeEvents(definition.serviceId)),
    });
  }

  private async buildCustomRecord(
    definition: ManagedServiceDefinition,
    overrideStatus?: Partial<ManagedServiceStatus>,
  ): Promise<ManagedServiceRecord> {
    const healthUrl = getManagedServiceHealthUrl(definition);
    const probe = overrideStatus ?? await this.probeCustomService(definition, healthUrl);
    const state = probe.state ?? ManagedServiceStates.unavailable;
    const detail = probe.detail ?? (healthUrl
      ? `${definition.displayName} health probe did not succeed.`
      : "No health probe is configured for this service yet.");

    return Object.freeze({
      id: definition.serviceId,
      name: definition.displayName,
      kind: definition.kind,
      description: definition.description,
      source: definition.source ?? ManagedServiceSources.custom,
      startPolicy: definition.autoStartPolicy,
      restartPolicy: definition.restartPolicy,
      state,
      ownership: probe.ownership ?? (probe.isAvailable ? ManagedServiceOwnership.external : ManagedServiceOwnership.none),
      isAvailable: probe.isAvailable ?? false,
      transport: definition.transport,
      baseUrl: definition.baseUrl,
      endpointSummary: summarizeEndpoints(definition),
      workingDirectory: definition.workingDirectory,
      command: definition.command,
      args: definition.args,
      environmentVariables: definition.environmentVariables,
      startupTimeoutMs: definition.startupTimeoutMs,
      canEdit: true,
      canRemove: true,
      canManageLifecycle: false,
      lastCheckedAt: probe.lastUpdatedAt ?? new Date().toISOString(),
      lastErrorDetail: isServiceInErrorState(state) ? detail : undefined,
      detail,
      recentLogs: Object.freeze([]),
    });
  }

  private async probeCustomService(
    definition: ManagedServiceDefinition,
    healthUrl: string | undefined,
  ): Promise<Partial<ManagedServiceStatus>> {
    if (!healthUrl) {
      return {
        state: ManagedServiceStates.unavailable,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        lastUpdatedAt: new Date().toISOString(),
        detail: definition.command
          ? `Run '${[definition.command, ...definition.args].join(" ")}' from '${definition.workingDirectory ?? "."}' and then refresh health.`
          : `${definition.displayName} is configured without a health URL.`,
      };
    }

    try {
      const response = await this.fetchImplementation(healthUrl, { method: "GET" });
      if (response.ok) {
        return {
          state: ManagedServiceStates.running,
          isAvailable: true,
          ownership: ManagedServiceOwnership.external,
          lastUpdatedAt: new Date().toISOString(),
          detail: `${definition.displayName} responded successfully at ${healthUrl}.`,
        };
      }

      return {
        state: ManagedServiceStates.degraded,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        lastUpdatedAt: new Date().toISOString(),
        detail: `${definition.displayName} responded with HTTP ${response.status} at ${healthUrl}.`,
      };
    } catch {
      return {
        state: ManagedServiceStates.unavailable,
        isAvailable: false,
        ownership: ManagedServiceOwnership.none,
        lastUpdatedAt: new Date().toISOString(),
        detail: `${definition.displayName} is not reachable at ${healthUrl}.`,
      };
    }
  }

  private getRuntimeEvents(serviceId: string): ReadonlyArray<RuntimeEvent> {
    return this.runtimeEventStore
      .list()
      .filter((event) =>
        event.details?.serviceId === serviceId
        || (serviceId === this.getPythonRuntimeDefinition().serviceId && event.source === RuntimeEventSources.pythonRuntime),
      )
      .slice(-40);
  }

  private toRuntimeEvent(serviceId: string, entry: ManagedSupervisorServiceLogEntry): RuntimeEvent {
    return Object.freeze({
      id: `${serviceId}:${entry.timestamp}:${entry.level}:${entry.message}`,
      timestamp: entry.timestamp,
      source: RuntimeEventSources.pythonRuntime,
      severity: mapSupervisorLogLevelToRuntimeSeverity(entry.level),
      message: entry.message,
      details: Object.freeze({
        serviceId,
        supervisorLevel: entry.level,
      }),
    });
  }
}

function hasStatusRefresher(
  manager: IManagedServiceManager,
): manager is IManagedServiceManager & IManagedServiceStatusRefresher {
  return typeof (manager as Partial<IManagedServiceStatusRefresher>).refreshServiceStatus === "function";
}

function createUnavailableManagedServiceStatus(definition: ManagedServiceDefinition): ManagedServiceStatus {
  return {
    serviceId: definition.serviceId,
    kind: definition.kind,
    state: definition.autoStartPolicy === "disabled" ? ManagedServiceStates.disabled : ManagedServiceStates.unavailable,
    isAvailable: false,
    ownership: ManagedServiceOwnership.none,
    startPolicy: definition.autoStartPolicy,
    lastUpdatedAt: new Date().toISOString(),
    detail: definition.autoStartPolicy === "disabled"
      ? `${definition.displayName} is disabled in settings.`
      : `${definition.displayName} is not connected.`,
  };
}

function mapSupervisorState(state: ManagedSupervisorServiceRecord["state"]): ManagedServiceState {
  switch (state) {
    case "healthy":
      return ManagedServiceStates.running;
    case "unhealthy":
      return ManagedServiceStates.degraded;
    case "starting":
      return ManagedServiceStates.starting;
    case "failed":
      return ManagedServiceStates.failed;
    case "stopping":
      return ManagedServiceStates.stopping;
    case "stopped":
      return ManagedServiceStates.stopped;
    case "unavailable":
    default:
      return ManagedServiceStates.unavailable;
  }
}

function summarizeEndpoints(definition: ManagedServiceDefinition): string | undefined {
  const healthUrl = getManagedServiceHealthUrl(definition);
  if (healthUrl) {
    return healthUrl;
  }

  const baseUrl = definition.baseUrl?.trim();
  return baseUrl || undefined;
}

function isServiceInErrorState(status: ManagedServiceRecord["state"]): boolean {
  return status === "failed" || status === "degraded" || status === "unavailable";
}

function mapSupervisorLogLevelToRuntimeSeverity(
  level: ManagedSupervisorServiceLogEntry["level"],
): RuntimeEvent["severity"] {
  switch (level) {
    case "stderr":
      return "error";
    case "stdout":
      return "info";
    default:
      return level;
  }
}

import type { IPythonRuntimeManager, PythonRuntimeManagerStatus, PythonRuntimeStatus } from "../../application/ports/interfaces/IPythonRuntimeManager";
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

export interface ManagedServiceRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ManagedServiceDefinition["kind"];
  readonly description?: string;
  readonly source: ManagedServiceDefinition["source"];
  readonly startPolicy: ManagedServiceDefinition["autoStartPolicy"];
  readonly restartPolicy: ManagedServiceDefinition["restartPolicy"];
  readonly state: PythonRuntimeStatus;
  readonly ownership: PythonRuntimeManagerStatus["owner"];
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
  readonly pythonRuntimeManager: IPythonRuntimeManager;
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly builtinDefinitions: ReadonlyArray<ManagedServiceDefinition>;
  readonly definitionRepository: IManagedServiceDefinitionRepository;
  readonly fetchImplementation?: typeof fetch;
}

export class ManagedServicesService {
  private readonly pythonRuntimeManager: IPythonRuntimeManager;
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly builtinDefinitions = new Map<string, ManagedServiceDefinition>();
  private readonly definitionRepository: IManagedServiceDefinitionRepository;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ManagedServicesServiceOptions) {
    this.pythonRuntimeManager = options.pythonRuntimeManager;
    this.runtimeEventStore = options.runtimeEventStore;
    this.definitionRepository = options.definitionRepository;
    this.fetchImplementation = options.fetchImplementation ?? fetch;

    for (const definition of options.builtinDefinitions) {
      this.builtinDefinitions.set(definition.serviceId, definition);
    }
  }

  public async listServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    await this.refreshPythonRuntime();
    return this.getServices();
  }

  public async getServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    const definitions = await this.listDefinitions();
    const records = await Promise.all(definitions.map((definition) => this.buildRecord(definition)));
    return Object.freeze(records);
  }

  public async refreshService(serviceId: string): Promise<ManagedServiceRecord> {
    const definition = await this.requireDefinition(serviceId);
    if (definition.serviceId === this.getPythonRuntimeDefinition().serviceId) {
      await this.refreshPythonRuntime();
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
    if (serviceId === this.getPythonRuntimeDefinition().serviceId) {
      await this.pythonRuntimeManager.ensureRuntimeAvailability();
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async stopService(serviceId: string): Promise<ManagedServiceRecord> {
    if (serviceId === this.getPythonRuntimeDefinition().serviceId) {
      await this.pythonRuntimeManager.stopManagedRuntime();
      return this.getService(serviceId);
    }

    const definition = await this.requireDefinition(serviceId);
    return this.buildCustomRecord(definition, {
      status: "stopped",
      isAvailable: false,
      owner: "none",
      detail: `${definition.displayName} stop must be handled outside the browser runtime.`,
    });
  }

  public async restartService(serviceId: string): Promise<ManagedServiceRecord> {
    if (serviceId === this.getPythonRuntimeDefinition().serviceId) {
      await this.pythonRuntimeManager.restartRuntime();
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async ensureRunning(serviceId: string): Promise<ManagedServiceRecord> {
    if (serviceId === this.getPythonRuntimeDefinition().serviceId) {
      await this.pythonRuntimeManager.ensureRuntimeAvailability();
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

    return Object.freeze({
      id: service.serviceId,
      name: definition?.displayName ?? service.name,
      kind: definition?.kind ?? (service.serviceId === this.getPythonRuntimeDefinition().serviceId ? "python-runtime" : "custom"),
      description: definition?.description,
      source: definition?.source ?? fallbackSource,
      startPolicy: definition?.autoStartPolicy ?? "manual",
      restartPolicy: definition?.restartPolicy ?? "on-failure",
      state: service.state,
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
      lastErrorDetail: isServiceInErrorState(service.state) ? service.detail : undefined,
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

  private async buildRecord(definition: ManagedServiceDefinition): Promise<ManagedServiceRecord> {
    if (definition.serviceId === this.getPythonRuntimeDefinition().serviceId) {
      return this.buildPythonRuntimeRecord(definition, this.pythonRuntimeManager.getStatus());
    }

    return this.buildCustomRecord(definition);
  }

  private async refreshPythonRuntime(): Promise<void> {
    await this.pythonRuntimeManager.checkAvailability();
  }

  private getPythonRuntimeDefinition(): ManagedServiceDefinition {
    const definition = [...this.builtinDefinitions.values()].find((candidate) => candidate.kind === "python-runtime");
    if (!definition) {
      throw new Error("Built-in Python runtime definition is not configured.");
    }
    return definition;
  }

  private buildPythonRuntimeRecord(
    definition: ManagedServiceDefinition,
    status: PythonRuntimeManagerStatus,
  ): ManagedServiceRecord {
    const lastErrorDetail = isServiceInErrorState(status.status)
      ? status.detail ?? "Runtime is not currently healthy."
      : undefined;

    return Object.freeze({
      id: definition.serviceId,
      name: definition.displayName,
      kind: definition.kind,
      description: definition.description,
      source: definition.source ?? ManagedServiceSources.builtin,
      startPolicy: definition.autoStartPolicy,
      restartPolicy: definition.restartPolicy,
      state: status.status,
      ownership: status.owner,
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
      canRemove: false,
      canManageLifecycle: true,
      lastCheckedAt: status.lastUpdatedAt,
      lastErrorDetail,
      detail: status.detail,
      recentLogs: Object.freeze(this.getRuntimeEvents()),
    });
  }

  private async buildCustomRecord(
    definition: ManagedServiceDefinition,
    overrideStatus?: Partial<PythonRuntimeManagerStatus>,
  ): Promise<ManagedServiceRecord> {
    const healthUrl = getManagedServiceHealthUrl(definition);
    const probe = overrideStatus ?? await this.probeCustomService(definition, healthUrl);
    const state = probe.status ?? "unavailable";
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
      ownership: probe.owner ?? (probe.isAvailable ? "external" : "none"),
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
  ): Promise<Partial<PythonRuntimeManagerStatus>> {
    if (!healthUrl) {
      return {
        status: "unavailable",
        isAvailable: false,
        owner: "none",
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
          status: "healthy",
          isAvailable: true,
          owner: "external",
          lastUpdatedAt: new Date().toISOString(),
          detail: `${definition.displayName} responded successfully at ${healthUrl}.`,
        };
      }

      return {
        status: "unhealthy",
        isAvailable: false,
        owner: "none",
        lastUpdatedAt: new Date().toISOString(),
        detail: `${definition.displayName} responded with HTTP ${response.status} at ${healthUrl}.`,
      };
    } catch {
      return {
        status: "unavailable",
        isAvailable: false,
        owner: "none",
        lastUpdatedAt: new Date().toISOString(),
        detail: `${definition.displayName} is not reachable at ${healthUrl}.`,
      };
    }
  }

  private getRuntimeEvents(): ReadonlyArray<RuntimeEvent> {
    return this.runtimeEventStore
      .list()
      .filter((event) => event.source === RuntimeEventSources.pythonRuntime)
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

function summarizeEndpoints(definition: ManagedServiceDefinition): string | undefined {
  const healthUrl = getManagedServiceHealthUrl(definition);
  if (healthUrl) {
    return healthUrl;
  }

  const baseUrl = definition.baseUrl?.trim();
  return baseUrl || undefined;
}

function isServiceInErrorState(status: PythonRuntimeManagerStatus["status"]): boolean {
  return status === "failed" || status === "unhealthy" || status === "unavailable";
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

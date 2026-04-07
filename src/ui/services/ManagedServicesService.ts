import type { IRuntimeEventStore } from "@application/ports/interfaces/IRuntimeEventStore";
import { bindSafeFetch } from "@application/runtime/RuntimeDiagnostics";
import { RuntimeEventSources, type RuntimeEvent } from "@application/runtime/RuntimeEvent";
import { collapseConsecutiveRuntimeEvents } from "@application/runtime/RuntimeEventStability";
import type {
  ManagedSupervisorServiceLogEntry,
  ManagedSupervisorServiceRecord,
} from "@application/services/interfaces/IManagedServiceSupervisorClient";
import {
  createManagedServiceDefinition,
  getManagedServiceHealthUrl,
  ManagedServiceSources,
  mergeBuiltinManagedServiceDefinition,
  type ManagedServiceDefinition,
  type ManagedServiceDefinitionInput,
} from "@application/services/ManagedServiceDefinition";
import type { IManagedServiceDefinitionRepository } from "@application/services/interfaces/IManagedServiceDefinitionRepository";
import type { IManagedServiceManager } from "@application/services/interfaces/IManagedServiceManager";
import type { IManagedServiceStatusRefresher } from "@application/services/interfaces/IManagedServiceStatusRefresher";
import type { IManagedServiceSupervisor } from "@application/services/interfaces/IManagedServiceSupervisor";
import type { IManagedServiceSupervisorClient } from "@application/services/interfaces/IManagedServiceSupervisorClient";
import {
  ManagedServiceOwnership,
  ManagedServiceProvisioningActions,
  ManagedServiceProvisioningStates,
  ManagedServiceStates,
  type ManagedServiceProvisioningAction,
  type ManagedServiceProvisioningState,
  type ManagedServiceState,
  type ManagedServiceStatus,
} from "@application/services/interfaces/ManagedServiceTypes";

export interface ManagedServiceRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ManagedServiceDefinition["kind"];
  readonly description?: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<string>;
  readonly dependents: ReadonlyArray<string>;
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
  readonly pid?: number | null;
  readonly uptimeSeconds?: number;
  readonly healthSummary?: string;
  readonly healthCheckedAt?: string;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly canManageLifecycle: boolean;
  readonly lastCheckedAt: string;
  readonly lastErrorDetail?: string;
  readonly detail?: string;
  readonly provisioning: {
    readonly state: ManagedServiceProvisioningState;
    readonly required: boolean;
    readonly needsReprovision: boolean;
    readonly requestedVersion?: string;
    readonly resolvedVersion?: string;
    readonly resolvedInterpreter?: string;
    readonly environmentPath?: string;
    readonly detail: string;
    readonly availableActions: ReadonlyArray<ManagedServiceProvisioningAction>;
  };
  readonly readiness: {
    readonly isReady: boolean;
    readonly detail: string;
    readonly blockedBy: ReadonlyArray<string>;
  };
  readonly recentLogs: ReadonlyArray<RuntimeEvent>;
}

export interface ManagedServicesServiceOptions {
  readonly serviceManager: IManagedServiceManager;
  readonly serviceSupervisor?: IManagedServiceSupervisor;
  readonly supervisorClient?: IManagedServiceSupervisorClient;
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly builtinDefinitions: ReadonlyArray<ManagedServiceDefinition>;
  readonly definitionRepository: IManagedServiceDefinitionRepository;
  readonly fetchImplementation?: typeof fetch;
}

export class ManagedServicesService {
  private readonly serviceManager: IManagedServiceManager;
  private readonly serviceSupervisor?: IManagedServiceSupervisor;
  private readonly supervisorClient?: IManagedServiceSupervisorClient;
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly builtinDefinitions = new Map<string, ManagedServiceDefinition>();
  private readonly definitionRepository: IManagedServiceDefinitionRepository;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ManagedServicesServiceOptions) {
    this.serviceManager = options.serviceManager;
    this.serviceSupervisor = options.serviceSupervisor;
    this.supervisorClient = options.supervisorClient;
    this.runtimeEventStore = options.runtimeEventStore;
    this.definitionRepository = options.definitionRepository;
    this.fetchImplementation = bindSafeFetch(options.fetchImplementation ?? fetch);

    for (const definition of options.builtinDefinitions) {
      this.builtinDefinitions.set(definition.serviceId, definition);
    }
  }

  public async listServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    if (this.supervisorClient) {
      const response = await this.supervisorClient.listServices();
      return this.listServicesFromSupervisor(response.services);
    }

    await this.refreshManagedServices();
    return this.getServices();
  }

  public async getServices(): Promise<ReadonlyArray<ManagedServiceRecord>> {
    const definitions = await this.listDefinitions();
    const records = await Promise.all(definitions.map((definition) => this.buildRecord(definition)));
    return Object.freeze(records);
  }

  public async refreshService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.supervisorClient) {
      const response = await this.supervisorClient.getService(serviceId);
      return this.mapSupervisorServiceRecord(response.service);
    }

    const definition = await this.requireDefinition(serviceId);
    if (this.isRegisteredManagedService(definition.serviceId)) {
      await this.refreshManagedService(definition.serviceId);
    }
    return this.buildRecord(definition);
  }

  public async getService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.supervisorClient) {
      const response = await this.supervisorClient.getService(serviceId);
      return this.mapSupervisorServiceRecord(response.service);
    }

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
    return this.supervisorClient
      ? this.getService(normalized.serviceId)
      : this.buildRecord(normalized);
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
      return this.supervisorClient
        ? this.getService(merged.serviceId)
        : this.buildRecord(merged);
    }

    const updated = createManagedServiceDefinition({
      ...current,
      ...patch,
      serviceId: current.serviceId,
      kind: current.kind,
      source: ManagedServiceSources.custom,
    });
    await this.definitionRepository.savePersistedDefinition(updated);
    return this.supervisorClient
      ? this.getService(updated.serviceId)
      : this.buildRecord(updated);
  }

  public async removeService(serviceId: string): Promise<void> {
    if (this.builtinDefinitions.has(serviceId)) {
      throw new Error(`Built-in managed service '${serviceId}' cannot be removed.`);
    }

    await this.definitionRepository.deletePersistedDefinition(serviceId);
  }

  public async startService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      if (this.supervisorClient) {
        await this.syncBuiltinDefinition(serviceId);
        const response = await this.supervisorClient.start(serviceId);
        return this.mapSupervisorServiceRecord(response.service);
      }
      await this.requireServiceSupervisor().start(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async stopService(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      if (this.supervisorClient) {
        const response = await this.supervisorClient.stop(serviceId);
        return this.mapSupervisorServiceRecord(response.service);
      }
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
      if (this.supervisorClient) {
        await this.syncBuiltinDefinition(serviceId);
        const response = await this.supervisorClient.restart(serviceId);
        return this.mapSupervisorServiceRecord(response.service);
      }
      await this.requireServiceSupervisor().restart(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async ensureRunning(serviceId: string): Promise<ManagedServiceRecord> {
    if (this.isRegisteredManagedService(serviceId)) {
      if (this.supervisorClient) {
        await this.syncBuiltinDefinition(serviceId);
        const response = await this.supervisorClient.ensureRunning(serviceId);
        return this.mapSupervisorServiceRecord(response.service);
      }
      await this.requireServiceSupervisor().ensureRunning(serviceId);
      return this.getService(serviceId);
    }

    return this.refreshService(serviceId);
  }

  public async provisionService(serviceId: string): Promise<ManagedServiceRecord> {
    if (!this.supervisorClient) {
      throw new Error("Managed service provisioning requires a supervisor-backed runtime.");
    }
    await this.syncBuiltinDefinition(serviceId);
    const response = await this.supervisorClient.provision(serviceId);
    return this.mapSupervisorServiceRecord(response.service);
  }

  public async repairService(serviceId: string): Promise<ManagedServiceRecord> {
    if (!this.supervisorClient) {
      throw new Error("Managed service repair requires a supervisor-backed runtime.");
    }
    await this.syncBuiltinDefinition(serviceId);
    const response = await this.supervisorClient.repair(serviceId);
    return this.mapSupervisorServiceRecord(response.service);
  }

  public async recreateEnvironment(serviceId: string): Promise<ManagedServiceRecord> {
    if (!this.supervisorClient) {
      throw new Error("Managed service environment recreation requires a supervisor-backed runtime.");
    }
    await this.syncBuiltinDefinition(serviceId);
    const response = await this.supervisorClient.recreateEnvironment(serviceId);
    return this.mapSupervisorServiceRecord(response.service);
  }

  public async startCapability(capabilityId: string): Promise<ReadonlyArray<ManagedServiceRecord>> {
    const normalizedCapabilityId = capabilityId.trim();
    if (!normalizedCapabilityId) {
      return Object.freeze([]);
    }

    const definitions = await this.listDefinitions();
    const roots = definitions.filter((definition) => definition.capabilities.includes(normalizedCapabilityId));
    if (roots.length === 0) {
      throw new Error(`Unknown managed service capability '${normalizedCapabilityId}'.`);
    }

    const orderedDefinitions = this.orderDefinitionsByDependencies(
      this.collectDefinitionsForRoots(roots.map((definition) => definition.serviceId), definitions),
    );
    const results: ManagedServiceRecord[] = [];

    for (const definition of orderedDefinitions) {
      if (this.isRegisteredManagedService(definition.serviceId)) {
        if (this.supervisorClient) {
          await this.supervisorClient.ensureRunning(definition.serviceId);
        } else {
          await this.requireServiceSupervisor().ensureRunning(definition.serviceId);
        }
      } else {
        await this.refreshService(definition.serviceId);
      }

      results.push(await this.getService(definition.serviceId));
    }

    return Object.freeze(results);
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
    const retryPresentation = deriveRetryPresentation(service, mappedState);
    const effectiveState = retryPresentation?.state ?? mappedState;
    const effectiveDetail = retryPresentation?.detail ?? service.detail;
    const effectiveIsAvailable = retryPresentation?.isAvailable ?? (service.state === "healthy");
    const provisioning = mapProvisioning(service);

    return Object.freeze({
      id: service.serviceId,
      name: definition?.displayName ?? service.name,
      kind: definition?.kind ?? (service.serviceId === this.getPythonRuntimeDefinition().serviceId ? "python-runtime" : "custom"),
      description: definition?.description,
      capabilities: Object.freeze([...(definition?.capabilities ?? [])]),
      dependencies: Object.freeze([...(definition?.dependencies ?? service.dependencies ?? [])]),
      dependents: Object.freeze([...(service.dependents ?? this.findDependents(service.serviceId, definitions))]),
      source: definition?.source ?? fallbackSource,
      startPolicy: definition?.autoStartPolicy ?? "manual",
      restartPolicy: definition?.restartPolicy ?? "on-failure",
      state: effectiveState,
      ownership: service.ownership,
      isAvailable: effectiveIsAvailable,
      transport: definition?.transport ?? "http",
      baseUrl: definition?.baseUrl ?? service.baseUrl,
      endpointSummary: definition ? summarizeEndpoints(definition) : service.baseUrl,
      workingDirectory: definition?.workingDirectory ?? service.cwd,
      command: definition?.command ?? service.command,
      args: Object.freeze([...(definition?.args ?? service.args)]),
      environmentVariables: definition?.environmentVariables ?? Object.freeze({}),
      startupTimeoutMs: definition?.startupTimeoutMs ?? 20_000,
      pid: service.pid,
      uptimeSeconds: service.startedAt ? Math.max(0, Math.round((Date.now() - new Date(service.startedAt).getTime()) / 1000)) : undefined,
      healthSummary: retryPresentation?.detail ?? service.readiness?.detail ?? effectiveDetail,
      healthCheckedAt: service.lastHealthCheckAt ?? undefined,
      canEdit: true,
      canRemove: definition?.source !== ManagedServiceSources.builtin,
      canManageLifecycle: true,
      lastCheckedAt: service.lastHealthCheckAt ?? service.startedAt ?? new Date().toISOString(),
      lastErrorDetail: retryPresentation ? undefined : isServiceInErrorState(mappedState) ? service.detail : undefined,
      detail: effectiveDetail,
      provisioning,
      readiness: Object.freeze({
        isReady: retryPresentation ? false : service.readiness?.isReady ?? service.state === "healthy",
        detail: retryPresentation?.detail ?? service.readiness?.detail ?? effectiveDetail ?? `${service.name} readiness is unknown.`,
        blockedBy: Object.freeze([...(service.readiness?.blockedBy ?? [])]),
      }),
      recentLogs: collapseConsecutiveRuntimeEvents(
        service.recentLogs.map((entry) => this.toRuntimeEvent(service.serviceId, entry)),
      ),
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

  private async syncBuiltinDefinition(serviceId: string): Promise<void> {
    if (!this.supervisorClient || !this.builtinDefinitions.has(serviceId)) {
      return;
    }

    const definition = await this.requireDefinition(serviceId);
    await this.supervisorClient.saveDefinition(definition);
  }

  private isRegisteredManagedService(serviceId: string): boolean {
    if (this.supervisorClient) {
      return true;
    }

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
    const definitions = await this.listDefinitions();
    if (this.isRegisteredManagedService(definition.serviceId)) {
      return this.enrichRecord(
        definition,
        this.buildManagedRecord(
          definition,
          this.serviceManager.getServiceStatus(definition.serviceId) ?? createUnavailableManagedServiceStatus(definition),
        ),
        definitions,
      );
    }

    return this.enrichRecord(definition, await this.buildCustomRecord(definition), definitions);
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
      capabilities: definition.capabilities,
      dependencies: definition.dependencies,
      dependents: Object.freeze([]),
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
      pid: undefined,
      uptimeSeconds: undefined,
      healthSummary: status.detail,
      healthCheckedAt: status.lastUpdatedAt,
      canEdit: true,
      canRemove: definition.source !== ManagedServiceSources.builtin,
      canManageLifecycle: true,
      lastCheckedAt: status.lastUpdatedAt,
      lastErrorDetail,
      detail: status.detail,
      provisioning: Object.freeze({
        state: ManagedServiceProvisioningStates.unsupported,
        required: false,
        needsReprovision: false,
        detail: "Provisioning is not managed for this service in the current runtime mode.",
        availableActions: Object.freeze([]),
      }),
      readiness: this.buildReadiness(definition, status.state, status.detail),
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
      capabilities: definition.capabilities,
      dependencies: definition.dependencies,
      dependents: Object.freeze([]),
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
      pid: undefined,
      uptimeSeconds: undefined,
      healthSummary: detail,
      healthCheckedAt: probe.lastUpdatedAt ?? new Date().toISOString(),
      canEdit: true,
      canRemove: true,
      canManageLifecycle: false,
      lastCheckedAt: probe.lastUpdatedAt ?? new Date().toISOString(),
      lastErrorDetail: isServiceInErrorState(state) ? detail : undefined,
      detail,
      provisioning: Object.freeze({
        state: ManagedServiceProvisioningStates.unsupported,
        required: false,
        needsReprovision: false,
        detail: "Provisioning is not managed for browser-only services.",
        availableActions: Object.freeze([]),
      }),
      readiness: this.buildReadiness(definition, state, detail),
      recentLogs: Object.freeze([]),
    });
  }

  private buildReadiness(
    definition: ManagedServiceDefinition,
    state: ManagedServiceState,
    detail?: string,
  ): ManagedServiceRecord["readiness"] {
    const blockedBy = definition.dependencies.filter((dependencyId) => {
      const dependencyState = this.peekServiceState(dependencyId);
      return dependencyState !== ManagedServiceStates.running;
    });

    return Object.freeze({
      isReady: state === ManagedServiceStates.running && blockedBy.length === 0,
      detail: blockedBy.length > 0
        ? `${definition.displayName} is waiting on ${blockedBy.join(", ")}.`
        : definition.dependencies.length > 0
          ? `${definition.displayName} dependencies are satisfied.`
        : detail ?? `${definition.displayName} readiness matches its lifecycle state.`,
      blockedBy: Object.freeze(blockedBy),
    });
  }

  private enrichRecord(
    definition: ManagedServiceDefinition,
    record: ManagedServiceRecord,
    definitions: ReadonlyArray<ManagedServiceDefinition>,
  ): ManagedServiceRecord {
    const dependencies = Object.freeze([...definition.dependencies]);
    const dependents = this.findDependents(definition.serviceId, definitions);
    const readiness = this.buildReadiness(definition, record.state, record.detail);

    return Object.freeze({
      ...record,
      dependencies,
      dependents,
      readiness,
    });
  }

  private collectDefinitionsForRoots(
    rootServiceIds: ReadonlyArray<string>,
    definitions: ReadonlyArray<ManagedServiceDefinition>,
  ): ReadonlyArray<ManagedServiceDefinition> {
    const byId = new Map(definitions.map((definition) => [definition.serviceId, definition]));
    const collected = new Map<string, ManagedServiceDefinition>();
    const visit = (serviceId: string) => {
      const definition = byId.get(serviceId);
      if (!definition || collected.has(serviceId)) {
        return;
      }

      collected.set(serviceId, definition);
      for (const dependencyId of definition.dependencies) {
        visit(dependencyId);
      }
    };

    for (const serviceId of rootServiceIds) {
      visit(serviceId);
    }

    return Object.freeze([...collected.values()]);
  }

  private orderDefinitionsByDependencies(
    definitions: ReadonlyArray<ManagedServiceDefinition>,
  ): ReadonlyArray<ManagedServiceDefinition> {
    const byId = new Map(definitions.map((definition) => [definition.serviceId, definition]));
    const ordered: ManagedServiceDefinition[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (definition: ManagedServiceDefinition) => {
      if (visited.has(definition.serviceId)) {
        return;
      }

      if (visiting.has(definition.serviceId)) {
        throw new Error(`Managed service dependency cycle detected at '${definition.serviceId}'.`);
      }

      visiting.add(definition.serviceId);
      for (const dependencyId of definition.dependencies) {
        const dependency = byId.get(dependencyId);
        if (dependency) {
          visit(dependency);
        }
      }
      visiting.delete(definition.serviceId);
      visited.add(definition.serviceId);
      ordered.push(definition);
    };

    for (const definition of definitions) {
      visit(definition);
    }

    return Object.freeze(ordered);
  }

  private findDependents(
    serviceId: string,
    definitions: ReadonlyArray<ManagedServiceDefinition>,
  ): ReadonlyArray<string> {
    return Object.freeze(
      definitions
        .filter((definition) => definition.dependencies.includes(serviceId))
        .map((definition) => definition.serviceId),
    );
  }

  private peekServiceState(serviceId: string): ManagedServiceState | undefined {
    if (this.isRegisteredManagedService(serviceId)) {
      return this.serviceManager.getServiceStatus(serviceId)?.state;
    }

    return undefined;
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

function deriveRetryPresentation(
  service: ManagedSupervisorServiceRecord,
  mappedState: ManagedServiceState,
): { state: ManagedServiceState; detail: string; isAvailable: boolean } | undefined {
  if (service.serviceId !== "python-runtime") {
    return undefined;
  }

  const circuit = service.diagnostics?.circuitBreaker;
  if (!circuit || circuit.state === "open" || circuit.recentFailures <= 0 || service.state === "healthy") {
    return undefined;
  }

  if (
    mappedState !== ManagedServiceStates.failed
    && mappedState !== ManagedServiceStates.degraded
    && mappedState !== ManagedServiceStates.unavailable
    && mappedState !== ManagedServiceStates.starting
  ) {
    return undefined;
  }

  const attemptNumber = Math.min(circuit.recentFailures + 1, circuit.maxFailures);
  return {
    state: ManagedServiceStates.starting,
    detail: `Trying to restart ${service.name} (${attemptNumber} of ${circuit.maxFailures}).`,
    isAvailable: false,
  };
}

function mapProvisioning(
  service: ManagedSupervisorServiceRecord,
): ManagedServiceRecord["provisioning"] {
  const provisioning = service.diagnostics?.provisioning;
  if (!provisioning?.required) {
    return Object.freeze({
      state: ManagedServiceProvisioningStates.unsupported,
      required: false,
      needsReprovision: false,
      detail: "Provisioning is not required for this managed service.",
      availableActions: Object.freeze([]),
    });
  }

  const actions: ManagedServiceProvisioningAction[] = [];
  if (provisioning.state === "unprovisioned") {
    actions.push(ManagedServiceProvisioningActions.provision);
  } else if (
    provisioning.state === "provision-failed"
    || provisioning.state === "provisioned-unlaunchable"
    || provisioning.state === "corrupted"
  ) {
    actions.push(
      ManagedServiceProvisioningActions.repair,
      ManagedServiceProvisioningActions.recreateEnvironment,
    );
  } else {
    actions.push(
      ManagedServiceProvisioningActions.repair,
      ManagedServiceProvisioningActions.recreateEnvironment,
    );
  }

  return Object.freeze({
    state: provisioning.state,
    required: provisioning.required,
    needsReprovision: provisioning.needsReprovision,
    requestedVersion: provisioning.requestedVersion ?? undefined,
    resolvedVersion: provisioning.resolvedVersion ?? undefined,
    resolvedInterpreter: provisioning.resolvedInterpreter ?? undefined,
    environmentPath: provisioning.environmentPath ?? undefined,
    detail: provisioning.lastError?.message
      ?? service.detail
      ?? (provisioning.needsReprovision
        ? "Configured runtime version changed; repair or recreate the environment before starting."
        : `Provisioning state: ${provisioning.state}.`),
    availableActions: Object.freeze(actions),
  });
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


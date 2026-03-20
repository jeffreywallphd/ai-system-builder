import type { McpServerStatus } from "../../application/mcp/models/McpServerStatus";
import type { McpConnectionStatus } from "../../application/mcp/models/McpConnectionStatus";
import type { McpService } from "../services/McpService";
import {
  PythonRuntimeStatuses,
  type IPythonRuntimeManager,
  type PythonRuntimeManagerStatus,
} from "../../application/ports/interfaces/IPythonRuntimeManager";
import type { IRuntimeEventStore } from "../../application/ports/interfaces/IRuntimeEventStore";
import type { RuntimeEvent } from "../../application/runtime/RuntimeEvent";

export interface RuntimeHealthCheck {
  readonly id: string;
  readonly label: string;
  readonly kind: "python-runtime" | "mcp-server" | "mcp-runtime";
  readonly status: "healthy" | "degraded" | "offline" | "disabled" | "unknown";
  readonly detail: string;
  readonly checkedAt: string;
}

export interface RuntimeConsoleState {
  readonly isExpanded: boolean;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshingHealth: boolean;
}

export type RuntimeConsoleListener = (state: RuntimeConsoleState) => void;

export interface RuntimeConsoleStoreOptions {
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly pythonRuntimeManager: IPythonRuntimeManager;
  readonly mcpService?: Pick<McpService, "getConnectionStatus" | "listConfiguredServers" | "getServerStatus">;
}

export class RuntimeConsoleStore {
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly pythonRuntimeManager: IPythonRuntimeManager;
  private readonly mcpService?: Pick<McpService, "getConnectionStatus" | "listConfiguredServers" | "getServerStatus">;
  private readonly listeners = new Set<RuntimeConsoleListener>();
  private readonly unsubscribeEventStore: () => void;
  private state: RuntimeConsoleState = Object.freeze({
    isExpanded: false,
    events: Object.freeze([]),
    healthChecks: Object.freeze([]),
    isRefreshingHealth: false,
  });
  private initializePromise?: Promise<void>;
  private refreshHealthPromise?: Promise<void>;

  constructor(options: RuntimeConsoleStoreOptions) {
    this.runtimeEventStore = options.runtimeEventStore;
    this.pythonRuntimeManager = options.pythonRuntimeManager;
    this.mcpService = options.mcpService;
    this.unsubscribeEventStore = this.runtimeEventStore.subscribe((events) => {
      this.state = Object.freeze({ ...this.state, events: Object.freeze([...events]) });
      this.notify();
    });
  }

  public getState(): RuntimeConsoleState {
    return this.state;
  }

  public subscribe(listener: RuntimeConsoleListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public toggleExpanded(): void {
    this.state = Object.freeze({ ...this.state, isExpanded: !this.state.isExpanded });
    this.notify();

    if (this.state.isExpanded) {
      void this.refreshHealth();
    }
  }

  public clearEvents(): void {
    this.runtimeEventStore.clear();
  }

  public initializeRuntime(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.pythonRuntimeManager
        .ensureRuntimeAvailability()
        .then(() => this.refreshHealth())
        .catch(() => this.refreshHealth())
        .then(() => undefined);
    }

    return this.initializePromise;
  }

  public refreshHealth(): Promise<void> {
    if (!this.refreshHealthPromise) {
      this.patch({ isRefreshingHealth: true });
      this.refreshHealthPromise = this.collectHealthChecks()
        .then((healthChecks) => {
          this.patch({
            healthChecks: Object.freeze(healthChecks),
            isRefreshingHealth: false,
          });
        })
        .catch((error) => {
          const checkedAt = new Date().toISOString();
          this.patch({
            healthChecks: Object.freeze([
              ...this.buildPythonRuntimeHealthChecks(this.pythonRuntimeManager.getStatus()),
              {
                id: "mcp-runtime",
                label: "MCP runtime",
                kind: "mcp-runtime",
                status: "offline",
                detail: toErrorMessage(error) || "Unable to inspect MCP server health.",
                checkedAt,
              },
            ]),
            isRefreshingHealth: false,
          });
        })
        .finally(() => {
          this.refreshHealthPromise = undefined;
        });
    }

    return this.refreshHealthPromise;
  }

  public dispose(): void {
    this.unsubscribeEventStore();
    this.listeners.clear();
  }

  private async collectHealthChecks(): Promise<ReadonlyArray<RuntimeHealthCheck>> {
    const checks = [...this.buildPythonRuntimeHealthChecks(this.pythonRuntimeManager.getStatus())];

    if (!this.mcpService) {
      return Object.freeze(checks);
    }

    try {
      const [runtimeStatus, configuredServers] = await Promise.all([
        this.mcpService.getConnectionStatus(),
        this.mcpService.listConfiguredServers().catch(() => Object.freeze([])),
      ]);

      checks.push(this.mapMcpRuntimeHealthCheck(runtimeStatus));

      if (configuredServers.length === 0 && runtimeStatus.servers.length === 0) {
        return Object.freeze(checks);
      }

      const statuses = await this.collectServerStatuses(configuredServers, runtimeStatus);

      return Object.freeze([
        ...checks,
        ...statuses.map((status) => this.mapMcpServerHealthCheck(status)),
      ]);
    } catch (error) {
      checks.push({
        id: "mcp-runtime",
        label: "MCP runtime",
        kind: "mcp-runtime",
        status: "offline",
        detail: toErrorMessage(error) || "Unable to inspect MCP server health.",
        checkedAt: new Date().toISOString(),
      });
      return Object.freeze(checks);
    }
  }

  private buildPythonRuntimeHealthChecks(status: PythonRuntimeManagerStatus): ReadonlyArray<RuntimeHealthCheck> {
    return Object.freeze([
      {
        id: "python-runtime",
        label: "Python runtime",
        kind: "python-runtime",
        status: mapPythonRuntimeHealthStatus(status),
        detail: status.detail ?? describePythonRuntimeStatus(status),
        checkedAt: status.lastUpdatedAt,
      },
    ]);
  }

  private createFallbackMcpServerStatus(
    server: Awaited<ReturnType<NonNullable<RuntimeConsoleStoreOptions["mcpService"]>["listConfiguredServers"]>>[number],
    error: unknown,
  ): McpServerStatus {
    return {
      serverId: server.id,
      name: server.name,
      transport: server.transport,
      configured: true,
      enabled: server.enabled ?? true,
      state: server.status === "connected" ? "connected" : server.status === "connecting" ? "connecting" : "error",
      connected: server.connected ?? false,
      checkedAt: server.checkedAt ?? new Date().toISOString(),
      connectedAt: server.connectedAt,
      disconnectedAt: server.disconnectedAt,
      toolCount: server.toolCount,
      resourceCount: server.resourceCount,
      capabilities: server.capabilities,
      metadata: server.metadata,
      errorMessage: toErrorMessage(error),
    };
  }

  private mapMcpServerHealthCheck(status: McpServerStatus): RuntimeHealthCheck {
    return {
      id: `mcp-server:${status.serverId}`,
      label: status.name,
      kind: "mcp-server",
      status: mapMcpServerHealthStatus(status),
      detail: status.errorMessage ?? `${status.transport} server is ${status.state}.`,
      checkedAt: status.checkedAt,
    };
  }

  private mapMcpRuntimeHealthCheck(status: McpConnectionStatus): RuntimeHealthCheck {
    return {
      id: "mcp-runtime",
      label: "MCP runtime",
      kind: "mcp-runtime",
      status: mapMcpRuntimeHealthStatus(status),
      detail: describeMcpRuntimeStatus(status),
      checkedAt: status.checkedAt,
    };
  }

  private async collectServerStatuses(
    configuredServers: ReadonlyArray<
      Awaited<ReturnType<NonNullable<RuntimeConsoleStoreOptions["mcpService"]>["listConfiguredServers"]>>[number]
    >,
    runtimeStatus: McpConnectionStatus,
  ): Promise<ReadonlyArray<McpServerStatus>> {
    const byId = new Map(runtimeStatus.servers.map((status) => [status.serverId, status]));
    const allServerIds = new Set<string>([
      ...configuredServers.map((server) => server.id),
      ...runtimeStatus.servers.map((server) => server.serverId),
    ]);

    const statuses = await Promise.all(
      [...allServerIds].map(async (serverId) => {
        const existing = byId.get(serverId);
        if (existing) {
          return existing;
        }

        const configuredServer = configuredServers.find((server) => server.id === serverId);
        if (!configuredServer) {
          return undefined;
        }

        try {
          return await this.mcpService!.getServerStatus(serverId);
        } catch (error) {
          return this.createFallbackMcpServerStatus(configuredServer, error);
        }
      }),
    );

    return Object.freeze(statuses.filter((status): status is McpServerStatus => !!status));
  }

  private patch(patch: Partial<RuntimeConsoleState>): void {
    this.state = Object.freeze({ ...this.state, ...patch });
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function mapPythonRuntimeHealthStatus(status: PythonRuntimeManagerStatus): RuntimeHealthCheck["status"] {
  switch (status.status) {
    case PythonRuntimeStatuses.healthy:
      return "healthy";
    case PythonRuntimeStatuses.unhealthy:
    case PythonRuntimeStatuses.starting:
    case PythonRuntimeStatuses.stopping:
      return "degraded";
    case PythonRuntimeStatuses.unavailable:
    case PythonRuntimeStatuses.failed:
    case PythonRuntimeStatuses.stopped:
      return "offline";
    default:
      return "unknown";
  }
}

function mapMcpServerHealthStatus(status: McpServerStatus): RuntimeHealthCheck["status"] {
  switch (status.state) {
    case "connected":
      return status.enabled ? "healthy" : "disabled";
    case "connecting":
      return "degraded";
    case "disconnected":
      return status.enabled ? "offline" : "disabled";
    case "error":
      return "offline";
    default:
      return "unknown";
  }
}

function mapMcpRuntimeHealthStatus(status: McpConnectionStatus): RuntimeHealthCheck["status"] {
  if (!status.enabled) {
    return "disabled";
  }

  switch (status.state) {
    case "ready":
      return "healthy";
    case "degraded":
      return "degraded";
    case "unavailable":
      return "offline";
    default:
      return "unknown";
  }
}

function describeMcpRuntimeStatus(status: McpConnectionStatus): string {
  if (!status.enabled) {
    return "MCP runtime is disabled.";
  }

  if (status.state === "ready") {
    return `MCP runtime is ready with ${status.servers.length} configured server${status.servers.length === 1 ? "" : "s"}.`;
  }

  if (status.state === "degraded") {
    return "MCP runtime is reachable, but one or more MCP servers reported errors.";
  }

  if (status.state === "unavailable") {
    return "MCP runtime is enabled but no MCP servers are currently available.";
  }

  return "MCP runtime status is unknown.";
}

function describePythonRuntimeStatus(status: PythonRuntimeManagerStatus): string {
  switch (status.status) {
    case PythonRuntimeStatuses.healthy:
      return "Runtime health checks are passing.";
    case PythonRuntimeStatuses.unhealthy:
      return "Runtime endpoint responded but is not healthy.";
    case PythonRuntimeStatuses.starting:
      return "Runtime startup is in progress.";
    case PythonRuntimeStatuses.stopping:
      return "Runtime shutdown is in progress.";
    case PythonRuntimeStatuses.failed:
      return "Runtime failed to start.";
    case PythonRuntimeStatuses.stopped:
      return "Managed runtime is stopped.";
    case PythonRuntimeStatuses.unavailable:
    default:
      return "Runtime endpoint is unavailable.";
  }
}

function toErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

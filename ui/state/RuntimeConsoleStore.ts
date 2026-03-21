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

const DEFAULT_LOG_CAPACITY = 250;

export type RuntimeAppState = "starting" | "reconnecting" | "ready" | "degraded" | "failed";
export type RuntimeConsoleTab = "health" | "logs";
export type RuntimeConsoleLogSeverity = "info" | "warn" | "error";
export type RuntimeConsoleLogSource =
  | "python-runtime-manager"
  | "runtime-console"
  | "mcp-runtime"
  | "ui"
  | "network"
  | "app"
  | "workflow-execution"
  | "comfyui"
  | "models"
  | "python-runtime";

export interface RuntimeHealthCheck {
  readonly id: string;
  readonly label: string;
  readonly kind: "python-runtime" | "mcp-server" | "mcp-runtime";
  readonly status: "healthy" | "degraded" | "offline" | "disabled" | "unknown";
  readonly detail: string;
  readonly checkedAt: string;
}

export interface RuntimeConsoleLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly severity: RuntimeConsoleLogSeverity;
  readonly source: RuntimeConsoleLogSource;
  readonly message: string;
  readonly details?: string;
  readonly stack?: string;
}

export interface RuntimeConsoleState {
  readonly isExpanded: boolean;
  readonly activeTab: RuntimeConsoleTab;
  readonly events: ReadonlyArray<RuntimeEvent>;
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshingHealth: boolean;
  readonly appState: RuntimeAppState;
  readonly appStateDetail: string;
  readonly canRestartRuntime: boolean;
  readonly isRestartingRuntime: boolean;
}

export type RuntimeConsoleListener = (state: RuntimeConsoleState) => void;

export interface RuntimeConsoleStoreOptions {
  readonly runtimeEventStore: IRuntimeEventStore;
  readonly pythonRuntimeManager: IPythonRuntimeManager;
  readonly mcpService?: Pick<McpService, "getConnectionStatus" | "listConfiguredServers" | "getServerStatus">;
  readonly runtimeManagement?: {
    readonly isManagedLocal: boolean;
    readonly autoStartEnabled: boolean;
    readonly healthPollIntervalMs: number;
  };
  readonly logCapacity?: number;
}

export class RuntimeConsoleStore {
  private readonly runtimeEventStore: IRuntimeEventStore;
  private readonly pythonRuntimeManager: IPythonRuntimeManager;
  private readonly mcpService?: Pick<McpService, "getConnectionStatus" | "listConfiguredServers" | "getServerStatus">;
  private readonly runtimeManagement;
  private readonly listeners = new Set<RuntimeConsoleListener>();
  private readonly unsubscribeEventStore: () => void;
  private readonly logCapacity: number;
  private diagnosticLogs: ReadonlyArray<RuntimeConsoleLogEntry> = Object.freeze([]);
  private removeGlobalErrorListeners?: () => void;
  private state: RuntimeConsoleState = Object.freeze({
    isExpanded: false,
    activeTab: "health",
    events: Object.freeze([]),
    logs: Object.freeze([]),
    healthChecks: Object.freeze([]),
    isRefreshingHealth: false,
    appState: "starting",
    appStateDetail: "Checking managed runtime status…",
    canRestartRuntime: false,
    isRestartingRuntime: false,
  });
  private initializePromise?: Promise<void>;
  private refreshHealthPromise?: Promise<void>;
  private monitorTimer?: ReturnType<typeof setTimeout>;
  private isDisposed = false;

  constructor(options: RuntimeConsoleStoreOptions) {
    this.runtimeEventStore = options.runtimeEventStore;
    this.pythonRuntimeManager = options.pythonRuntimeManager;
    this.mcpService = options.mcpService;
    this.runtimeManagement = options.runtimeManagement;
    this.logCapacity = options.logCapacity && options.logCapacity > 0 ? options.logCapacity : DEFAULT_LOG_CAPACITY;
    this.unsubscribeEventStore = this.runtimeEventStore.subscribe((events) => {
      this.state = Object.freeze({
        ...this.state,
        events: Object.freeze([...events]),
        logs: this.buildCombinedLogs(events),
      });
      this.notify();
    });
    this.removeGlobalErrorListeners = this.attachGlobalErrorListeners();
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

  public setActiveTab(tab: RuntimeConsoleTab): void {
    if (this.state.activeTab === tab) {
      return;
    }

    this.patch({ activeTab: tab });
  }

  public clearEvents(): void {
    this.clearLogs();
  }

  public clearLogs(): void {
    this.diagnosticLogs = Object.freeze([]);
    this.runtimeEventStore.clear();
    this.patch({ logs: Object.freeze([]) });
  }

  public initializeRuntime(): Promise<void> {
    if (!this.initializePromise) {
      this.patch({
        appState: "starting",
        appStateDetail: this.describeStartupIntent(),
      });
      this.initializePromise = this.bootstrapRuntime()
        .then(() => this.refreshHealth())
        .catch(() => this.refreshHealth())
        .then(() => {
          this.startMonitoring();
        });
    }

    return this.initializePromise;
  }

  public async restartRuntime(): Promise<void> {
    this.patch({
      isRestartingRuntime: true,
      appState: this.state.appState === "starting" ? "starting" : "reconnecting",
      appStateDetail: "Restarting the Python runtime…",
    });

    try {
      const status = await this.pythonRuntimeManager.restartRuntime();
      this.applyAppState(status, "manual-restart");
    } catch (error) {
      const checkedAt = new Date().toISOString();
      const message = toErrorMessage(error) ?? "Runtime restart failed.";
      this.appendLog({
        severity: "error",
        source: "python-runtime-manager",
        message: "Python runtime restart failed.",
        details: message,
        stack: toErrorStack(error),
      });
      this.patch({
        appState: "failed",
        appStateDetail: message,
        healthChecks: Object.freeze([
          ...this.buildPythonRuntimeHealthChecks(this.pythonRuntimeManager.getStatus()),
          {
            id: "mcp-runtime",
            label: "MCP runtime",
            kind: "mcp-runtime",
            status: "offline",
            detail: "MCP runtime is unavailable while Python runtime restart is failing.",
            checkedAt,
          },
        ]),
      });
    } finally {
      this.patch({ isRestartingRuntime: false });
      await this.refreshHealth().catch(() => undefined);
    }
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
          const message = toErrorMessage(error) || "Unable to inspect MCP server health.";
          this.appendLog({
            severity: "error",
            source: detectLogSource(message, error, "runtime-console"),
            message: "Runtime health refresh failed.",
            details: message,
            stack: toErrorStack(error),
          });
          this.patch({
            healthChecks: Object.freeze([
              ...this.buildPythonRuntimeHealthChecks(this.pythonRuntimeManager.getStatus()),
              {
                id: "mcp-runtime",
                label: "MCP runtime",
                kind: "mcp-runtime",
                status: "offline",
                detail: message,
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
    this.isDisposed = true;
    if (this.monitorTimer) {
      clearTimeout(this.monitorTimer);
      this.monitorTimer = undefined;
    }
    this.removeGlobalErrorListeners?.();
    this.unsubscribeEventStore();
    this.listeners.clear();
  }

  private async bootstrapRuntime(): Promise<void> {
    try {
      const status = await this.pythonRuntimeManager.ensureRuntimeAvailability();
      this.applyAppState(status, "startup");
    } catch (error) {
      const fallbackStatus = this.pythonRuntimeManager.getStatus();
      const message = toErrorMessage(error);
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, error, "python-runtime-manager"),
        message: "Python runtime initialization failed.",
        details: message,
        stack: toErrorStack(error),
      });
      this.applyAppState(fallbackStatus, "startup-failed", message);
    }
  }

  private startMonitoring(): void {
    if (this.monitorTimer || this.isDisposed) {
      return;
    }

    const intervalMs = Math.max(this.runtimeManagement?.healthPollIntervalMs ?? 2_000, 1_000);
    const tick = async (): Promise<void> => {
      if (this.isDisposed) {
        return;
      }

      try {
        await this.syncRuntimeState("monitor");
        if (this.state.isExpanded) {
          await this.refreshHealth();
        }
      } finally {
        if (!this.isDisposed) {
          this.monitorTimer = setTimeout(() => {
            void tick();
          }, intervalMs);
        }
      }
    };

    this.monitorTimer = setTimeout(() => {
      void tick();
    }, intervalMs);
  }

  private async syncRuntimeState(trigger: "startup" | "startup-failed" | "monitor" | "manual-restart" | "refresh"): Promise<PythonRuntimeManagerStatus> {
    await this.pythonRuntimeManager.checkAvailability().catch(() => false);
    let status = this.pythonRuntimeManager.getStatus();

    if ((trigger === "monitor" || trigger === "refresh") && this.shouldAttemptRecovery(status)) {
      this.patch({
        appState: "reconnecting",
        appStateDetail: status.detail ?? "Python runtime connection was lost. Attempting recovery…",
      });

      try {
        status = await this.pythonRuntimeManager.ensureRuntimeAvailability();
      } catch (error) {
        const message = toErrorMessage(error);
        this.appendLog({
          severity: "error",
          source: detectLogSource(message, error, "python-runtime-manager"),
          message: "Managed runtime recovery failed.",
          details: message,
          stack: toErrorStack(error),
        });
        this.applyAppState(this.pythonRuntimeManager.getStatus(), "startup-failed", message);
        return this.pythonRuntimeManager.getStatus();
      }
    }

    this.applyAppState(status, trigger);
    return status;
  }

  private shouldAttemptRecovery(status: PythonRuntimeManagerStatus): boolean {
    if (!this.runtimeManagement?.isManagedLocal || !this.runtimeManagement.autoStartEnabled) {
      return false;
    }

    if (this.state.appState !== "ready" && this.state.appState !== "degraded") {
      return false;
    }

    return status.status === PythonRuntimeStatuses.failed || status.status === PythonRuntimeStatuses.unavailable;
  }

  private applyAppState(
    status: PythonRuntimeManagerStatus,
    trigger: "startup" | "startup-failed" | "monitor" | "manual-restart" | "refresh",
    overrideDetail?: string,
  ): void {
    const nextAppState = deriveAppState(status, {
      trigger,
      isManagedLocal: this.runtimeManagement?.isManagedLocal ?? false,
      autoStartEnabled: this.runtimeManagement?.autoStartEnabled ?? false,
    });

    this.patch({
      appState: nextAppState,
      appStateDetail: overrideDetail ?? status.detail ?? describePythonRuntimeStatus(status),
      canRestartRuntime: canRestartRuntime(status),
    });
  }

  private describeStartupIntent(): string {
    if (this.runtimeManagement?.isManagedLocal && this.runtimeManagement.autoStartEnabled) {
      return "Starting the managed Python runtime and waiting for it to become ready…";
    }

    return "Checking Python runtime availability…";
  }

  private async collectHealthChecks(): Promise<ReadonlyArray<RuntimeHealthCheck>> {
    await this.syncRuntimeState("refresh");
    const checks = [...this.buildPythonRuntimeHealthChecks(this.pythonRuntimeManager.getStatus())];

    if (!this.mcpService) {
      return Object.freeze(checks);
    }

    try {
      const [runtimeStatus, configuredServers] = await Promise.all([
        this.mcpService.getConnectionStatus(),
        this.mcpService.listConfiguredServers().catch((error) => {
          const message = toErrorMessage(error) || "Unable to inspect configured MCP servers.";
          this.appendLog({
            severity: "warn",
            source: detectLogSource(message, error, "mcp-runtime"),
            message: "Configured MCP servers could not be listed.",
            details: message,
            stack: toErrorStack(error),
          });
          return Object.freeze([]);
        }),
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
      const message = toErrorMessage(error) || "Unable to inspect MCP server health.";
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, error, "mcp-runtime"),
        message: "MCP runtime inspection failed.",
        details: message,
        stack: toErrorStack(error),
      });
      checks.push({
        id: "mcp-runtime",
        label: "MCP runtime",
        kind: "mcp-runtime",
        status: "offline",
        detail: message,
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
          const message = toErrorMessage(error) || `Unable to inspect MCP server ${serverId}.`;
          this.appendLog({
            severity: "warn",
            source: detectLogSource(message, error, "mcp-runtime"),
            message: `MCP server inspection failed for ${configuredServer.name}.`,
            details: message,
            stack: toErrorStack(error),
          });
          return this.createFallbackMcpServerStatus(configuredServer, error);
        }
      }),
    );

    return Object.freeze(statuses.filter((status): status is McpServerStatus => !!status));
  }

  private appendLog(entry: Omit<RuntimeConsoleLogEntry, "id" | "timestamp"> & Partial<Pick<RuntimeConsoleLogEntry, "id" | "timestamp">>): void {
    const nextEntry = Object.freeze({
      id: entry.id?.trim() || createRuntimeConsoleLogId(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      severity: entry.severity,
      source: entry.source,
      message: entry.message.trim(),
      details: entry.details?.trim() || undefined,
      stack: entry.stack?.trim() || undefined,
    });

    this.diagnosticLogs = Object.freeze([...this.diagnosticLogs, nextEntry].slice(-this.logCapacity));
    this.patch({ logs: this.buildCombinedLogs(this.state.events) });
  }

  private buildCombinedLogs(events: ReadonlyArray<RuntimeEvent>): ReadonlyArray<RuntimeConsoleLogEntry> {
    return Object.freeze(
      [...events.map((event) => this.mapRuntimeEventToLogEntry(event)), ...this.diagnosticLogs]
        .sort((left, right) => {
          if (left.timestamp === right.timestamp) {
            return left.id.localeCompare(right.id);
          }

          return left.timestamp.localeCompare(right.timestamp);
        })
        .slice(-this.logCapacity),
    );
  }

  private mapRuntimeEventToLogEntry(event: RuntimeEvent): RuntimeConsoleLogEntry {
    return Object.freeze({
      id: `event:${event.id}`,
      timestamp: event.timestamp,
      severity: mapRuntimeEventSeverity(event.severity),
      source: mapRuntimeEventSource(event.source),
      message: event.message,
      details: event.details ? JSON.stringify(event.details) : undefined,
    });
  }

  private attachGlobalErrorListeners(): (() => void) | undefined {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return undefined;
    }

    const onError = (event: Event): void => {
      const errorEvent = event as ErrorEvent;
      const error = errorEvent.error;
      const message = errorEvent.message || toErrorMessage(error) || "Unexpected UI error.";
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, error, "ui"),
        message: "Uncaught UI error during runtime management.",
        details: message,
        stack: errorEvent.error instanceof Error ? errorEvent.error.stack : undefined,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const message = toErrorMessage(event.reason) || "Unhandled promise rejection.";
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, event.reason, "ui"),
        message: "Unhandled runtime management promise rejection.",
        details: message,
        stack: toErrorStack(event.reason),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
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

function deriveAppState(
  status: PythonRuntimeManagerStatus,
  context: { trigger: "startup" | "startup-failed" | "monitor" | "manual-restart" | "refresh"; isManagedLocal: boolean; autoStartEnabled: boolean },
): RuntimeAppState {
  switch (status.status) {
    case PythonRuntimeStatuses.healthy:
      return "ready";
    case PythonRuntimeStatuses.starting:
    case PythonRuntimeStatuses.stopping:
      return context.trigger === "monitor" || context.trigger === "manual-restart" ? "reconnecting" : "starting";
    case PythonRuntimeStatuses.unhealthy:
      return "degraded";
    case PythonRuntimeStatuses.failed:
      return context.isManagedLocal && context.autoStartEnabled ? "failed" : "degraded";
    case PythonRuntimeStatuses.stopped:
      return context.trigger === "manual-restart" ? "reconnecting" : "degraded";
    case PythonRuntimeStatuses.unavailable:
    default:
      return context.isManagedLocal && context.autoStartEnabled && context.trigger !== "refresh"
        ? "failed"
        : "degraded";
  }
}

function canRestartRuntime(status: PythonRuntimeManagerStatus): boolean {
  return status.status !== PythonRuntimeStatuses.starting && status.status !== PythonRuntimeStatuses.stopping;
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

function mapRuntimeEventSeverity(severity: RuntimeEvent["severity"]): RuntimeConsoleLogSeverity {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warn";
    default:
      return "info";
  }
}

function mapRuntimeEventSource(source: RuntimeEvent["source"]): RuntimeConsoleLogSource {
  switch (source) {
    case "app":
      return "app";
    case "workflow-execution":
      return "workflow-execution";
    case "comfyui":
      return "comfyui";
    case "models":
      return "models";
    case "python-runtime":
    default:
      return "python-runtime";
  }
}

function detectLogSource(message: string | undefined, error: unknown, fallback: RuntimeConsoleLogSource): RuntimeConsoleLogSource {
  const haystack = `${message ?? ""} ${toErrorMessage(error) ?? ""}`.toLowerCase();

  if (haystack.includes("fetch") || haystack.includes("network") || haystack.includes("illegal invocation")) {
    return "network";
  }

  if (haystack.includes("mcp")) {
    return "mcp-runtime";
  }

  if (haystack.includes("runtime") || haystack.includes("python")) {
    return "python-runtime-manager";
  }

  return fallback;
}

function toErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
}

function toErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function createRuntimeConsoleLogId(): string {
  return `runtime-console-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

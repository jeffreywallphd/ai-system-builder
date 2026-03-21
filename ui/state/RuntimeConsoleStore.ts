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
import {
  buildRuntimeDiagnosticSummary,
  buildRuntimeStackPreview,
  normalizeRuntimeError,
  type RuntimeDiagnostics,
  type RuntimeDiagnosticsContext,
  type RuntimeLogVerbosity,
} from "../../application/runtime/RuntimeDiagnostics";
import { collapseConsecutiveRuntimeEvents } from "../../application/runtime/RuntimeEventStability";

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
  readonly stackPreview?: string;
  readonly requestMethod?: string;
  readonly target?: string;
  readonly diagnostics?: RuntimeDiagnostics;
}

export interface RuntimeConsoleState {
  readonly isExpanded: boolean;
  readonly activeTab: RuntimeConsoleTab;
  readonly logVerbosity: RuntimeLogVerbosity;
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
    logVerbosity: "normal",
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
      const stableEvents = collapseConsecutiveRuntimeEvents(events);
      this.state = Object.freeze({
        ...this.state,
        events: stableEvents,
        logs: this.buildCombinedLogs(stableEvents),
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

  public openConsole(tab: RuntimeConsoleTab = this.state.activeTab): void {
    this.patch({
      isExpanded: true,
      activeTab: tab,
    });

    if (tab === "health") {
      void this.refreshHealth();
    }
  }

  public setActiveTab(tab: RuntimeConsoleTab): void {
    if (this.state.activeTab === tab) {
      return;
    }

    this.patch({ activeTab: tab });
  }

  public setLogVerbosity(verbosity: RuntimeLogVerbosity): void {
    if (this.state.logVerbosity === verbosity) {
      return;
    }

    this.patch({ logVerbosity: verbosity });
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
      appStateDetail: "Trying to restart the Python runtime…",
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
        error,
        diagnosticsContext: {
          message,
          subsystem: "python-runtime-manager",
          className: "RuntimeConsoleStore",
          methodName: "restartRuntime",
          operation: "restart-python-runtime",
        },
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
            error,
            diagnosticsContext: {
              message,
              subsystem: "runtime-console",
              className: "RuntimeConsoleStore",
              methodName: "refreshHealth",
              operation: "refresh-runtime-health",
            },
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
        error,
        diagnosticsContext: {
          message,
          subsystem: "python-runtime-manager",
          className: "RuntimeConsoleStore",
          methodName: "bootstrapRuntime",
          operation: "initialize-python-runtime",
        },
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
        appStateDetail: "Trying to reconnect to the Python runtime…",
      });

      try {
        status = await this.pythonRuntimeManager.ensureRuntimeAvailability();
      } catch (error) {
        const message = toErrorMessage(error);
        this.appendLog({
          severity: "error",
          source: detectLogSource(message, error, "python-runtime-manager"),
          message: "Managed runtime recovery failed.",
          error,
          diagnosticsContext: {
            message,
            subsystem: "python-runtime-manager",
            className: "RuntimeConsoleStore",
            methodName: "syncRuntimeState",
            operation: "recover-python-runtime",
          },
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
      currentAppState: this.state.appState,
    });
    const nextAppStateDetail = nextAppState === "reconnecting"
      ? getStableReconnectingDetail(trigger)
      : overrideDetail ?? status.detail ?? describePythonRuntimeStatus(status);

    this.patch({
      appState: nextAppState,
      appStateDetail: nextAppStateDetail,
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
            error,
            diagnosticsContext: {
              message,
              subsystem: "mcp-runtime",
              className: "RuntimeConsoleStore",
              methodName: "collectHealthChecks",
              operation: "list-configured-mcp-servers",
            },
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
        error,
        diagnosticsContext: {
          message,
          subsystem: "mcp-runtime",
          className: "RuntimeConsoleStore",
          methodName: "collectHealthChecks",
          operation: "inspect-mcp-runtime",
        },
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
            error,
            diagnosticsContext: {
              message,
              subsystem: "mcp-runtime",
              className: "RuntimeConsoleStore",
              methodName: "collectServerStatuses",
              operation: "inspect-mcp-server",
              details: { serverId, serverName: configuredServer.name },
            },
          });
          return this.createFallbackMcpServerStatus(configuredServer, error);
        }
      }),
    );

    return Object.freeze(statuses.filter((status): status is McpServerStatus => !!status));
  }

  private appendLog(
    entry: Omit<RuntimeConsoleLogEntry, "id" | "timestamp" | "stackPreview"> &
      Partial<Pick<RuntimeConsoleLogEntry, "id" | "timestamp" | "stackPreview">> & {
        readonly error?: unknown;
        readonly diagnosticsContext?: RuntimeDiagnosticsContext;
      },
  ): void {
    const diagnostics = entry.diagnostics
      ?? (entry.error !== undefined ? normalizeRuntimeError(entry.error, entry.diagnosticsContext) : undefined);
    const stack = entry.stack?.trim() || diagnostics?.stack?.trim() || undefined;
    const details = entry.details?.trim() || buildRuntimeDiagnosticSummary(diagnostics) || undefined;
    const stackPreview = entry.stackPreview?.trim() || buildRuntimeStackPreview(stack);
    const nextEntry = Object.freeze({
      id: entry.id?.trim() || createRuntimeConsoleLogId(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      severity: entry.severity,
      source: entry.source,
      message: entry.message.trim(),
      details,
      stack,
      stackPreview,
      requestMethod: entry.requestMethod ?? diagnostics?.requestMethod,
      target: entry.target ?? diagnostics?.target,
      diagnostics,
    });

    const nextLogs = appendDistinctRuntimeConsoleLog(this.diagnosticLogs, nextEntry, this.logCapacity);
    if (nextLogs === this.diagnosticLogs) {
      return;
    }

    this.diagnosticLogs = nextLogs;
    this.patch({ logs: this.buildCombinedLogs(this.state.events) });
  }

  private buildCombinedLogs(events: ReadonlyArray<RuntimeEvent>): ReadonlyArray<RuntimeConsoleLogEntry> {
    const sortedLogs = [...events.map((event) => this.mapRuntimeEventToLogEntry(event)), ...this.diagnosticLogs]
      .sort((left, right) => {
        if (left.timestamp === right.timestamp) {
          return left.id.localeCompare(right.id);
        }

        return left.timestamp.localeCompare(right.timestamp);
      });

    return Object.freeze(collapseConsecutiveRuntimeConsoleLogs(sortedLogs).slice(-this.logCapacity));
  }

  private mapRuntimeEventToLogEntry(event: RuntimeEvent): RuntimeConsoleLogEntry {
    const eventDetails = event.details;
    const diagnostics = readRuntimeDiagnostics(eventDetails);
    const serializedEventDetails = eventDetails ? serializeEventDetails(eventDetails) : undefined;

    return Object.freeze({
      id: `event:${event.id}`,
      timestamp: event.timestamp,
      severity: mapRuntimeEventSeverity(event.severity),
      source: mapRuntimeEventSource(event.source),
      message: event.message,
      details: diagnostics ? buildRuntimeDiagnosticSummary(diagnostics) : serializedEventDetails,
      stack: diagnostics?.stack,
      stackPreview: buildRuntimeStackPreview(diagnostics?.stack),
      requestMethod: diagnostics?.requestMethod,
      target: diagnostics?.target,
      diagnostics,
    });
  }

  private attachGlobalErrorListeners(): (() => void) | undefined {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return undefined;
    }

    const onError = (event: Event): void => {
      const errorEvent = event as ErrorEvent;
      const error = errorEvent.error ?? errorEvent;
      const message = errorEvent.message || toErrorMessage(error) || "Unexpected UI error.";
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, error, "ui"),
        message: "Uncaught UI error during runtime management.",
        error,
        diagnosticsContext: {
          message,
          subsystem: "ui",
          className: "window",
          methodName: "onerror",
          operation: "ui-uncaught-error",
          target: errorEvent.filename,
          details: {
            line: errorEvent.lineno,
            column: errorEvent.colno,
          },
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const message = toErrorMessage(event.reason) || "Unhandled promise rejection.";
      this.appendLog({
        severity: "error",
        source: detectLogSource(message, event.reason, "ui"),
        message: "Unhandled runtime management promise rejection.",
        error: event.reason,
        diagnosticsContext: {
          message,
          subsystem: "ui",
          className: "window",
          methodName: "onunhandledrejection",
          operation: "ui-unhandled-rejection",
          details: event.reason,
        },
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
  context: {
    trigger: "startup" | "startup-failed" | "monitor" | "manual-restart" | "refresh";
    isManagedLocal: boolean;
    autoStartEnabled: boolean;
    currentAppState: RuntimeAppState;
  },
): RuntimeAppState {
  if (
    context.currentAppState === "reconnecting"
    && context.isManagedLocal
    && context.autoStartEnabled
    && (context.trigger === "monitor" || context.trigger === "refresh")
    && shouldKeepRetryingPresentation(status)
  ) {
    return "reconnecting";
  }

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

function shouldKeepRetryingPresentation(status: PythonRuntimeManagerStatus): boolean {
  if (isTerminalRetryFailure(status.detail)) {
    return false;
  }

  return status.status === PythonRuntimeStatuses.unavailable
    || status.status === PythonRuntimeStatuses.starting
    || status.status === PythonRuntimeStatuses.stopping
    || status.status === PythonRuntimeStatuses.unhealthy
    || status.status === PythonRuntimeStatuses.failed
    || status.status === PythonRuntimeStatuses.stopped;
}

function isTerminalRetryFailure(detail: string | undefined): boolean {
  const normalizedDetail = detail?.toLowerCase() ?? "";
  return normalizedDetail.includes("restart circuit is open")
    || normalizedDetail.includes("max retries")
    || normalizedDetail.includes("timed out waiting for runtime readiness");
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

function readRuntimeDiagnostics(details: RuntimeEvent["details"]): RuntimeDiagnostics | undefined {
  if (!details || typeof details !== "object" || !("diagnostics" in details)) {
    return undefined;
  }

  const diagnostics = (details as { diagnostics?: RuntimeDiagnostics }).diagnostics;
  return diagnostics && typeof diagnostics.message === "string" ? diagnostics : undefined;
}

function serializeEventDetails(details: RuntimeEvent["details"]): string | undefined {
  if (!details) {
    return undefined;
  }

  const entries = Object.entries(details).filter(([key]) => key !== "diagnostics");
  if (entries.length === 0) {
    return undefined;
  }

  return JSON.stringify(Object.fromEntries(entries));
}

function createRuntimeConsoleLogId(): string {
  return `runtime-console-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function collapseConsecutiveRuntimeConsoleLogs(
  logs: ReadonlyArray<RuntimeConsoleLogEntry>,
): ReadonlyArray<RuntimeConsoleLogEntry> {
  const collapsed: RuntimeConsoleLogEntry[] = [];

  for (const log of logs) {
    const previous = collapsed.length > 0 ? collapsed[collapsed.length - 1] : undefined;
    if (previous && areRuntimeConsoleLogsEquivalent(previous, log)) {
      continue;
    }

    collapsed.push(log);
  }

  return Object.freeze(collapsed);
}

function appendDistinctRuntimeConsoleLog(
  logs: ReadonlyArray<RuntimeConsoleLogEntry>,
  nextLog: RuntimeConsoleLogEntry,
  capacity: number,
): ReadonlyArray<RuntimeConsoleLogEntry> {
  const previous = logs.length > 0 ? logs[logs.length - 1] : undefined;
  if (previous && areRuntimeConsoleLogsEquivalent(previous, nextLog)) {
    return logs;
  }

  return Object.freeze([...logs, nextLog].slice(-Math.max(capacity, 1)));
}

function areRuntimeConsoleLogsEquivalent(left: RuntimeConsoleLogEntry, right: RuntimeConsoleLogEntry): boolean {
  return left.severity === right.severity
    && left.source === right.source
    && left.message === right.message
    && left.details === right.details
    && left.stack === right.stack
    && left.requestMethod === right.requestMethod
    && left.target === right.target;
}

function getStableReconnectingDetail(
  trigger: "startup" | "startup-failed" | "monitor" | "manual-restart" | "refresh",
): string {
  return trigger === "manual-restart"
    ? "Trying to restart the Python runtime…"
    : "Trying to reconnect to the Python runtime…";
}

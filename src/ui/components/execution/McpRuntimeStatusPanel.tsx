import type { RuntimeAppState } from "../../state/RuntimeConsoleStore";
import type { McpConnectionStatus } from "@application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "@application/mcp/models/McpServerDescriptor";
import type { McpToolDescriptor } from "@application/mcp/models/McpToolDescriptor";
import {
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../electron/shared/DesktopContracts";

export interface McpRuntimeStatusPanelProps {
  readonly status?: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly searchQuery?: string;
  readonly isLoading?: boolean;
  readonly error?: string;
  readonly runtimeAppState?: RuntimeAppState;
  readonly runtimeAppStateDetail?: string;
  readonly isRuntimeUnavailable?: boolean;
  readonly runtimeLifecycleStatus?: DesktopPostLoginRuntimeStatus;
  readonly onSearchChange?: (value: string) => void;
  readonly onConnectServer?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnectServer?: (serverId: string) => void;
  readonly onRestartRuntime?: () => void;
}

export type UserFacingRuntimeLifecycleState = "unavailable" | "warming" | "ready" | "failed";

export interface RuntimeLifecyclePresentation {
  readonly state: UserFacingRuntimeLifecycleState;
  readonly title: string;
  readonly message: string;
  readonly diagnostics?: string;
  readonly canRetry: boolean;
}

export default function McpRuntimeStatusPanel({
  status,
  tools,
  servers,
  searchQuery = "",
  isLoading = false,
  error,
  runtimeAppState = "ready",
  runtimeAppStateDetail,
  isRuntimeUnavailable = false,
  runtimeLifecycleStatus,
  onSearchChange,
  onConnectServer,
  onDisconnectServer,
  onRestartRuntime,
}: McpRuntimeStatusPanelProps): JSX.Element {
  const toolNames = tools.slice(0, 5).map((tool) => tool.title || tool.name);
  const lifecycle = resolveRuntimeLifecyclePresentation({
    status: runtimeLifecycleStatus,
    runtimeAppState,
    runtimeAppStateDetail,
    isRuntimeUnavailable,
  });
  const isInteractionDisabled = isLoading || lifecycle.state !== "ready";

  return (
    <section className="ui-panel ui-panel--elevated" aria-live="polite">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">MCP Runtime</div>
          <div className="ui-panel__subtitle">
            Availability, configured server status, and discovered tools from the Python-backed MCP runtime.
          </div>
        </div>
        <span className="ui-badge ui-badge--info">{status?.state ?? (isLoading ? "loading" : "unknown")}</span>
      </div>

      <div className="ui-panel__body">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Python runtime</div>
            <div className="ui-meta-value">{status?.pythonRuntimeHealthy === false ? "Unhealthy" : "Healthy"}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">MCP runtime</div>
            <div className="ui-meta-value">{status?.mcpRuntimeHealthy === true ? "Healthy" : status?.enabled ? "Degraded" : status ? "Disabled" : "-"}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Discovered tools</div>
            <div className="ui-meta-value">{tools.length}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Servers</div>
            <div className="ui-meta-value">{servers.length || status?.servers.length || 0}</div>
          </div>
        </div>

        <div className="ui-panel ui-panel--flat" style={{ marginTop: "0.75rem" }}>
          <div className="ui-panel__body ui-stack" style={{ gap: "0.4rem" }}>
            <div className="ui-meta-label">Runtime status</div>
            <div className="ui-meta-value">{lifecycle.title}</div>
            <p className="ui-muted" style={{ margin: 0 }}>{lifecycle.message}</p>
            {lifecycle.diagnostics ? (
              <p className="ui-text-secondary ui-text-small" style={{ margin: 0 }}>
                {lifecycle.diagnostics}
              </p>
            ) : null}
            {onRestartRuntime && lifecycle.canRetry ? (
              <div>
                <button
                  className="ui-button ui-button--secondary"
                  type="button"
                  disabled={isLoading || runtimeAppState === "starting" || runtimeAppState === "reconnecting"}
                  onClick={() => onRestartRuntime()}
                >
                  Retry startup
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <label className="ui-field" htmlFor="mcp-server-search">
          <span className="ui-field__label">Search configured MCP servers</span>
          <input
            id="mcp-server-search"
            className="ui-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Filter by id, name, transport, or metadata"
            disabled={isInteractionDisabled}
          />
        </label>

        {error ? <p className="ui-muted">{error}</p> : null}
        {isLoading ? <p className="ui-muted">Refreshing MCP tools and server status...</p> : null}
        {!isLoading && toolNames.length > 0 ? (
          <p className="ui-muted">Available tools: {toolNames.join(", ")}</p>
        ) : null}
        {!isLoading && toolNames.length === 0 && !error ? (
          <p className="ui-muted">No MCP tools discovered yet.</p>
        ) : null}

        <div className="ui-stack" style={{ gap: "0.75rem", marginTop: "1rem" }}>
          {servers.map((server) => {
            const isConnected = server.status === "connected";
            return (
              <article key={server.id} className="ui-panel" data-testid={`mcp-server-${server.id}`}>
                <div className="ui-panel__header">
                  <div>
                    <div className="ui-panel__title">{server.name}</div>
                    <div className="ui-panel__subtitle">
                      {server.id} - {server.transport} - {(server.sourceType ?? "external-remote")} - {server.toolCount} tools - {server.resourceCount} resources
                    </div>
                  </div>
                  <span className="ui-badge ui-badge--info">{server.status}</span>
                </div>
                <div className="ui-panel__body">
                  {server.errorMessage ? <p className="ui-muted">{server.errorMessage}</p> : null}
                  <p className="ui-muted">Config: {server.configValid === false ? "invalid" : "valid"} - Session: {server.sessionState ?? server.status} - Last sync: {server.lastSyncAt ?? "never"}</p>
                  <div className="ui-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button className="ui-button ui-button--secondary" type="button" onClick={() => onConnectServer?.(server.id, false)} disabled={isInteractionDisabled}>
                      Connect
                    </button>
                    <button className="ui-button ui-button--ghost" type="button" onClick={() => onConnectServer?.(server.id, true)} disabled={isInteractionDisabled}>
                      Reconnect
                    </button>
                    <button
                      className="ui-button ui-button--ghost"
                      type="button"
                      onClick={() => onDisconnectServer?.(server.id)}
                      disabled={!isConnected || isInteractionDisabled}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!isLoading && servers.length === 0 && !error ? (
            <p className="ui-muted">No configured MCP servers matched your search.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function resolveRuntimeLifecyclePresentation(input: {
  readonly status?: DesktopPostLoginRuntimeStatus;
  readonly runtimeAppState: RuntimeAppState;
  readonly runtimeAppStateDetail?: string;
  readonly isRuntimeUnavailable: boolean;
}): RuntimeLifecyclePresentation {
  const status = input.status;

  if (status?.state === DesktopPostLoginRuntimeStates.failed) {
    return Object.freeze({
      state: "failed",
      title: "Needs attention",
      message: status.failure?.retryable === false
        ? "Your runtime stopped during startup and needs manual attention."
        : "Your runtime stopped during startup. Retry when you are ready.",
      diagnostics: buildRuntimeLifecycleDiagnostics(status, input.runtimeAppStateDetail),
      canRetry: status.failure?.retryable ?? true,
    });
  }

  if (status?.state === DesktopPostLoginRuntimeStates.warming) {
    return Object.freeze({
      state: "warming",
      title: "Starting",
      message: "Your runtime is still starting. MCP tools will appear automatically when it is ready.",
      diagnostics: buildRuntimeLifecycleDiagnostics(status, input.runtimeAppStateDetail),
      canRetry: false,
    });
  }

  if (status && (status.state === DesktopPostLoginRuntimeStates.preLogin || status.state === DesktopPostLoginRuntimeStates.unavailable)) {
    const message = status.unavailableReason === DesktopPostLoginRuntimeUnavailableReasons.loggedOut
      ? "Sign in again to resume runtime-backed features."
      : status.unavailableReason === DesktopPostLoginRuntimeUnavailableReasons.shuttingDown
        ? "The runtime is currently shutting down. Wait a moment, then retry."
        : "The runtime has not started yet for this session.";
    return Object.freeze({
      state: "unavailable",
      title: "Unavailable",
      message,
      diagnostics: buildRuntimeLifecycleDiagnostics(status, input.runtimeAppStateDetail),
      canRetry: status.unavailableReason !== DesktopPostLoginRuntimeUnavailableReasons.shuttingDown,
    });
  }

  if (status?.state === DesktopPostLoginRuntimeStates.ready) {
    return Object.freeze({
      state: "ready",
      title: "Ready",
      message: "Your runtime is available and MCP tools can be used.",
      diagnostics: buildRuntimeLifecycleDiagnostics(status, input.runtimeAppStateDetail),
      canRetry: false,
    });
  }

  if (input.runtimeAppState === "failed") {
    return Object.freeze({
      state: "failed",
      title: "Needs attention",
      message: "Your runtime stopped during startup. Retry when you are ready.",
      diagnostics: input.runtimeAppStateDetail,
      canRetry: true,
    });
  }

  if (input.runtimeAppState === "starting" || input.runtimeAppState === "reconnecting") {
    return Object.freeze({
      state: "warming",
      title: "Starting",
      message: "Your runtime is still starting. MCP tools will appear automatically when it is ready.",
      diagnostics: input.runtimeAppStateDetail,
      canRetry: false,
    });
  }

  if (input.runtimeAppState !== "ready" || input.isRuntimeUnavailable) {
    return Object.freeze({
      state: "unavailable",
      title: "Unavailable",
      message: "Your runtime is not available right now.",
      diagnostics: input.runtimeAppStateDetail,
      canRetry: true,
    });
  }

  return Object.freeze({
    state: "ready",
    title: "Ready",
    message: "Your runtime is available and MCP tools can be used.",
    diagnostics: input.runtimeAppStateDetail,
    canRetry: false,
  });
}

function buildRuntimeLifecycleDiagnostics(
  status: DesktopPostLoginRuntimeStatus,
  runtimeDetail?: string,
): string {
  const diagnostics: string[] = [
    `runtime=${status.state}`,
    `capability=${status.capabilityPhase}`,
    `transport=${status.transport.phase}`,
    `updated=${status.updatedAt}`,
  ];

  if (status.unavailableReason) {
    diagnostics.push(`reason=${status.unavailableReason}`);
  }

  const blockingStage = status.activationStages?.find((stage) => (
    stage.state === "running"
    || (stage.state === "blocked" && stage.blockingReadiness)
  ));
  if (blockingStage) {
    diagnostics.push(`stage=${blockingStage.stageId}:${blockingStage.state}`);
  }

  if (status.failure?.message?.trim()) {
    diagnostics.push(`failure=${status.failure.message.trim()}`);
  }

  if (runtimeDetail?.trim()) {
    diagnostics.push(`detail=${runtimeDetail.trim()}`);
  }

  return diagnostics.join(" | ");
}
